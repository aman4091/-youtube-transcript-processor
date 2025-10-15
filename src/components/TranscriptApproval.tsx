import { FileText, CheckCircle, XCircle, Ban } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface TranscriptApprovalProps {
  transcript: string;
  videoTitle?: string;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export default function TranscriptApproval({
  transcript,
  videoTitle,
  onAccept,
  onReject,
  onCancel,
}: TranscriptApprovalProps) {
  const charCount = transcript.length;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-3 sm:p-6 md:p-8 border-2 border-blue-500">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold truncate">Transcript Preview</h2>
            {videoTitle && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {videoTitle}
              </p>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            <strong>Review the transcript below:</strong> If you're satisfied, click <strong>Accept</strong> to proceed with AI processing.
            If not, click <strong>Reject</strong> to try another random video from the same channel, or <strong>Cancel</strong> to stop the process.
          </p>
        </div>

        {/* Character Count */}
        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
          Characters: {formatCharacterCount(charCount)}
        </div>

        {/* Transcript Display */}
        <div className="mb-4 sm:mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 sm:p-4 md:p-6 overflow-y-auto border border-gray-200 dark:border-gray-700"
             style={{ maxHeight: '300px', WebkitOverflowScrolling: 'touch' }}>
          <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed font-mono break-words">
            {transcript}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center">
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm sm:text-base md:text-lg shadow-lg transition-all active:scale-95 sm:hover:scale-105 w-full sm:w-auto"
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            <span className="truncate">Accept & Process</span>
          </button>

          <button
            onClick={onReject}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-sm sm:text-base md:text-lg shadow-lg transition-all active:scale-95 sm:hover:scale-105 w-full sm:w-auto"
          >
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            <span className="truncate">Reject & Try Another</span>
          </button>

          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm sm:text-base md:text-lg shadow-lg transition-all active:scale-95 sm:hover:scale-105 w-full sm:w-auto"
          >
            <Ban className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            <span className="truncate">Cancel Process</span>
          </button>
        </div>
      </div>
    </div>
  );
}
