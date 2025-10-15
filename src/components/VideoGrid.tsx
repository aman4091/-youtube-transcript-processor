import { useState, useEffect } from 'react';
import { Play, CheckCircle, Loader2, Eye, Clock, Send } from 'lucide-react';
import { fetchMultipleChannelsVideos, YouTubeVideo } from '../services/youtubeAPI';
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';
import { useTempQueueStore } from '../stores/tempQueueStore';

interface VideoGridProps {
  onVideoSelect: (videoUrl: string, videoTitle?: string, videoIndex?: number, totalVideos?: number, channelTitle?: string) => void;
  onBatchSelect?: (videos: Array<{ url: string; title: string }>) => void;
  onVideosLoaded?: (videos: YouTubeVideo[]) => void;
  onPushToChat?: () => void;
}

export default function VideoGrid({ onVideoSelect, onBatchSelect, onVideosLoaded, onPushToChat }: VideoGridProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { isLinkProcessed } = useHistoryStore();
  const { getQueueCount } = useTempQueueStore();

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [pageTokens, setPageTokens] = useState<Map<string, string | undefined>>(new Map());
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  const loadVideos = async (append: boolean = false) => {
    if (!settings.youtubeApiKey || settings.channelUrls.length === 0) {
      setError('Please set YouTube API key and at least one Channel URL in settings');
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setPageTokens(new Map()); // Reset tokens on fresh load
    }
    setError('');

    try {
      // Calculate minimum duration needed (use the smallest one among all channels, or 1 if none set)
      const minDurations = settings.channelUrls.map(
        (url) => settings.channelMinDurations[url] || 1
      );
      const minDuration = Math.min(...minDurations, ...minDurations.length > 0 ? minDurations : [1]);

      const result = await fetchMultipleChannelsVideos(
        settings.channelUrls,
        settings.youtubeApiKey,
        append ? pageTokens : new Map(),
        200, // Load 200 videos per page
        minDuration // Use calculated minimum duration (no hardcoded 27)
        // Note: Sorting is done client-side in displayVideos
      );

      if (append) {
        const newVideos = [...videos, ...result.videos];
        setVideos(newVideos);
        setTotalLoaded((prev) => prev + result.videos.length);
        if (onVideosLoaded) onVideosLoaded(newVideos);
      } else {
        setVideos(result.videos);
        setTotalLoaded(result.videos.length);
        if (onVideosLoaded) onVideosLoaded(result.videos);
      }

      setPageTokens(result.pageTokens);
      setHasMoreVideos(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      if (!append) {
        setVideos([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMoreVideos && !loadingMore) {
      loadVideos(true);
    }
  };

  useEffect(() => {
    if (settings.youtubeApiKey && settings.channelUrls.length > 0) {
      loadVideos();
    }
  }, [settings.youtubeApiKey, JSON.stringify(settings.channelUrls)]);


  const handleVideoClick = (video: YouTubeVideo) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    onVideoSelect(videoUrl, video.title, undefined, undefined, video.channelTitle);
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
      alert('Please select at least one video');
      return;
    }

    // Get selected video objects (already sorted by API based on settings.videoSortOrder)
    const videosToProcess = videos.filter(v => selectedVideos.has(v.videoId));

    // Process videos sequentially
    processVideosSequentially(videosToProcess);
  };

  const processVideosSequentially = async (videosToProcess: YouTubeVideo[]) => {
    if (videosToProcess.length === 0) return;

    // Process only the first video
    const firstVideo = videosToProcess[0];
    const firstVideoUrl = `https://www.youtube.com/watch?v=${firstVideo.videoId}`;

    // Prepare remaining videos for batch
    const remainingVideos = videosToProcess.slice(1).map(video => ({
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      title: video.title,
    }));

    // Send remaining videos to parent if callback exists
    if (onBatchSelect && remainingVideos.length > 0) {
      onBatchSelect(remainingVideos);
    }

    // Clear selection
    setSelectedVideos(new Set());

    // Process first video
    console.log(`Processing video 1 of ${videosToProcess.length}: ${firstVideo.title}`);
    await onVideoSelect(firstVideoUrl, firstVideo.title, 1, videosToProcess.length, firstVideo.channelTitle);
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
      // Channel filter
      if (selectedChannel !== 'all' && video.channelTitle !== selectedChannel) {
        return false;
      }

      // Duration filter based on channel-specific settings
      // Get min duration for this video's channel by matching channel title
      const matchingChannelUrl = Object.keys(settings.channelMinDurations).find(
        url => url.includes(video.channelTitle)
      );
      const minDurationForChannel = matchingChannelUrl
        ? settings.channelMinDurations[matchingChannelUrl]
        : 1; // Default to 1 minute if not configured (no hardcoded 27)

      const videoDurationMinutes = parseDuration(video.duration);
      return videoDurationMinutes >= minDurationForChannel;
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
    <div className="w-full max-w-[98%] mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2 truncate">
              Channel Videos
              {selectedChannel !== 'all' && (() => {
                const channelUrl = Object.keys(settings.channelMinDurations).find(url => url.includes(selectedChannel));
                const minDur = channelUrl ? settings.channelMinDurations[channelUrl] : 1;
                return ` (${minDur}+ min)`;
              })()}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              {settings.channelUrls.length} channel(s) • Showing {displayVideos.length} of {totalLoaded} videos
              {selectedVideos.size > 0 && ` • ${selectedVideos.size} selected`}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            {/* Channel Filter Dropdown */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="px-3 sm:px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-blue-500 dark:hover:border-blue-400 transition-colors font-medium text-xs sm:text-sm cursor-pointer"
            >
              <option value="all">All Channels ({totalLoaded})</option>
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
              className={`px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium text-xs sm:text-sm ${
                settings.videoSortOrder === 'popular'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {settings.videoSortOrder === 'popular' ? '✓ Popular' : 'Sort by Date'}
            </button>
            <button
              onClick={() => loadVideos()}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
            >
              Refresh
            </button>

            {/* Push to Chat Button */}
            {onPushToChat && getQueueCount() > 0 && (
              <button
                onClick={onPushToChat}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-xs sm:text-sm relative"
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-blue-500">
            <button
              onClick={handleProcessSelected}
              className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-xs sm:text-sm"
            >
              Process {selectedVideos.size} Video{selectedVideos.size > 1 ? 's' : ''}
            </button>
            <button
              onClick={() => setSelectedVideos(new Set())}
              className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm"
            >
              Clear
            </button>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 sm:ml-auto break-words">
              Videos will be processed one by one
            </span>
          </div>
        )}
      </div>

      {/* Load More Button - Top */}
      {videos.length > 0 && hasMoreVideos && (
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg shadow-lg"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading More...
              </>
            ) : (
              <>
                Load More Videos
                <span className="text-sm opacity-75">({totalLoaded} loaded)</span>
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

      {/* No more videos message */}
      {videos.length > 0 && !hasMoreVideos && !loading && (
        <div className="text-center mt-8 text-gray-600 dark:text-gray-400">
          <p className="text-lg font-medium">All videos loaded from {settings.channelUrls.length} channel(s)! ({totalLoaded} total)</p>
        </div>
      )}
    </div>
  );
}
