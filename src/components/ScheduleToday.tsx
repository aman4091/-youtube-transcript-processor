import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { ScheduledVideo } from '../types/scheduling';

const ScheduleToday: React.FC = () => {
  const [scheduleDate, setScheduleDate] = useState<string>(getTodayDate());
  const [videos, setVideos] = useState<ScheduledVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
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
    try {
      const { data, error } = await supabase
        .from('scheduled_videos')
        .select('*')
        .eq('schedule_date', scheduleDate)
        .order('target_channel_name', { ascending: true })
        .order('slot_number', { ascending: true });

      if (error) throw error;

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
    } catch (error: any) {
      console.error('Error loading schedule:', error.message);
      alert('Failed to load schedule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPushToTelegram = async () => {
    if (stats.ready === 0) {
      alert('No ready videos to push!');
      return;
    }

    if (!confirm(`Push ${stats.ready} ready videos to Telegram Channel 1?`)) {
      return;
    }

    setPushing(true);
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
        alert(
          `✅ Successfully pushed ${result.sent} videos to Telegram!\n\nSent: ${result.sent}\nFailed: ${result.failed}`
        );
        loadSchedule(); // Reload to show updated statuses
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error pushing to Telegram:', error.message);
      alert('Failed to push to Telegram: ' + error.message);
    } finally {
      setPushing(false);
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
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'published':
        return 'bg-purple-100 text-purple-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedVideos = groupByChannel(videos);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Today</h1>
        <p className="text-gray-600">
          Daily video schedule for publishing to target channels
        </p>
      </div>

      {/* Date Selector & Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleBulkPushToTelegram}
            disabled={pushing || stats.ready === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {pushing ? '📤 Pushing...' : `📤 Push to Telegram (${stats.ready} ready)`}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
            <div className="text-sm text-blue-600">Processing</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
            <div className="text-sm text-green-600">Ready</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.published}</div>
            <div className="text-sm text-purple-600">Published</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-600">Loading schedule...</div>
      )}

      {/* No Schedule */}
      {!loading && videos.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">No schedule found for {scheduleDate}</p>
          <p className="text-yellow-700 text-sm mt-2">
            Schedule is generated automatically at 2 AM daily
          </p>
        </div>
      )}

      {/* Schedule by Channel */}
      {!loading && Object.keys(groupedVideos).length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedVideos).map(([channelName, channelVideos]) => (
            <div
              key={channelName}
              className="bg-white rounded-lg shadow-sm border border-gray-200"
            >
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold">
                  🎯 {channelName}
                  <span className="ml-3 text-sm font-normal opacity-90">
                    ({channelVideos.length} videos)
                  </span>
                </h2>
              </div>

              <div className="divide-y divide-gray-200">
                {channelVideos.map((video) => (
                  <div
                    key={video.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                            Slot {video.slot_number}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              video.video_type === 'new'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {video.video_type === 'new' ? '🆕 NEW' : '📺 OLD'}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                              video.status
                            )}`}
                          >
                            {video.status.toUpperCase()}
                          </span>
                        </div>

                        <h3 className="text-base font-medium text-gray-900 mb-1">
                          {video.video_title}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Video ID: {video.video_id}</span>
                          {video.processing_completed_at && (
                            <span>
                              Processed:{' '}
                              {new Date(video.processing_completed_at).toLocaleString()}
                            </span>
                          )}
                          {video.telegram_sent_at && (
                            <span>
                              Sent to Telegram:{' '}
                              {new Date(video.telegram_sent_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {video.error_message && (
                          <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                            ❌ Error: {video.error_message}
                          </div>
                        )}
                      </div>

                      <a
                        href={`https://www.youtube.com/watch?v=${video.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        🎥 YouTube
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default ScheduleToday;
