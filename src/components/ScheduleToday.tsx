import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  Send,
  AlertCircle,
  Youtube,
  History,
  Edit,
} from 'lucide-react';
import TranscriptEditModal from './TranscriptEditModal';
import NavigationBar from './NavigationBar';
import { supabase } from '../services/supabaseClient';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { syncPublishedVideosToHistory } from '../utils/syncScheduledToHistory';
import type { ScheduledVideo } from '../types/scheduling';

interface ScheduleTodayProps {
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateShorts: () => void;
  onNavigateTitle: () => void;
  onNavigateMonitoring: () => void;
  onNavigateSettings: () => void;
  onNavigateScheduleToday: () => void;
  onNavigateScheduleCalendar: () => void;
  onPushToChat?: () => void;
}

export default function ScheduleToday({
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
}: ScheduleTodayProps) {
  const { getQueueCount } = useTempQueueStore();

  const [scheduleDate, setScheduleDate] = useState<string>(getTodayDate());
  const [videos, setVideos] = useState<ScheduledVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<ScheduledVideo | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    ready: 0,
    published: 0,
    failed: 0,
  });

  useEffect(() => {
    loadSchedule();
  }, [scheduleDate]);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('scheduled_videos')
        .select('*')
        .eq('schedule_date', scheduleDate)
        .order('target_channel_name', { ascending: true })
        .order('slot_number', { ascending: true });

      if (fetchError) throw fetchError;

      setVideos(data || []);

      // Calculate stats
      const newStats = {
        total: data?.length || 0,
        pending: data?.filter((v) => v.status === 'pending').length || 0,
        processing: data?.filter((v) => v.status === 'processing').length || 0,
        ready: data?.filter((v) => v.status === 'ready').length || 0,
        published: data?.filter((v) => v.status === 'published').length || 0,
        failed: data?.filter((v) => v.status === 'failed').length || 0,
      };

      setStats(newStats);
    } catch (err: any) {
      console.error('Error loading schedule:', err);
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPushToTelegram = async () => {
    if (stats.ready === 0) {
      setError('No ready videos to push!');
      return;
    }

    if (!confirm(`Push ${stats.ready} ready videos to Telegram?`)) {
      return;
    }

    setPushing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: supabaseData } = await supabase.auth.getSession();
      const token = supabaseData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-push-to-telegram`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ date: scheduleDate }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`Successfully pushed ${result.sent} videos to Telegram!`);
        loadSchedule();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error pushing to Telegram:', err);
      setError(err.message || 'Failed to push to Telegram');
    } finally {
      setPushing(false);
    }
  };

  const handleSyncToHistory = async () => {
    setSyncing(true);
    setError(null);

    try {
      const result = await syncPublishedVideosToHistory(scheduleDate);

      if (result.success) {
        setSuccessMessage(`✅ Synced ${result.synced} published videos to History!`);
      } else {
        setError(result.error || 'Failed to sync to history');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync to history');
    } finally {
      setSyncing(false);
    }
  };

  const groupByChannel = (videos: ScheduledVideo[]) => {
    const grouped: Record<string, ScheduledVideo[]> = {};
    videos.forEach((video) => {
      if (!grouped[video.target_channel_name]) {
        grouped[video.target_channel_name] = [];
      }
      grouped[video.target_channel_name].push(video);
    });
    return grouped;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-gray-400';
      case 'processing': return 'text-blue-400';
      case 'ready': return 'text-green-400';
      case 'published': return 'text-purple-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'published': return <Send className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const groupedVideos = groupByChannel(videos);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <NavigationBar
        currentPage="schedule-today"
        onNavigateHome={onNavigateHome}
        onNavigateHistory={onNavigateHistory}
        onNavigateShorts={onNavigateShorts}
        onNavigateTitle={onNavigateTitle}
        onNavigateMonitoring={onNavigateMonitoring}
        onNavigateScheduleToday={onNavigateScheduleToday}
        onNavigateScheduleCalendar={onNavigateScheduleCalendar}
        onNavigateSettings={onNavigateSettings}
        onPushToChat={onPushToChat}
        queueCount={getQueueCount()}
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Schedule Today</h1>
          </div>
          <p className="text-gray-400">
            Daily video schedule for publishing to target channels
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleBulkPushToTelegram}
              disabled={pushing || stats.ready === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {pushing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Push to Telegram ({stats.ready} ready)
                </>
              )}
            </button>

            <button
              onClick={handleSyncToHistory}
              disabled={syncing || stats.published === 0}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <History className="w-5 h-5" />
                  Sync to History ({stats.published} published)
                </>
              )}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-400">{stats.pending}</div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.processing}</div>
              <div className="text-sm text-gray-400">Processing</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.ready}</div>
              <div className="text-sm text-gray-400">Ready</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.published}</div>
              <div className="text-sm text-gray-400">Published</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-sm text-gray-400">Failed</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900/20 border border-green-700 text-green-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-2" />
            <p className="text-gray-400">Loading schedule...</p>
          </div>
        )}

        {/* No Schedule */}
        {!loading && videos.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <p className="text-yellow-400 font-medium">No schedule found for {scheduleDate}</p>
            <p className="text-yellow-600 text-sm mt-2">
              Schedule is generated automatically at 2 AM daily
            </p>
          </div>
        )}

        {/* Schedule by Channel */}
        {!loading && Object.keys(groupedVideos).length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedVideos).map(([channelName, channelVideos]) => (
              <div key={channelName} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Youtube className="w-6 h-6" />
                    {channelName}
                    <span className="ml-2 text-sm font-normal opacity-90">
                      ({channelVideos.length} videos)
                    </span>
                  </h2>
                </div>

                <div className="divide-y divide-gray-700">
                  {channelVideos.map((video) => (
                    <div key={video.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm font-medium">
                              Slot {video.slot_number}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              video.video_type === 'new'
                                ? 'bg-green-900/30 text-green-400'
                                : 'bg-blue-900/30 text-blue-400'
                            }`}>
                              {video.video_type === 'new' ? 'NEW' : 'OLD'}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getStatusColor(video.status)}`}>
                              {getStatusIcon(video.status)}
                              {video.status.toUpperCase()}
                            </span>
                          </div>

                          <h3 className="text-base font-medium text-white mb-1">
                            {video.video_title}
                          </h3>

                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>ID: {video.video_id}</span>
                            {video.processing_completed_at && (
                              <span>
                                Processed: {new Date(video.processing_completed_at).toLocaleString()}
                              </span>
                            )}
                          </div>

                          {video.error_message && (
                            <div className="mt-2 text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded border border-red-800">
                              ❌ {video.error_message}
                            </div>
                          )}
                        </div>

                        <div className="ml-4 flex flex-col gap-2">
                          {video.status === 'ready' && video.raw_transcript_path && (
                            <button
                              onClick={() => setEditingVideo(video)}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                              title="Edit script manually"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Script
                            </button>
                          )}
                          <a
                            href={`https://www.youtube.com/watch?v=${video.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-center"
                          >
                            YouTube
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript Edit Modal */}
      {editingVideo && (
        <TranscriptEditModal
          videoId={editingVideo.id}
          videoTitle={editingVideo.video_title}
          rawTranscriptPath={editingVideo.raw_transcript_path}
          onClose={() => setEditingVideo(null)}
          onSuccess={() => {
            setEditingVideo(null);
            loadSchedule(); // Refresh videos list
          }}
        />
      )}
    </div>
  );
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}
