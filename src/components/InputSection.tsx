import { useState } from 'react';
import { Youtube, Settings as SettingsIcon, History, Send, Sparkles, Scissors, Activity, Calendar, Clock } from 'lucide-react';
import { isValidYouTubeUrl } from '../utils/linkValidator';
import { useHistoryStore } from '../stores/historyStore';

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

      {/* Navigation Bar - Professional Design */}
      <nav className="w-full bg-white dark:bg-gray-800 sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* Left side navigation links - NO SCROLLBAR */}
            <div className="flex items-center gap-1 flex-1 overflow-hidden">
              <button
                onClick={onGoHome}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 dark:border-blue-400 font-medium text-sm transition-all whitespace-nowrap"
              >
                <Youtube className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>Home</span>
              </button>

              <button
                onClick={onOpenHistory}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
              >
                <History className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>History</span>
              </button>

              <button
                onClick={onOpenShortsFinder}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
              >
                <Scissors className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="hidden sm:inline">Find Shorts</span>
                <span className="sm:hidden">Shorts</span>
              </button>

              <button
                onClick={onOpenTitlePage}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>Title</span>
              </button>

              <button
                onClick={onOpenMonitoring}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
              >
                <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="hidden sm:inline">Monitoring</span>
                <span className="sm:hidden">Monitor</span>
              </button>

              {onOpenScheduleToday && (
                <button
                  onClick={onOpenScheduleToday}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
                >
                  <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span className="hidden sm:inline">Schedule Today</span>
                  <span className="sm:hidden">Today</span>
                </button>
              )}

              {onOpenScheduleCalendar && (
                <button
                  onClick={onOpenScheduleCalendar}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span className="hidden sm:inline">Schedule Calendar</span>
                  <span className="sm:hidden">Calendar</span>
                </button>
              )}

              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all whitespace-nowrap"
              >
                <SettingsIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>Settings</span>
              </button>
            </div>

            {/* Right side action button */}
            {onPushToChat && queueCount > 0 && (
              <button
                onClick={onPushToChat}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all font-medium text-sm shadow-sm hover:shadow-md relative ml-4 whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>Push to Chat</span>
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {queueCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

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
