import { useState } from 'react';
import { History, Play, Trash2, Youtube, CheckCircle, X, Calendar } from 'lucide-react';
import NavigationBar from './NavigationBar';
import { useHistoryStore } from '../stores/historyStore';
import { useTempQueueStore } from '../stores/tempQueueStore';

interface ProcessedVideosProps {
  onVideoSelect: (
    url: string,
    title?: string,
    videoIndex?: number,
    totalVideos?: number,
    channelTitle?: string,
    targetChannelId?: string,
    targetChannelName?: string
  ) => void;
  onClose: () => void;
  onNavigateHome?: () => void;
  onNavigateHistory?: () => void;
  onNavigateShorts?: () => void;
  onNavigateTitle?: () => void;
  onNavigateMonitoring?: () => void;
  onNavigateSettings?: () => void;
  onNavigateScheduleToday?: () => void;
  onNavigateScheduleCalendar?: () => void;
  onPushToChat?: () => void;
}

export default function ProcessedVideos({
  onVideoSelect,
  onClose,
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
}: ProcessedVideosProps) {
  const { getQueueCount } = useTempQueueStore();
  const { processedLinks, clearHistory, removeProcessing, removeVideoCompletely } = useHistoryStore();

  const [selectedTargetChannel, setSelectedTargetChannel] = useState<string>('all');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Get all unique target channels from processed videos
  const allTargetChannels = new Set<string>();
  processedLinks.forEach((video) => {
    video.targetChannelProcessings.forEach((processing) => {
      allTargetChannels.add(processing.targetChannelId);
    });
  });

  const uniqueTargetChannels = Array.from(allTargetChannels).map((id) => {
    const processing = processedLinks
      .flatMap((v) => v.targetChannelProcessings)
      .find((p) => p.targetChannelId === id);
    return {
      id,
      name: processing?.targetChannelName || id,
    };
  });

  // Filter videos based on selected target channel
  const filteredVideos = processedLinks.filter((video) => {
    if (selectedTargetChannel === 'all') return true;
    return video.targetChannelProcessings.some(
      (p) => p.targetChannelId === selectedTargetChannel
    );
  });

  // Sort by newest first (based on selected target channel or latest processing)
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    const getLatestDate = (video: typeof a) => {
      if (selectedTargetChannel === 'all') {
        // Get the most recent processing date across all target channels
        const dates = video.targetChannelProcessings.map((p) => new Date(p.processedAt).getTime());
        return Math.max(...dates);
      } else {
        // Get the processing date for the selected target channel
        const processing = video.targetChannelProcessings.find(
          (p) => p.targetChannelId === selectedTargetChannel
        );
        return processing ? new Date(processing.processedAt).getTime() : 0;
      }
    };

    return getLatestDate(b) - getLatestDate(a);
  });

  const handleClearHistory = () => {
    console.log('🗑️ Clearing all processed video history');
    clearHistory();
    setSelectedVideos(new Set());
  };

  const handleVideoClick = (url: string, title?: string, channelTitle?: string) => {
    // Find the target channel to use
    const video = processedLinks.find((v) => v.url === url);
    if (!video) return;

    // Use the selected target channel if filtered, otherwise use the first one
    const targetChannelId =
      selectedTargetChannel !== 'all' ? selectedTargetChannel : video.targetChannelProcessings[0]?.targetChannelId;
    const targetChannelName = video.targetChannelProcessings.find(
      (p) => p.targetChannelId === targetChannelId
    )?.targetChannelName;

    onVideoSelect(url, title, undefined, undefined, channelTitle, targetChannelId, targetChannelName);
    onClose(); // Close history view after selecting a video
  };

  const toggleVideoSelection = (url: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedVideos(newSelected);
  };

  const handleUnprocess = () => {
    if (selectedVideos.size === 0) return;

    console.log(`🗑️ Unprocessing ${selectedVideos.size} video(s)...`);

    selectedVideos.forEach((url) => {
      if (selectedTargetChannel === 'all') {
        // Remove video completely (all target channels)
        removeVideoCompletely(url);
        console.log(`✓ Removed video completely: ${url}`);
      } else {
        // Remove only the selected target channel processing
        removeProcessing(url, selectedTargetChannel);
        console.log(`✓ Removed processing for target channel ${selectedTargetChannel}: ${url}`);
      }
    });

    // Clear selection
    setSelectedVideos(new Set());
    console.log('✓ Unprocessing complete');
  };

  // Extract video ID and generate thumbnail from URL if not present
  const getThumbnail = (video: any): string | undefined => {
    if (video.thumbnail) return video.thumbnail;

    // Try to extract video ID from URL and generate thumbnail
    const videoIdMatch = video.url.match(/(?:v=|\/)([\w-]{11})/);
    if (videoIdMatch) {
      return `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
    }

    return undefined;
  };

  // Get display title - use stored title or extract video ID as fallback
  const getDisplayTitle = (video: any): string => {
    if (video.title && video.title.trim()) {
      return video.title;
    }

    // Extract video ID as fallback for old videos
    const videoIdMatch = video.url.match(/(?:v=|\/)([\w-]{11})/);
    if (videoIdMatch) {
      return `Video ID: ${videoIdMatch[1]}`;
    }

    return 'Untitled Video';
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top Header with Logo */}
      <header className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Youtube className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                YouTube Transcript Processor
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Processed Videos History - {processedLinks.length} videos
              </p>
            </div>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm font-medium flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      {onNavigateHome && onNavigateHistory && onNavigateShorts && onNavigateTitle && onNavigateMonitoring && onNavigateSettings && (
        <NavigationBar
          currentPage="history"
          onNavigateHome={onNavigateHome}
          onNavigateHistory={onNavigateHistory}
          onNavigateShorts={onNavigateShorts}
          onNavigateTitle={onNavigateTitle}
          onNavigateMonitoring={onNavigateMonitoring}
          onNavigateSettings={onNavigateSettings}
          onNavigateScheduleToday={onNavigateScheduleToday}
          onNavigateScheduleCalendar={onNavigateScheduleCalendar}
          onPushToChat={onPushToChat}
          queueCount={getQueueCount()}
        />
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {processedLinks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 sm:p-12 text-center">
            <History className="w-16 h-16 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">No Processed Videos Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Videos you process will appear here for easy reprocessing
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back to Main
            </button>
          </div>
        ) : (
          <>
            {/* Filter and Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Target Channel Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Filter by Target Channel
                </label>
                <select
                  value={selectedTargetChannel}
                  onChange={(e) => {
                    setSelectedTargetChannel(e.target.value);
                    setSelectedVideos(new Set()); // Clear selection when changing filter
                  }}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-blue-500 dark:hover:border-blue-400 transition-colors font-medium text-sm cursor-pointer"
                >
                  <option value="all">All Target Channels ({processedLinks.length})</option>
                  {uniqueTargetChannels.map((channel) => {
                    const count = processedLinks.filter((v) =>
                      v.targetChannelProcessings.some((p) => p.targetChannelId === channel.id)
                    ).length;
                    return (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Multi-select Actions */}
              {selectedVideos.size > 0 && (
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleUnprocess}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Unprocess ({selectedVideos.size})
                  </button>
                  <button
                    onClick={() => setSelectedVideos(new Set())}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              )}
            </div>

            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              {selectedVideos.size > 0
                ? `${selectedVideos.size} video(s) selected • Click Unprocess to remove from history`
                : 'Click any video to reprocess it, or use checkboxes to select multiple for unprocessing'}
            </p>

            {/* Videos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {sortedVideos.map((video) => {
                const isSelected = selectedVideos.has(video.url);

                return (
                  <div
                    key={video.url}
                    className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer border-2 ${
                      isSelected
                        ? 'border-red-500 ring-4 ring-red-200 dark:ring-red-900'
                        : 'border-transparent hover:border-purple-500'
                    } group relative`}
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-video bg-gray-200 dark:bg-gray-700"
                      onClick={() => handleVideoClick(video.url, video.title, video.channelTitle)}
                    >
                      {getThumbnail(video) ? (
                        <img
                          src={getThumbnail(video)}
                          alt={video.title || 'Video thumbnail'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center ${
                          getThumbnail(video) ? 'hidden' : ''
                        }`}
                      >
                        <Play className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
                      </div>

                      {/* Selection Checkbox */}
                      <div
                        className="absolute top-2 left-2 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVideoSelection(video.url);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </div>

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center pointer-events-none">
                        <Play className="w-10 h-10 sm:w-14 sm:h-14 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 min-h-[120px] flex flex-col justify-between">
                      <h3 className="text-sm sm:text-base font-bold line-clamp-2 mb-2 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {getDisplayTitle(video)}
                      </h3>
                      <div>
                        {video.channelTitle && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 truncate mb-2 font-medium">
                            {video.channelTitle}
                          </p>
                        )}

                        {/* Target Channels */}
                        <div className="space-y-1 mb-2">
                          {selectedTargetChannel === 'all' ? (
                            // Show all target channels when "All" is selected
                            video.targetChannelProcessings.slice(0, 2).map((processing) => (
                              <div
                                key={processing.targetChannelId}
                                className="flex items-center gap-2"
                              >
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="truncate">{processing.targetChannelName}</span>
                                </div>
                                {processing.isScheduled && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                                    <Calendar className="w-3 h-3" />
                                    <span>{processing.scheduleDate} • #{processing.slotNumber}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            // Show only selected target channel when filtered
                            (() => {
                              const selectedProcessing = video.targetChannelProcessings.find(
                                (p) => p.targetChannelId === selectedTargetChannel
                              );
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-3 h-3" />
                                    <span className="truncate">{selectedProcessing?.targetChannelName}</span>
                                  </div>
                                  {selectedProcessing?.isScheduled && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                                      <Calendar className="w-3 h-3" />
                                      <span>{selectedProcessing.scheduleDate} • #{selectedProcessing.slotNumber}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                          {selectedTargetChannel === 'all' && video.targetChannelProcessings.length > 2 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              +{video.targetChannelProcessings.length - 2} more
                            </p>
                          )}
                        </div>

                        {/* Processing Date */}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedTargetChannel === 'all' ? (
                            // Show latest processing date when "All" is selected
                            <>
                              Latest:{' '}
                              {new Date(
                                Math.max(
                                  ...video.targetChannelProcessings.map((p) => new Date(p.processedAt).getTime())
                                )
                              ).toLocaleDateString()}
                            </>
                          ) : (
                            // Show processing date for selected target channel
                            <>
                              Processed:{' '}
                              {new Date(
                                video.targetChannelProcessings.find(
                                  (p) => p.targetChannelId === selectedTargetChannel
                                )?.processedAt || ''
                              ).toLocaleDateString()}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
