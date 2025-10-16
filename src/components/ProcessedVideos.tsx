import { History, Play, Trash2, Youtube } from 'lucide-react';
import { useHistoryStore } from '../stores/historyStore';

interface ProcessedVideosProps {
  onVideoSelect: (url: string, title?: string) => void;
  onClose: () => void;
}

export default function ProcessedVideos({ onVideoSelect, onClose }: ProcessedVideosProps) {
  const { processedLinks, clearHistory } = useHistoryStore();

  // Sort by newest first
  const sortedVideos = [...processedLinks].sort((a, b) => {
    return new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime();
  });

  const handleClearHistory = () => {
    console.log('🗑️ Clearing all processed video history');
    clearHistory();
  };

  const handleVideoClick = (url: string, title?: string) => {
    onVideoSelect(url, title);
    onClose(); // Close history view after selecting a video
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
      <nav className="w-full bg-gray-50 dark:bg-gray-900 sticky top-0 z-50 border-b-2 border-gray-200 dark:border-gray-700 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-sm sm:text-base"
            >
              <Youtube className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Home</span>
            </button>

            <button
              className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-purple-600 text-white font-semibold border-b-4 border-purple-700 hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>History</span>
            </button>
          </div>
        </div>
      </nav>

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
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
              Click any video to reprocess it
            </p>

            {/* Videos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {sortedVideos.map((video) => (
                <div
                  key={video.url}
                  onClick={() => handleVideoClick(video.url, video.title)}
                  className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-500 group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-200 dark:bg-gray-700">
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
                    <div className={`w-full h-full flex items-center justify-center ${getThumbnail(video) ? 'hidden' : ''}`}>
                      <Play className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
                    </div>

                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                      <Play className="w-10 h-10 sm:w-14 sm:h-14 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Video Info */}
                  <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 min-h-[80px] flex flex-col justify-between">
                    <h3 className="text-sm sm:text-base font-bold line-clamp-2 mb-2 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {getDisplayTitle(video)}
                    </h3>
                    <div>
                      {video.channelTitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 truncate mb-1 font-medium">
                          {video.channelTitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(video.processedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
