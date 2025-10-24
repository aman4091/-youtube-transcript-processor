import { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Youtube,
  Loader2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import NavigationBar from './NavigationBar';
import { useSettingsStore } from '../stores/settingsStore';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { useUserStore } from '../stores/userStore';
import {
  getMonitoringStats,
  getProcessedVideos,
  getMonitoringLogs,
  getProcessingQueue,
  getErrorLogs,
  getDailyStats,
  syncSettingsToSupabase,
  triggerManualCheck,
  toggleMonitoring,
  processPendingVideos,
} from '../services/monitoringService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import type {
  MonitoringStats,
  ProcessedVideo,
} from '../types/monitoring';

interface MonitoringDashboardProps {
  onClose: () => void;
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateShorts: () => void;
  onNavigateTitle: () => void;
  onNavigateMonitoring: () => void;
  onNavigateSettings: () => void;
  onNavigateScheduleToday?: () => void;
  onNavigateScheduleCalendar?: () => void;
  onPushToChat?: () => void;
}

export default function MonitoringDashboard({
  onClose: _onClose,
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring: _onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
}: MonitoringDashboardProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { getQueueCount } = useTempQueueStore();
  const { user } = useUserStore();

  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [processedVideos, setProcessedVideos] = useState<ProcessedVideo[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [isProcessingPending, setIsProcessingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  // Load data on mount and refresh every 30 seconds
  useEffect(() => {
    loadAllData();

    const interval = setInterval(() => {
      loadAllData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        statsData,
        videosData,
        // logsData,
        // queueData,
        // errorsData,
        // dailyStatsData,
      ] = await Promise.all([
        getMonitoringStats(),
        getProcessedVideos(20),
        getMonitoringLogs(10),
        getProcessingQueue(),
        getErrorLogs(10),
        getDailyStats(7),
      ]);

      setStats(statsData);
      setProcessedVideos(videosData);
      // setMonitoringLogs(logsData);
      // setProcessingQueue(queueData);
      // setErrorLogs(errorsData);
      // setDailyStats(dailyStatsData);
    } catch (err: any) {
      console.error('Error loading monitoring data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      setIsToggling(true);
      setError(null);

      const newEnabled = !settings.autoMonitoringEnabled;

      // Update local settings
      updateSettings({ autoMonitoringEnabled: newEnabled });

      // Sync to Supabase
      await toggleMonitoring(newEnabled);

      setSuccessMessage(
        `Monitoring ${newEnabled ? 'enabled' : 'disabled'} successfully!`
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);

      // Reload data
      await loadAllData();
    } catch (err: any) {
      console.error('Error toggling monitoring:', err);
      setError(err.message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleManualCheck = async () => {
    try {
      setIsManualChecking(true);
      setError(null);

      if (!user) {
        setError('User not logged in');
        setIsManualChecking(false);
        return;
      }

      const result = await triggerManualCheck(user.id);

      setSuccessMessage(
        `Manual check complete! Found ${result.new_videos} new videos.`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload data
      await loadAllData();
    } catch (err: any) {
      console.error('Error triggering manual check:', err);
      setError(err.message);
    } finally {
      setIsManualChecking(false);
    }
  };

  const handleSyncSettings = async () => {
    if (!user) {
      setError('User not logged in');
      return;
    }

    try {
      setError(null);

      // Prepare auto-monitor settings
      const autoMonitorSettings = {
        user_id: user.id,  // Add user_id for multi-user support
        enabled: settings.autoMonitoringEnabled,
        check_interval_hours: settings.monitoringIntervalHours,
        source_channels: settings.channelUrls,
        ai_model: settings.monitoringAIModel,
        custom_prompt: settings.customPrompt,
        supabase_api_key: settings.supaDataApiKeys?.[0]?.key || '',
        deepseek_api_key: settings.deepSeekApiKey,
        gemini_api_key: settings.geminiApiKey,
        openrouter_api_key: settings.openRouterApiKey,
        openrouter_model: settings.selectedOpenRouterModel,
        youtube_api_key: settings.youtubeApiKey,
        telegram_bot_token: settings.telegramBotToken,
        telegram_chat_id: settings.telegramChatId,
        telegram_chat_id_with_title: settings.telegramChatIdWithTitle,
      };

      await syncSettingsToSupabase(autoMonitorSettings);

      setSuccessMessage('Settings synced successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Reload data
      await loadAllData();
    } catch (err: any) {
      console.error('Error syncing settings:', err);
      setError(err.message);
    }
  };

  const handleProcessPending = async () => {
    try {
      setIsProcessingPending(true);
      setError(null);

      const result = await processPendingVideos();

      setSuccessMessage(
        `Processed ${result.processed || 0} videos! ${result.failed ? `(${result.failed} failed)` : ''}`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload data
      await loadAllData();
    } catch (err: any) {
      console.error('Error processing pending videos:', err);
      setError(err.message);
    } finally {
      setIsProcessingPending(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
          currentPage="monitoring"
          onNavigateHome={onNavigateHome}
          onNavigateHistory={onNavigateHistory}
          onNavigateShorts={onNavigateShorts}
          onNavigateTitle={onNavigateTitle}
          onNavigateMonitoring={() => {}} // Already on monitoring page
          onNavigateSettings={onNavigateSettings}
          onNavigateScheduleToday={onNavigateScheduleToday}
          onNavigateScheduleCalendar={onNavigateScheduleCalendar}
          onPushToChat={onPushToChat}
          queueCount={getQueueCount()}
        />

        {/* Error State */}
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Supabase Not Configured
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Auto-monitoring requires Supabase to be configured. Please add the
              following environment variables:
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left font-mono text-sm mb-6">
              <p className="text-gray-800 dark:text-gray-200">VITE_SUPABASE_URL=...</p>
              <p className="text-gray-800 dark:text-gray-200">VITE_SUPABASE_ANON_KEY=...</p>
            </div>
            <button
              onClick={onNavigateSettings}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
        currentPage="monitoring"
        onNavigateHome={onNavigateHome}
        onNavigateHistory={onNavigateHistory}
        onNavigateShorts={onNavigateShorts}
        onNavigateTitle={onNavigateTitle}
        onNavigateMonitoring={() => {}} // Already on monitoring page
        onNavigateSettings={onNavigateSettings}
        onNavigateScheduleToday={onNavigateScheduleToday}
        onNavigateScheduleCalendar={onNavigateScheduleCalendar}
        onPushToChat={onPushToChat}
        queueCount={getQueueCount()}
      />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">Auto-Monitoring Dashboard</h2>
                <p className="text-white text-opacity-90 text-sm sm:text-base">
                  24/7 automatic video monitoring & processing
                </p>
              </div>
            </div>

            {/* Monitoring Toggle */}
            <button
              onClick={handleToggleMonitoring}
              disabled={isToggling}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                settings.autoMonitoringEnabled
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isToggling ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : settings.autoMonitoringEnabled ? (
                <PauseCircle className="w-5 h-5" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              <span>{settings.autoMonitoringEnabled ? 'Pause' : 'Start'} Monitoring</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-600 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded-lg p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<TrendingUp />}
                label="Total Videos Processed"
                value={stats?.total_videos_processed || 0}
                color="blue"
              />
              <StatCard
                icon={<CheckCircle />}
                label="Successful"
                value={stats?.successful_videos || 0}
                color="green"
              />
              <StatCard
                icon={<XCircle />}
                label="Failed"
                value={stats?.failed_videos || 0}
                color="red"
              />
              <StatCard
                icon={<Clock />}
                label="Today"
                value={stats?.videos_today || 0}
                color="purple"
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleManualCheck}
                  disabled={isManualChecking || !settings.autoMonitoringEnabled}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isManualChecking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Manual Check Now</span>
                </button>

                <button
                  onClick={handleProcessPending}
                  disabled={isProcessingPending}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  <span>Process Pending</span>
                </button>

                <button
                  onClick={handleSyncSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync Settings</span>
                </button>

                <button
                  onClick={loadAllData}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh Data</span>
                </button>
              </div>
            </div>

            {/* Recent Processed Videos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Processed Videos
              </h3>
              {processedVideos.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No videos processed yet
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {processedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {video.video_title || video.video_id}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(video.processed_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {video.status === 'success' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Component: Stat Card
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
