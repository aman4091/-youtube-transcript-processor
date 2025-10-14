import { Check } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface OutputCardProps {
  title: string;
  content: string;
  error?: string;
  isLoading: boolean;
  onSelectFinal: () => void;
}

export default function OutputCard({ title, content, error, isLoading, onSelectFinal }: OutputCardProps) {
  const charCount = content.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{title}</h3>
        {!isLoading && !error && content && (
          <button
            onClick={onSelectFinal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark as Final
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">
          {error}
        </div>
      )}

      {!isLoading && !error && content && (
        <>
          <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Characters: {formatCharacterCount(charCount)}
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-y-auto" style={{ maxHeight: '500px' }}>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{content}</pre>
          </div>
        </>
      )}

      {!isLoading && !error && !content && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Waiting to process...
        </div>
      )}
    </div>
  );
}
