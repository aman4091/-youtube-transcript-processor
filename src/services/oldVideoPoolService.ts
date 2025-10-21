// =====================================================
// Old Video Pool Service
// Manages old videos from source channel for scheduling
// =====================================================

import axios from 'axios';
import { supabase } from './supabaseClient';
import type {
  VideoPoolOld,
  VideoSelectionCriteria,
  UniquenessCheckResult,
} from '../types/scheduling';

// ============= Fetch Videos from YouTube =============

interface YouTubeVideo {
  videoId: string;
  title: string;
  duration: number; // seconds
  viewCount: number;
  publishedAt: string;
}

/**
 * Fetch old videos from source channel via YouTube API
 */
export async function fetchOldVideosFromYouTube(
  channelUrl: string,
  youtubeApiKey: string,
  maxResults: number = 200,
  minDuration: number = 27 * 60 // 27 minutes in seconds
): Promise<YouTubeVideo[]> {
  try {
    console.log(`[OldVideoPool] Fetching old videos from: ${channelUrl}`);

    // Extract channel ID from URL
    const channelId = extractChannelId(channelUrl);
    if (!channelId) {
      throw new Error('Invalid channel URL');
    }

    // Step 1: Get channel's uploads playlist ID
    const channelResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels`,
      {
        params: {
          part: 'contentDetails',
          id: channelId,
          key: youtubeApiKey,
        },
      }
    );

    const uploadsPlaylistId =
      channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist');
    }

    // Step 2: Fetch videos from uploads playlist (paginated)
    const allVideos: YouTubeVideo[] = [];
    let pageToken: string | null = null;
    let fetchedCount = 0;

    while (fetchedCount < maxResults) {
      const playlistResponse: any = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlistItems`,
        {
          params: {
            part: 'snippet',
            playlistId: uploadsPlaylistId,
            maxResults: Math.min(50, maxResults - fetchedCount),
            pageToken: pageToken || undefined,
            key: youtubeApiKey,
          },
        }
      );

      const videoIds = playlistResponse.data.items?.map(
        (item: any) => item.snippet.resourceId.videoId
      );

      if (!videoIds || videoIds.length === 0) break;

      // Step 3: Get video details (duration, views, etc.)
      const videosResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoIds.join(','),
            key: youtubeApiKey,
          },
        }
      );

      // Parse and filter videos
      const videos = videosResponse.data.items
        .map((item: any) => {
          const durationSeconds = parseDuration(item.contentDetails.duration);
          return {
            videoId: item.id,
            title: item.snippet.title,
            duration: durationSeconds,
            viewCount: parseInt(item.statistics.viewCount || '0', 10),
            publishedAt: item.snippet.publishedAt,
          };
        })
        .filter((video: YouTubeVideo) => video.duration >= minDuration);

      allVideos.push(...videos);
      fetchedCount += videoIds.length;

      // Check for next page
      pageToken = playlistResponse.data.nextPageToken;
      if (!pageToken) break;

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(
      `[OldVideoPool] Fetched ${allVideos.length} videos (27+ min) from ${fetchedCount} total`
    );

    // Sort by view count (descending)
    allVideos.sort((a, b) => b.viewCount - a.viewCount);

    return allVideos;
  } catch (error: any) {
    console.error('[OldVideoPool] Error fetching videos:', error.message);
    throw new Error(`Failed to fetch old videos: ${error.message}`);
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
 * Extract channel ID from YouTube URL
 */
function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ============= Database Operations =============

/**
 * Add videos to old video pool
 */
export async function addVideosToOldPool(
  videos: YouTubeVideo[],
  sourceChannelId: string,
  sourceChannelName: string
): Promise<{ added: number; existing: number }> {
  try {
    let added = 0;
    let existing = 0;

    for (const video of videos) {
      // Check if video already exists
      const { data: existingVideo } = await supabase
        .from('video_pool_old')
        .select('id')
        .eq('video_id', video.videoId)
        .single();

      if (existingVideo) {
        existing++;
        continue;
      }

      // Insert new video
      const { error } = await supabase.from('video_pool_old').insert({
        video_id: video.videoId,
        title: video.title,
        duration: video.duration,
        view_count: video.viewCount,
        published_at: video.publishedAt,
        source_channel_id: sourceChannelId,
        source_channel_name: sourceChannelName,
        status: 'active',
      });

      if (error) {
        console.error(
          `[OldVideoPool] Error inserting video ${video.videoId}:`,
          error.message
        );
        continue;
      }

      added++;
    }

    console.log(`[OldVideoPool] Added ${added} new videos, ${existing} already exist`);

    return { added, existing };
  } catch (error: any) {
    console.error('[OldVideoPool] Error adding videos to pool:', error.message);
    throw error;
  }
}

/**
 * Get available old videos (for scheduling)
 * Applies uniqueness rules and returns sorted by views
 */
export async function getAvailableOldVideos(
  criteria: VideoSelectionCriteria
): Promise<VideoPoolOld[]> {
  try {
    const { excludeVideoIds, count } = criteria;

    // Query active videos, sorted by view count
    let query = supabase
      .from('video_pool_old')
      .select('*')
      .eq('status', 'active')
      .not('video_id', 'in', `(${excludeVideoIds.join(',') || 'NULL'})`)
      .order('view_count', { ascending: false })
      .limit(count * 3); // Fetch more to allow for uniqueness filtering

    const { data: videos, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }

    if (!videos || videos.length === 0) {
      console.warn('[OldVideoPool] No available old videos found');
      return [];
    }

    console.log(
      `[OldVideoPool] Found ${videos.length} candidate videos (before uniqueness check)`
    );

    return videos.slice(0, count);
  } catch (error: any) {
    console.error('[OldVideoPool] Error getting available videos:', error.message);
    throw error;
  }
}

/**
 * Check if a video is eligible for scheduling on a specific channel
 * Enforces 15-day same channel, 10-day cross channel rules
 */
export async function checkVideoEligibility(
  videoId: string,
  channelId: string,
  scheduleDate: string = new Date().toISOString().split('T')[0]
): Promise<UniquenessCheckResult> {
  try {
    // Check last usage on same channel (15 day rule)
    const { data: sameChannelUsage } = await supabase
      .from('video_usage_tracker')
      .select('used_date')
      .eq('video_id', videoId)
      .eq('target_channel_id', channelId)
      .order('used_date', { ascending: false })
      .limit(1)
      .single();

    if (sameChannelUsage) {
      const lastUsedDate = new Date(sameChannelUsage.used_date);
      const currentDate = new Date(scheduleDate);
      const daysDiff = Math.floor(
        (currentDate.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff < 15) {
        return {
          eligible: false,
          reason: `Used ${daysDiff} days ago on same channel (minimum 15 days)`,
          lastUsedDate: sameChannelUsage.used_date,
          daysAgo: daysDiff,
          channelId,
        };
      }
    }

    // Check last usage on other channels (10 day rule)
    const { data: crossChannelUsages } = await supabase
      .from('video_usage_tracker')
      .select('used_date, target_channel_id')
      .eq('video_id', videoId)
      .neq('target_channel_id', channelId)
      .order('used_date', { ascending: false })
      .limit(5);

    if (crossChannelUsages && crossChannelUsages.length > 0) {
      for (const usage of crossChannelUsages) {
        const lastUsedDate = new Date(usage.used_date);
        const currentDate = new Date(scheduleDate);
        const daysDiff = Math.floor(
          (currentDate.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff < 10) {
          return {
            eligible: false,
            reason: `Used ${daysDiff} days ago on channel ${usage.target_channel_id} (minimum 10 days cross-channel)`,
            lastUsedDate: usage.used_date,
            daysAgo: daysDiff,
            channelId: usage.target_channel_id,
          };
        }
      }
    }

    return {
      eligible: true,
    };
  } catch (error: any) {
    console.error('[OldVideoPool] Error checking eligibility:', error.message);
    // If error, return eligible to not block the system
    return {
      eligible: true,
      reason: 'Error checking eligibility, allowing video',
    };
  }
}

/**
 * Mark video as used (updates usage tracker and pool)
 */
export async function markVideoAsUsed(
  videoId: string,
  usedDate: string,
  channelId: string,
  channelName: string
): Promise<void> {
  try {
    // Add to usage tracker
    const { error: trackerError } = await supabase
      .from('video_usage_tracker')
      .insert({
        video_id: videoId,
        used_date: usedDate,
        target_channel_id: channelId,
        target_channel_name: channelName,
      });

    if (trackerError && !trackerError.message.includes('duplicate')) {
      console.error('[OldVideoPool] Error adding to usage tracker:', trackerError.message);
    }

    // Update video pool - increment times_scheduled
    const { data: currentData } = await supabase
      .from('video_pool_old')
      .select('times_scheduled')
      .eq('video_id', videoId)
      .single();

    const { error: poolError } = await supabase
      .from('video_pool_old')
      .update({
        times_scheduled: (currentData?.times_scheduled || 0) + 1,
        last_scheduled_date: usedDate,
      })
      .eq('video_id', videoId);

    if (poolError) {
      console.error('[OldVideoPool] Error updating pool:', poolError.message);
    }

    console.log(`[OldVideoPool] Marked video ${videoId} as used on ${usedDate}`);
  } catch (error: any) {
    console.error('[OldVideoPool] Error marking video as used:', error.message);
  }
}

/**
 * Mark exhausted videos (scheduled too many times)
 */
export async function markExhaustedVideos(threshold: number = 10): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('video_pool_old')
      .update({ status: 'exhausted' })
      .gte('times_scheduled', threshold)
      .eq('status', 'active')
      .select('id');

    if (error) {
      throw new Error(`Failed to mark exhausted videos: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log(`[OldVideoPool] Marked ${count} videos as exhausted`);

    return count;
  } catch (error: any) {
    console.error('[OldVideoPool] Error marking exhausted videos:', error.message);
    return 0;
  }
}

/**
 * Get pool statistics
 */
export async function getOldPoolStats(): Promise<{
  total: number;
  active: number;
  exhausted: number;
  avgViews: number;
  avgTimesScheduled: number;
}> {
  try {
    const { data, error } = await supabase.from('video_pool_old').select('*');

    if (error || !data) {
      return {
        total: 0,
        active: 0,
        exhausted: 0,
        avgViews: 0,
        avgTimesScheduled: 0,
      };
    }

    const active = data.filter((v) => v.status === 'active').length;
    const exhausted = data.filter((v) => v.status === 'exhausted').length;
    const avgViews =
      data.reduce((sum, v) => sum + v.view_count, 0) / (data.length || 1);
    const avgTimesScheduled =
      data.reduce((sum, v) => sum + v.times_scheduled, 0) / (data.length || 1);

    return {
      total: data.length,
      active,
      exhausted,
      avgViews: Math.round(avgViews),
      avgTimesScheduled: Math.round(avgTimesScheduled * 10) / 10,
    };
  } catch (error: any) {
    console.error('[OldVideoPool] Error getting stats:', error.message);
    return {
      total: 0,
      active: 0,
      exhausted: 0,
      avgViews: 0,
      avgTimesScheduled: 0,
    };
  }
}

/**
 * Refresh old video pool (fetch new videos from YouTube)
 */
export async function refreshOldVideoPool(
  sourceChannelUrl: string,
  sourceChannelId: string,
  sourceChannelName: string,
  youtubeApiKey: string,
  maxVideos: number = 200
): Promise<{ added: number; existing: number; exhausted: number }> {
  try {
    console.log('[OldVideoPool] Starting pool refresh...');

    // Step 1: Fetch videos from YouTube
    const videos = await fetchOldVideosFromYouTube(
      sourceChannelUrl,
      youtubeApiKey,
      maxVideos
    );

    // Step 2: Add to database
    const { added, existing } = await addVideosToOldPool(
      videos,
      sourceChannelId,
      sourceChannelName
    );

    // Step 3: Mark exhausted videos
    const exhausted = await markExhaustedVideos();

    // Step 4: Update config
    await supabase
      .from('schedule_config')
      .update({ last_pool_refresh_date: new Date().toISOString().split('T')[0] })
      .eq('user_id', 'default_user');

    console.log(
      `[OldVideoPool] Refresh complete: ${added} added, ${existing} existing, ${exhausted} exhausted`
    );

    return { added, existing, exhausted };
  } catch (error: any) {
    console.error('[OldVideoPool] Error refreshing pool:', error.message);
    throw error;
  }
}
