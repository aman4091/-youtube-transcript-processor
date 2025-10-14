import { useState } from 'react';
import { Youtube, Settings as SettingsIcon } from 'lucide-react';
import { isValidYouTubeUrl } from '../utils/linkValidator';
import { useHistoryStore } from '../stores/historyStore';

interface InputSectionProps {
  onProcess: (url: string) => void;
  onOpenSettings: () => void;
  isProcessing: boolean;
}

export default function InputSection({ onProcess, onOpenSettings, isProcessing }: InputSectionProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const { isLinkProcessed } = useHistoryStore();

  const handleSubmit = () => {
    setError('');
    setShowDuplicateWarning(false);

    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    // Check if link was already processed
    if (isLinkProcessed(url)) {
      setShowDuplicateWarning(true);
      return;
    }

    onProcess(url);
  };

  const handleProceedAnyway = () => {
    setShowDuplicateWarning(false);
    onProcess(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Youtube className="w-8 h-8 text-red-600" />
          <h1 className="text-3xl font-bold">YouTube Transcript Processor</h1>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <label className="block text-sm font-medium mb-2">
          YouTube Video URL
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
              setShowDuplicateWarning(false);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Start Processing'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}

        {showDuplicateWarning && (
          <div className="mt-3 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-md">
            <p className="text-yellow-800 dark:text-yellow-200 mb-3">
              This link has already been processed. Do you want to proceed anyway?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleProceedAnyway}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                Yes, Proceed
              </button>
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
