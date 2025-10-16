import axios from 'axios';
import {
  getCachedVideos,
  saveCachedVideos,
  mergeVideos,
  isNewChannel,
  getCachedPageToken,
} from '../utils/videoCache';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  channelTitle: string;
  description: string;
  duration: string;
  durationSeconds: number;
  viewCount: string;
}

interface YouTubeAPIResponse {
  items: Array<{
    id: {
      videoId?: string;
      channelId?: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        high: {
          url: string;
        };
        medium: {
          url: string;
        };
      };
      publishedAt: string;
      channelTitle: string;
    };
  }>;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

/**
 * Extract channel ID from YouTube channel URL
 */
export function extractChannelId(channelUrl: string): string | null {
  try {
    const url = new URL(channelUrl);

    // Format: youtube.com/channel/CHANNEL_ID
    if (url.pathname.startsWith('/channel/')) {
      return url.pathname.split('/channel/')[1].split('/')[0];
    }

    // Format: youtube.com/@username
    if (url.pathname.startsWith('/@')) {
      return url.pathname.split('/@')[1].split('/')[0];
    }

    // Format: youtube.com/c/username
    if (url.pathname.startsWith('/c/')) {
      return url.pathname.split('/c/')[1].split('/')[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve channel username to channel ID
 */
async function resolveChannelId(usernameOrHandle: string, apiKey: string): Promise<string> {
  // If it starts with UC, it's already a channel ID
  if (usernameOrHandle.startsWith('UC')) {
    return usernameOrHandle;
  }

  // Try to search for the channel
  try {
    const response = await axios.get<YouTubeAPIResponse>(
      'https://www.googleapis.com/youtube/v3/search',
      {
        params: {
          key: apiKey,
          part: 'snippet',
          type: 'channel',
          q: usernameOrHandle.replace('@', ''),
          maxResults: 1,
        },
      }
    );

    if (response.data.items && response.data.items.length > 0) {
      const channelId = response.data.items[0].id.channelId;
      if (!channelId) {
        throw new Error('Channel ID not found in response');
      }
      return channelId;
    }

    throw new Error('Channel not found');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded or invalid API key');
      }
      throw new Error(`Failed to resolve channel: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format duration seconds to readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get channel's uploads playlist ID
 */
async function getUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  try {
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels',
      {
        params: {
          key: apiKey,
          id: channelId,
          part: 'contentDetails',
        },
      }
    );

    const uploadsPlaylistId = response.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist');
    }
    return uploadsPlaylistId;
  } catch (error) {
    throw new Error('Failed to get channel uploads playlist');
  }
}

/**
 * Load more videos from channels (pagination)
 * Fetches 200 more videos per channel using page tokens
 */
export async function loadMoreChannelVideos(
  channelUrls: string[],
  apiKey: string,
  pageTokens: Map<string, string | undefined>,
  maxResultsPerChannel: number = 200
): Promise<{
  videos: YouTubeVideo[];
  pageTokens: Map<string, string | undefined>;
  hasMore: boolean
}> {
  try {
    console.log(`📄 Loading ${maxResultsPerChannel} more videos from ${channelUrls.length} channels...`);

    // Fetch from all channels in parallel
    const results = await Promise.all(
      channelUrls.map(async (channelUrl) => {
        try {
          // Get pageToken for this channel (undefined = start from beginning)
          const pageToken = pageTokens.get(channelUrl);
          console.log(`🔑 Using pageToken for ${channelUrl}:`, pageToken ? `"${pageToken.substring(0, 20)}..."` : 'undefined (will fetch from beginning)');

          const result = await fetchChannelVideos(
            channelUrl,
            apiKey,
            pageToken, // undefined means fetch from beginning
            maxResultsPerChannel,
            1 // min duration filtering done client-side
          );

          // Save new videos to cache WITH pageToken
          const cachedVideos = getCachedVideos(channelUrl);
          const mergedVideos = mergeVideos(cachedVideos, result.videos);
          saveCachedVideos(channelUrl, mergedVideos, result.nextPageToken);

          return {
            channelUrl,
            videos: result.videos,
            nextPageToken: result.nextPageToken,
            hasMore: !!result.nextPageToken
          };
        } catch (error) {
          console.error(`❌ Error loading more from ${channelUrl}:`, error);
          return {
            channelUrl,
            videos: [],
            nextPageToken: undefined,
            hasMore: false
          };
        }
      })
    );

    // Merge all videos
    const allVideos: YouTubeVideo[] = [];
    const newPageTokens = new Map<string, string | undefined>();
    let hasMore = false;

    results.forEach((result) => {
      allVideos.push(...result.videos);
      newPageTokens.set(result.channelUrl, result.nextPageToken);
      if (result.hasMore) {
        hasMore = true;
      }
    });

    // Sort by date (newest first)
    allVideos.sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    console.log(`✓ Loaded ${allVideos.length} more videos (saved to cache)`);

    return {
      videos: allVideos,
      pageTokens: newPageTokens,
      hasMore,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch videos from multiple YouTube channels and merge them
 */
export async function fetchMultipleChannelsVideos(
  channelUrls: string[],
  apiKey: string,
  pageTokens: Map<string, string | undefined>,
  maxResultsPerChannel: number = 50,
  minDurationMinutes: number = 27,
  sortOrder: 'date' | 'popular' = 'date'
): Promise<{ videos: YouTubeVideo[]; pageTokens: Map<string, string | undefined>; hasMore: boolean }> {
  try {
    if (channelUrls.length === 0) {
      throw new Error('No channel URLs provided');
    }

    // Fetch from all channels in parallel
    const results = await Promise.all(
      channelUrls.map(async (channelUrl) => {
        try {
          const pageToken = pageTokens.get(channelUrl);
          return await fetchChannelVideos(
            channelUrl,
            apiKey,
            pageToken,
            maxResultsPerChannel,
            minDurationMinutes
          );
        } catch (error) {
          console.error(`Error fetching from ${channelUrl}:`, error);
          return { videos: [], nextPageToken: undefined, totalResults: 0 };
        }
      })
    );

    // Merge all videos
    const allVideos: YouTubeVideo[] = [];
    const newPageTokens = new Map<string, string | undefined>();
    let hasMore = false;

    results.forEach((result, index) => {
      allVideos.push(...result.videos);
      newPageTokens.set(channelUrls[index], result.nextPageToken);
      if (result.nextPageToken) {
        hasMore = true;
      }
    });

    // Sort based on sortOrder
    if (sortOrder === 'popular') {
      // Sort by view count (highest first)
      allVideos.sort((a, b) => {
        const viewsA = parseInt(a.viewCount.replace(/,/g, ''), 10);
        const viewsB = parseInt(b.viewCount.replace(/,/g, ''), 10);
        return viewsB - viewsA;
      });
    } else {
      // Sort by date (newest first)
      allVideos.sort((a, b) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    }

    return {
      videos: allVideos,
      pageTokens: newPageTokens,
      hasMore,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch videos from multiple channels with smart caching
 * - New channels: Fetches 200 videos initially (one-time heavy load)
 * - Existing channels: Fetches only 10 latest videos (quick check)
 * This drastically reduces API quota usage!
 */
export async function fetchLatestVideosWithCache(
  channelUrls: string[],
  apiKey: string
): Promise<{
  videos: YouTubeVideo[];
  fromCache: number;
  fromAPI: number;
  pageTokens: Map<string, string | undefined>;
  hasMore: boolean;
}> {
  try {
    if (channelUrls.length === 0) {
      throw new Error('No channel URLs provided');
    }

    console.log(`🔄 Smart loading from ${channelUrls.length} channels...`);

    let totalFromCache = 0;
    let totalFromAPI = 0;
    const newPageTokens = new Map<string, string | undefined>();
    let hasMore = false;

    // Process each channel
    const results = await Promise.all(
      channelUrls.map(async (channelUrl) => {
        try {
          // Check if channel is new (no cache)
          const isNew = isNewChannel(channelUrl);

          if (isNew) {
            // NEW CHANNEL: Load 200 videos initially
            console.log(`🆕 New channel detected: ${channelUrl} - Loading 200 videos...`);
            const result = await fetchChannelVideos(
              channelUrl,
              apiKey,
              undefined, // no page token
              200, // Fetch 200 videos for new channel
              1 // min duration = 1 minute (we'll filter later)
            );
            totalFromAPI += result.videos.length;

            // Save to cache WITH pageToken
            saveCachedVideos(channelUrl, result.videos, result.nextPageToken);

            return {
              channelUrl,
              videos: result.videos,
              nextPageToken: result.nextPageToken,
              fromCache: 0
            };
          } else {
            // EXISTING CHANNEL: Quick check of latest 10 videos
            console.log(`📦 Existing channel: ${channelUrl} - Checking latest 10 videos...`);
            const cachedVideos = getCachedVideos(channelUrl);
            const oldPageToken = getCachedPageToken(channelUrl); // Preserve old pageToken!
            totalFromCache += cachedVideos.length;

            const result = await fetchChannelVideos(
              channelUrl,
              apiKey,
              undefined, // no page token
              10, // Only fetch 10 latest videos
              1 // min duration = 1 minute
            );
            totalFromAPI += result.videos.length;

            // Merge cached + new videos (removes duplicates)
            const mergedVideos = mergeVideos(cachedVideos, result.videos);

            // Save back to cache WITH OLD pageToken (preserve Load More position!)
            saveCachedVideos(channelUrl, mergedVideos, oldPageToken);

            return {
              channelUrl,
              videos: mergedVideos,
              nextPageToken: oldPageToken, // Return old pageToken, not new one
              fromCache: cachedVideos.length
            };
          }
        } catch (error) {
          console.error(`❌ Error fetching from ${channelUrl}:`, error);
          // On error, return cached videos if available
          const cachedVideos = getCachedVideos(channelUrl);
          return {
            channelUrl,
            videos: cachedVideos,
            nextPageToken: undefined,
            fromCache: cachedVideos.length
          };
        }
      })
    );

    // Process results
    const allVideos: YouTubeVideo[] = [];
    results.forEach((result) => {
      allVideos.push(...result.videos);
      newPageTokens.set(result.channelUrl, result.nextPageToken);
      if (result.nextPageToken) {
        hasMore = true;
      }
    });

    console.log(`✓ Total: ${allVideos.length} videos (${totalFromCache} cached, ${totalFromAPI} new)`);

    return {
      videos: allVideos,
      fromCache: totalFromCache,
      fromAPI: totalFromAPI,
      pageTokens: newPageTokens,
      hasMore,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch videos from a YouTube channel
 * Automatically makes multiple API calls to reach desired maxResults (since YouTube API has 50/request limit)
 */
export async function fetchChannelVideos(
  channelUrl: string,
  apiKey: string,
  pageToken?: string,
  maxResults: number = 50,
  minDurationMinutes: number = 27
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string; totalResults: number }> {
  try {
    if (!apiKey) {
      throw new Error('YouTube API key is missing');
    }

    if (!channelUrl) {
      throw new Error('Channel URL is missing');
    }

    // Extract channel identifier from URL
    let channelId = extractChannelId(channelUrl);

    if (!channelId) {
      throw new Error('Invalid YouTube channel URL');
    }

    // Resolve to channel ID if needed
    if (!channelId.startsWith('UC')) {
      channelId = await resolveChannelId(channelId, apiKey);
    }

    // Get uploads playlist ID
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId, apiKey);

    // Make multiple API calls to reach maxResults (since YouTube API limit is 50 per request)
    const allVideos: YouTubeVideo[] = [];
    let currentPageToken = pageToken;
    let totalResults = 0;
    const requestsNeeded = Math.ceil(maxResults / 50); // e.g., 200/50 = 4 requests

    for (let i = 0; i < requestsNeeded; i++) {
      // Fetch videos from uploads playlist (max 50 per request)
      const playlistResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        {
          params: {
            key: apiKey,
            playlistId: uploadsPlaylistId,
            part: 'snippet',
            maxResults: 50, // YouTube API max limit
            pageToken: currentPageToken,
          },
        }
      );

      // Get video IDs for details
      const videoIds = playlistResponse.data.items
        .map((item: any) => item.snippet.resourceId.videoId)
        .join(',');

      // Fetch video details (duration, views)
      const detailsResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            key: apiKey,
            id: videoIds,
            part: 'contentDetails,statistics',
          },
        }
      );

      // Combine data
      const videos: YouTubeVideo[] = playlistResponse.data.items
        .map((item: any) => {
          const videoId = item.snippet.resourceId.videoId;
          const details = detailsResponse.data.items.find(
            (d: any) => d.id === videoId
          );

          if (!details) return null;

          const durationSeconds = parseDuration(details.contentDetails.duration);
          const viewCount = details.statistics.viewCount;

          return {
            videoId: videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            publishedAt: item.snippet.publishedAt,
            channelTitle: item.snippet.channelTitle,
            description: item.snippet.description,
            duration: formatDuration(durationSeconds),
            durationSeconds,
            viewCount: parseInt(viewCount, 10).toLocaleString(),
          };
        })
        .filter((video: YouTubeVideo | null): video is YouTubeVideo => {
          // Filter: only videos >= minDurationMinutes
          return video !== null && video.durationSeconds >= minDurationMinutes * 60;
        });

      allVideos.push(...videos);
      totalResults = playlistResponse.data.pageInfo.totalResults;
      currentPageToken = playlistResponse.data.nextPageToken;

      // Stop if no more pages or we've reached desired count
      if (!currentPageToken || allVideos.length >= maxResults) {
        break;
      }
    }

    return {
      videos: allVideos,
      nextPageToken: currentPageToken,
      totalResults: totalResults,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded or invalid API key. Please check your YouTube API key in settings.');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid channel URL or API request. Please check your channel URL.');
      }
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }
    throw error;
  }
}
