import { FileText } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface TranscriptDisplayProps {
  transcript: string;
}

export default function TranscriptDisplay({ transcript }: TranscriptDisplayProps) {
  const charCount = transcript.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700 sticky top-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="text-xl font-bold">Original Transcript</h3>
      </div>

      <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Characters: {formatCharacterCount(charCount)}
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{transcript}</pre>
      </div>
    </div>
  );
}
