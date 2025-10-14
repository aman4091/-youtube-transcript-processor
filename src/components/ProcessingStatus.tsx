import { Loader2 } from 'lucide-react';

interface ProcessingStatusProps {
  status: string;
  currentChunk?: number;
  totalChunks?: number;
  currentVideoIndex?: number;
  totalVideos?: number;
  currentVideoTitle?: string;
}

export default function ProcessingStatus({
  status,
  currentChunk,
  totalChunks,
  currentVideoIndex,
  totalVideos,
  currentVideoTitle,
}: ProcessingStatusProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <div className="flex-1">
          {/* Video Progress */}
          {currentVideoIndex !== undefined && totalVideos !== undefined && (
            <div className="mb-2">
              <p className="font-bold text-lg text-blue-900 dark:text-blue-100">
                Processing Video {currentVideoIndex} of {totalVideos}
              </p>
              {currentVideoTitle && (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 line-clamp-1">
                  {currentVideoTitle}
                </p>
              )}
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(currentVideoIndex / totalVideos) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Current Status */}
          <p className="font-medium text-blue-900 dark:text-blue-100">{status}</p>
          {currentChunk !== undefined && totalChunks !== undefined && (
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Processing chunk {currentChunk} of {totalChunks}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
