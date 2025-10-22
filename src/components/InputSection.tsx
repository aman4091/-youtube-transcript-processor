import { useState } from 'react';
import { Youtube } from 'lucide-react';
import { isValidYouTubeUrl } from '../utils/linkValidator';
import { useHistoryStore } from '../stores/historyStore';

import NavigationBar from './NavigationBar';
interface InputSectionProps {
  onProcess: (url: string) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenShortsFinder: () => void;
  onOpenTitlePage: () => void;
  onOpenMonitoring: () => void;
  onOpenScheduleToday?: () => void;
  onOpenScheduleCalendar?: () => void;
  onGoHome?: () => void;
  onPushToChat?: () => void;
  queueCount?: number;
  isProcessing: boolean;
}

export default function InputSection({ onProcess, onOpenSettings, onOpenHistory, onOpenShortsFinder, onOpenTitlePage, onOpenMonitoring, onOpenScheduleToday, onOpenScheduleCalendar, onGoHome, onPushToChat, queueCount = 0, isProcessing }: InputSectionProps) {
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
    <>
      {/* Top Header with Logo */}
      <header className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Youtube className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                YouTube Transcript Processor
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Process & analyze YouTube transcripts with AI
              </p>
            </div>
          </div>
        </div>
      </header>
      {/* Navigation Bar */}
      <NavigationBar
        currentPage="home"
        onNavigateHome={onGoHome || (() => {})}
        onNavigateHistory={onOpenHistory}
        onNavigateShorts={onOpenShortsFinder}
        onNavigateTitle={onOpenTitlePage}
        onNavigateMonitoring={onOpenMonitoring}
        onNavigateSettings={onOpenSettings}
        onNavigateScheduleToday={onOpenScheduleToday}
        onNavigateScheduleCalendar={onOpenScheduleCalendar}
        onPushToChat={onPushToChat}
        queueCount={queueCount}
      />

      {/* Main Content */}
      <div className="w-full max-w-4xl mx-auto p-3 sm:p-6">

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
        <label className="block text-xs sm:text-sm font-medium mb-2">
          YouTube Video URL
        </label>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
              setShowDuplicateWarning(false);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            {isProcessing ? 'Processing...' : 'Start Processing'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm break-words">
            {error}
          </div>
        )}

        {showDuplicateWarning && (
          <div className="mt-3 p-3 sm:p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-md">
            <p className="text-yellow-800 dark:text-yellow-200 mb-3 text-sm break-words">
              This link has already been processed. Do you want to proceed anyway?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleProceedAnyway}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
              >
                Yes, Proceed
              </button>
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
