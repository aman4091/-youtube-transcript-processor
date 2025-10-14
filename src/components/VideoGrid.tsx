import { useState, useEffect } from 'react';
import { Play, CheckCircle, Loader2, Eye, Clock } from 'lucide-react';
import { fetchMultipleChannelsVideos, YouTubeVideo } from '../services/youtubeAPI';
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';

interface VideoGridProps {
  onVideoSelect: (videoUrl: string, videoTitle?: string, videoIndex?: number, totalVideos?: number, channelTitle?: string) => void;
  onBatchSelect?: (videos: Array<{ url: string; title: string }>) => void;
  onVideosLoaded?: (videos: YouTubeVideo[]) => void;
}

export default function VideoGrid({ onVideoSelect, onBatchSelect, onVideosLoaded }: VideoGridProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { isLinkProcessed } = useHistoryStore();

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [pageTokens, setPageTokens] = useState<Map<string, string | undefined>>(new Map());
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

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
      const result = await fetchMultipleChannelsVideos(
        settings.channelUrls,
        settings.youtubeApiKey,
        append ? pageTokens : new Map(),
        50,
        27 // Minimum 27 minutes
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

  // Sort videos client-side based on current sort order
  const displayVideos = [...videos].sort((a, b) => {
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
    <div className="max-w-[98%] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Channel Videos (27+ minutes)</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {settings.channelUrls.length} channel(s) • Showing {totalLoaded} videos
              {selectedVideos.size > 0 && ` • ${selectedVideos.size} selected`}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => updateSettings({ videoSortOrder: settings.videoSortOrder === 'popular' ? 'date' : 'popular' })}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                settings.videoSortOrder === 'popular'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {settings.videoSortOrder === 'popular' ? '✓ Sorted by Popularity' : 'Sort by Date'}
            </button>
            <button
              onClick={() => loadVideos()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        {selectedVideos.size > 0 && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-blue-500">
            <button
              onClick={handleProcessSelected}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Process {selectedVideos.size} Selected Video{selectedVideos.size > 1 ? 's' : ''} Sequentially
            </button>
            <button
              onClick={() => setSelectedVideos(new Set())}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear Selection
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 ml-auto">
              Videos will be processed one by one in order
            </span>
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
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

      {/* Load More Button */}
      {videos.length > 0 && hasMoreVideos && (
        <div className="flex items-center justify-center mt-8">
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

      {/* No more videos message */}
      {videos.length > 0 && !hasMoreVideos && !loading && (
        <div className="text-center mt-8 text-gray-600 dark:text-gray-400">
          <p className="text-lg font-medium">All videos loaded from {settings.channelUrls.length} channel(s)! ({totalLoaded} total)</p>
        </div>
      )}
    </div>
  );
}
