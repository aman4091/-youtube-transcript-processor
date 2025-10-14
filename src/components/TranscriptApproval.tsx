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
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 border-2 border-blue-500">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Transcript Preview</h2>
            {videoTitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {videoTitle}
              </p>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Review the transcript below:</strong> If you're satisfied, click <strong>Accept</strong> to proceed with AI processing.
            If not, click <strong>Reject</strong> to try another random video from the same channel, or <strong>Cancel</strong> to stop the process.
          </p>
        </div>

        {/* Character Count */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
          Characters: {formatCharacterCount(charCount)}
        </div>

        {/* Transcript Display */}
        <div className="mb-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 overflow-y-auto border border-gray-200 dark:border-gray-700"
             style={{ maxHeight: '450px' }}>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
            {transcript}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onAccept}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105"
          >
            <CheckCircle className="w-6 h-6" />
            Accept & Process
          </button>

          <button
            onClick={onReject}
            className="flex items-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105"
          >
            <XCircle className="w-6 h-6" />
            Reject & Try Another
          </button>

          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-105"
          >
            <Ban className="w-6 h-6" />
            Cancel Process
          </button>
        </div>
      </div>
    </div>
  );
}
