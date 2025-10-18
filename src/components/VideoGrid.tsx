import { useState, useEffect } from 'react';
import { Play, CheckCircle, Loader2, Eye, Clock, Send, Search, X } from 'lucide-react';
import { fetchLatestVideosWithCache, loadMoreChannelVideos, YouTubeVideo } from '../services/youtubeAPI';
import { getCachedVideos, mergeVideos, getCachedPageToken } from '../utils/videoCache';
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { TargetChannelSelectModal } from './TargetChannelSelectModal';

interface VideoGridProps {
  onVideoSelect: (videoUrl: string, videoTitle?: string, videoIndex?: number, totalVideos?: number, channelTitle?: string, targetChannelId?: string, targetChannelName?: string) => void;
  onBatchSelect?: (videos: Array<{
    url: string;
    title: string;
    channelTitle?: string;
    targetChannelId?: string;
    targetChannelName?: string;
  }>) => void;
  onVideosLoaded?: (videos: YouTubeVideo[]) => void;
  onPushToChat?: () => void;
  skipTargetChannelSelection?: boolean; // Skip target channel modal (for Shorts Finder)
}

export default function VideoGrid({ onVideoSelect, onBatchSelect, onVideosLoaded, onPushToChat, skipTargetChannelSelection = false }: VideoGridProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { isLinkProcessed } = useHistoryStore();
  const { getQueueCount } = useTempQueueStore();

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [cacheStats, setCacheStats] = useState<{ fromCache: number; fromAPI: number }>({ fromCache: 0, fromAPI: 0 });
  const [pageTokens, setPageTokens] = useState<Map<string, string | undefined>>(new Map());
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Target Channel Selection
  const [showTargetChannelModal, setShowTargetChannelModal] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<YouTubeVideo | null>(null);
  const [pendingBatchVideos, setPendingBatchVideos] = useState<YouTubeVideo[]>([]);

  // Load cached videos only (no API call)
  const loadCachedVideos = () => {
    if (settings.channelUrls.length === 0) {
      return;
    }

    console.log('📦 Loading cached videos only...');

    // Load all cached videos AND pageTokens from all channels
    const allCachedVideos: YouTubeVideo[] = [];
    const cachedPageTokens = new Map<string, string | undefined>();

    settings.channelUrls.forEach(channelUrl => {
      const cached = getCachedVideos(channelUrl);
      const pageToken = getCachedPageToken(channelUrl);

      console.log(`🔑 Cached pageToken for ${channelUrl}:`, pageToken ? `"${pageToken.substring(0, 20)}..."` : 'undefined');

      allCachedVideos.push(...cached);
      cachedPageTokens.set(channelUrl, pageToken);
    });

    // Sort by published date (newest first)
    allCachedVideos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    setVideos(allCachedVideos);
    setCacheStats({ fromCache: allCachedVideos.length, fromAPI: 0 });

    // Set cached pageTokens so Load More can continue from where cache left off
    setPageTokens(cachedPageTokens);

    // Enable Load More button (assume more videos available)
    setHasMoreVideos(true);

    if (onVideosLoaded) onVideosLoaded(allCachedVideos);

    console.log(`✓ Loaded ${allCachedVideos.length} cached videos with pageTokens`);
  };

  // Fetch new videos from API and merge with cache
  const loadVideos = async () => {
    if (!settings.youtubeApiKey || settings.channelUrls.length === 0) {
      setError('Please set YouTube API key and at least one Channel URL in settings');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('📦 Loading videos with smart caching...');

      // Use smart cached API - auto-detects new vs existing channels!
      // New channels: 200 videos, Existing: 10 latest videos
      const result = await fetchLatestVideosWithCache(
        settings.channelUrls,
        settings.youtubeApiKey
      );

      setVideos(result.videos);
      setCacheStats({ fromCache: result.fromCache, fromAPI: result.fromAPI });
      setPageTokens(result.pageTokens);
      setHasMoreVideos(result.hasMore);

      if (onVideosLoaded) onVideosLoaded(result.videos);

      console.log(`✓ Loaded ${result.videos.length} total videos`);
      console.log(`  📦 From cache: ${result.fromCache} videos`);
      console.log(`  🌐 From API: ${result.fromAPI} new videos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (!settings.youtubeApiKey || settings.channelUrls.length === 0) {
      return;
    }

    if (!hasMoreVideos || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      console.log('📄 Loading more videos from cached position...');

      const result = await loadMoreChannelVideos(
        settings.channelUrls,
        settings.youtubeApiKey,
        pageTokens, // Use pageTokens from cache (already set in loadCachedVideos)
        200 // Load 200 more videos
      );

      // Merge with existing videos (removes duplicates by videoId)
      const mergedVideos = mergeVideos(videos, result.videos);
      setVideos(mergedVideos);
      setPageTokens(result.pageTokens);
      setHasMoreVideos(result.hasMore);

      if (onVideosLoaded) onVideosLoaded(mergedVideos);

      const newVideosCount = mergedVideos.length - videos.length;
      console.log(`✓ Loaded ${newVideosCount} new unique videos (total: ${mergedVideos.length})`);
    } catch (err) {
      console.error('Error loading more videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  };

  // Load cached videos on mount (no API call)
  useEffect(() => {
    if (settings.channelUrls.length > 0) {
      loadCachedVideos();
    }
  }, [JSON.stringify(settings.channelUrls)]);


  const handleVideoClick = (video: YouTubeVideo) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    // Skip target channel selection if requested (e.g., for Shorts Finder)
    if (skipTargetChannelSelection) {
      onVideoSelect(videoUrl, video.title, undefined, undefined, video.channelTitle);
      return;
    }

    // Check if target channels are configured
    if (settings.targetChannels.length === 0) {
      // No target channels configured, process without selecting
      onVideoSelect(videoUrl, video.title, undefined, undefined, video.channelTitle);
      return;
    }

    // Show target channel selection modal
    setPendingVideo(video);
    setShowTargetChannelModal(true);
  };

  const handleTargetChannelSelect = (targetChannelId: string, targetChannelName: string) => {
    if (!pendingVideo) return;

    const videoUrl = `https://www.youtube.com/watch?v=${pendingVideo.videoId}`;

    // Check if this is batch processing
    if (pendingBatchVideos.length > 0) {
      // Prepare remaining videos for batch with selected target channel
      const remainingVideos = pendingBatchVideos.map(video => ({
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        title: video.title,
        channelTitle: video.channelTitle,
        targetChannelId: targetChannelId,
        targetChannelName: targetChannelName,
      }));

      // Send remaining videos to parent if callback exists
      if (onBatchSelect && remainingVideos.length > 0) {
        onBatchSelect(remainingVideos);
      }

      // Clear selection
      setSelectedVideos(new Set());

      // Process first video with selected target channel
      onVideoSelect(
        videoUrl,
        pendingVideo.title,
        1,
        pendingBatchVideos.length + 1,
        pendingVideo.channelTitle,
        targetChannelId,
        targetChannelName
      );

      // Clear batch
      setPendingBatchVideos([]);
    } else {
      // Single video processing
      onVideoSelect(videoUrl, pendingVideo.title, undefined, undefined, pendingVideo.channelTitle, targetChannelId, targetChannelName);
    }

    // Clear pending video
    setPendingVideo(null);
  };

  const isProcessed = (videoId: string): boolean => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return isLinkProcessed(videoUrl);
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleProcessSelected = () => {
    if (selectedVideos.size === 0) {
      console.log('⚠️ Please select at least one video');
      return;
    }

    // Get selected video objects (already sorted by API based on settings.videoSortOrder)
    const videosToProcess = videos.filter(v => selectedVideos.has(v.videoId));

    // Check if target channels are configured
    if (settings.targetChannels.length === 0) {
      // No target channels, process directly
      processVideosSequentially(videosToProcess);
    } else {
      // Show modal for first video, store rest as pending batch
      setPendingBatchVideos(videosToProcess.slice(1));
      setPendingVideo(videosToProcess[0]);
      setShowTargetChannelModal(true);
    }
  };

  const processVideosSequentially = async (videosToProcess: YouTubeVideo[]) => {
    if (videosToProcess.length === 0) return;

    // Process only the first video
    const firstVideo = videosToProcess[0];
    const firstVideoUrl = `https://www.youtube.com/watch?v=${firstVideo.videoId}`;

    // Prepare remaining videos for batch
    const firstTargetChannel = settings.targetChannels[0];
    const remainingVideos = videosToProcess.slice(1).map(video => ({
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      title: video.title,
      channelTitle: video.channelTitle,
      targetChannelId: firstTargetChannel?.id,
      targetChannelName: firstTargetChannel?.name,
    }));

    // Send remaining videos to parent if callback exists
    if (onBatchSelect && remainingVideos.length > 0) {
      onBatchSelect(remainingVideos);
    }

    // Clear selection
    setSelectedVideos(new Set());

    // Process first video (for batch, we'll use first target channel or skip target selection)
    console.log(`Processing video 1 of ${videosToProcess.length}: ${firstVideo.title}`);

    // For batch processing, use first target channel if available, otherwise process without
    await onVideoSelect(
      firstVideoUrl,
      firstVideo.title,
      1,
      videosToProcess.length,
      firstVideo.channelTitle,
      firstTargetChannel?.id,
      firstTargetChannel?.name
    );
  };

  // Get unique channel names
  const uniqueChannels = Array.from(new Set(videos.map(v => v.channelTitle))).sort();

  // Helper function to parse duration string (e.g., "27:35" -> 27.58 minutes)
  const parseDuration = (duration: string): number => {
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] + parts[1] / 60;
    }
    return 0;
  };

  // Filter and sort videos
  const displayVideos = videos
    .filter(video => {
      // Hide processed videos from homepage (only show in history)
      if (isProcessed(video.videoId)) {
        return false;
      }

      // Search filter - matches against title and channel name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = video.title.toLowerCase().includes(query);
        const channelMatch = video.channelTitle.toLowerCase().includes(query);

        if (!titleMatch && !channelMatch) {
          return false;
        }
      }

      // Channel filter
      if (selectedChannel !== 'all' && video.channelTitle !== selectedChannel) {
        return false;
      }

      // Duration filter based on channel-specific settings
      // Get min duration for this video's channel by finding matching URL
      // Match by checking if channel URL contains the video's channelId
      let minDurationForChannel = 1; // Default to 1 minute
      let matchedChannel = false;

      for (const [channelUrl, minDuration] of Object.entries(settings.channelMinDurations)) {
        // Match by channelId (most reliable)
        if (video.channelId && channelUrl.includes(video.channelId)) {
          minDurationForChannel = minDuration;
          matchedChannel = true;
          break;
        }
      }

      const videoDurationMinutes = parseDuration(video.duration);
      const passesFilter = videoDurationMinutes >= minDurationForChannel;

      // Debug logging for filtered out videos
      if (!passesFilter && matchedChannel) {
        console.log(`⏱️ Filtered out: "${video.title}" (${video.duration} = ${videoDurationMinutes.toFixed(1)} min < ${minDurationForChannel} min required)`);
      }

      return passesFilter;
    })
    .sort((a, b) => {
      if (settings.videoSortOrder === 'popular') {
        // Sort by view count (highest first)
        const viewsA = parseInt(a.viewCount.replace(/,/g, ''), 10);
        const viewsB = parseInt(b.viewCount.replace(/,/g, ''), 10);
        return viewsB - viewsA;
      } else {
        // Sort by date (newest first)
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
    });

  if (!settings.youtubeApiKey || settings.channelUrls.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-700 rounded-lg p-6 text-center">
          <p className="text-yellow-800 dark:text-yellow-200 text-lg font-semibold mb-2">
            Channel Videos Not Configured
          </p>
          <p className="text-yellow-700 dark:text-yellow-300">
            Please add your YouTube API key and at least one Channel URL in settings to browse videos
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600 dark:text-gray-400">Loading videos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-800 dark:text-red-200 text-lg font-semibold mb-2">
            Error Loading Videos
          </p>
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={() => loadVideos()}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        {/* Title Section */}
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">
            Channel Videos
            {selectedChannel !== 'all' && (() => {
              const channelUrl = Object.keys(settings.channelMinDurations).find(url => url.includes(selectedChannel));
              const minDur = channelUrl ? settings.channelMinDurations[channelUrl] : 1;
              return ` (${minDur}+ min)`;
            })()}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {settings.channelUrls.length} channel(s) • {videos.length} total videos ({cacheStats.fromCache} cached, {cacheStats.fromAPI} new) • Showing {displayVideos.length} unprocessed
            {selectedVideos.size > 0 && ` • ${selectedVideos.size} selected`}
          </p>
        </div>

        {/* Search and Filters Row */}
        <div className="flex flex-col gap-3">
          {/* Search Input - Full Width on Mobile */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Buttons Row - Scrollable on Mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {/* Channel Filter Dropdown */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="flex-shrink-0 px-3 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-blue-500 dark:hover:border-blue-400 transition-colors font-medium text-sm cursor-pointer"
            >
              <option value="all">All Channels ({videos.length})</option>
              {uniqueChannels.map((channel) => {
                const count = videos.filter(v => v.channelTitle === channel).length;
                return (
                  <option key={channel} value={channel}>
                    {channel} ({count})
                  </option>
                );
              })}
            </select>

            <button
              onClick={() => updateSettings({ videoSortOrder: settings.videoSortOrder === 'popular' ? 'date' : 'popular' })}
              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap ${
                settings.videoSortOrder === 'popular'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {settings.videoSortOrder === 'popular' ? '✓ Popular' : 'Sort by Date'}
            </button>
            <button
              onClick={() => loadVideos()}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
              Refresh
            </button>

            {/* Push to Chat Button */}
            {onPushToChat && getQueueCount() > 0 && (
              <button
                onClick={onPushToChat}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm relative whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>Push to Chat</span>
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {getQueueCount()}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Selection Actions */}
        {selectedVideos.size > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-blue-500 mt-4">
            <button
              onClick={handleProcessSelected}
              className="w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              Process {selectedVideos.size} Video{selectedVideos.size > 1 ? 's' : ''}
            </button>
            <button
              onClick={() => setSelectedVideos(new Set())}
              className="w-full sm:w-auto px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Clear Selection
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 sm:ml-auto text-center sm:text-left">
              Videos will be processed one by one
            </span>
          </div>
        )}
      </div>

      {/* Load More Button - Top */}
      {videos.length > 0 && hasMoreVideos && (
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={loadMoreVideos}
            disabled={loadingMore}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-base sm:text-lg shadow-lg"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading More...
              </>
            ) : (
              <>
                Load More Videos (200 per channel)
                <span className="hidden sm:inline text-sm opacity-75 ml-2">({videos.length} loaded)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {displayVideos.map((video) => {
          const processed = isProcessed(video.videoId);
          const isSelected = selectedVideos.has(video.videoId);

          return (
            <div
              key={video.videoId}
              className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 ${
                isSelected ? 'border-green-500 ring-4 ring-green-200 dark:ring-green-900' : 'border-transparent hover:border-blue-500'
              } group relative`}
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-video bg-gray-200 dark:bg-gray-700 cursor-pointer"
                onClick={() => handleVideoClick(video)}
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Selection Checkbox */}
                <div
                  className="absolute top-2 left-2 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVideoSelection(video.videoId);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-6 h-6 cursor-pointer"
                  />
                </div>

                {/* Processed Badge */}
                {processed && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-lg z-10 pointer-events-none">
                    <CheckCircle className="w-4 h-4" />
                    Processed
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-90 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 z-10 pointer-events-none">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </div>

                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center pointer-events-none">
                  <Play className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {video.title}
                </h3>
                <div className="mb-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs font-medium inline-block">
                  {video.channelTitle}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{video.viewCount} views</span>
                  </div>
                  <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cache info */}
      {videos.length > 0 && !loading && (
        <div className="text-center mt-8 text-gray-600 dark:text-gray-400">
          <p className="text-sm">
            💾 Smart caching enabled • New channels: 200 videos • Existing channels: 10 latest • Drastically reduced API usage
          </p>
        </div>
      )}

      {/* Target Channel Selection Modal */}
      {pendingVideo && (
        <TargetChannelSelectModal
          isOpen={showTargetChannelModal}
          onClose={() => {
            setShowTargetChannelModal(false);
            setPendingVideo(null);
          }}
          videoUrl={`https://www.youtube.com/watch?v=${pendingVideo.videoId}`}
          videoTitle={pendingVideo.title}
          onSelectChannel={handleTargetChannelSelect}
        />
      )}
    </div>
  );
}
