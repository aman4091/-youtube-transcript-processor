import React, { useState, useEffect } from 'react';
import NavigationBar from './NavigationBar';
import { supabase } from '../services/supabaseClient';
import { useTempQueueStore } from '../stores/tempQueueStore';

interface DateSummary {
  date: string;
  total: number;
  pending: number;
  processing: number;
  ready: number;
  published: number;
  failed: number;
  new_count: number;
  old_count: number;
}

interface ScheduleCalendarProps {
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

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
}) => {
  const { getQueueCount } = useTempQueueStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<Record<string, DateSummary>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<DateSummary | null>(null);

  useEffect(() => {
    loadMonthSchedules();
  }, [currentMonth]);

  const loadMonthSchedules = async () => {
    setLoading(true);
    try {
      const startDate = getMonthStart(currentMonth);
      const endDate = getMonthEnd(currentMonth);

      const { data, error } = await supabase
        .from('scheduled_videos')
        .select('*')
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate);

      if (error) throw error;

      // Group by date
      const grouped: Record<string, DateSummary> = {};

      data?.forEach((video) => {
        const date = video.schedule_date;

        if (!grouped[date]) {
          grouped[date] = {
            date,
            total: 0,
            pending: 0,
            processing: 0,
            ready: 0,
            published: 0,
            failed: 0,
            new_count: 0,
            old_count: 0,
          };
        }

        grouped[date].total++;
        grouped[date][video.status as keyof DateSummary]++;

        if (video.video_type === 'new') {
          grouped[date].new_count++;
        } else {
          grouped[date].old_count++;
        }
      });

      setSchedules(grouped);
    } catch (error: any) {
      console.error('Error loading schedules:', error.message);
      alert('Failed to load schedules: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getMonthStart = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).toISOString().split('T')[0];
  };

  const getMonthEnd = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).toISOString().split('T')[0];
  };

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaySchedule = (date: Date | null): DateSummary | null => {
    if (!date) return null;
    const dateStr = formatDate(date);
    return schedules[dateStr] || null;
  };

  const getStatusBarColor = (schedule: DateSummary | null): string => {
    if (!schedule) return 'bg-gray-200';

    if (schedule.failed > 0) return 'bg-red-500';
    if (schedule.published === schedule.total) return 'bg-purple-500';
    if (schedule.ready > 0) return 'bg-green-500';
    if (schedule.processing > 0) return 'bg-blue-500';
    if (schedule.pending > 0) return 'bg-gray-400';

    return 'bg-gray-200';
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <NavigationBar
        currentPage="schedule-calendar"
        onNavigateHome={onNavigateHome}
        onNavigateHistory={onNavigateHistory}
        onNavigateShorts={onNavigateShorts}
        onNavigateTitle={onNavigateTitle}
        onNavigateMonitoring={onNavigateMonitoring}
        onNavigateScheduleToday={onNavigateScheduleToday}
        onNavigateScheduleCalendar={onNavigateScheduleCalendar}
        onNavigateSettings={onNavigateSettings}
        queueCount={getQueueCount()}
        onPushToChat={onPushToChat}
      />

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">📅 Schedule Calendar</h1>
          <p className="text-gray-400">Overview of all scheduled publishing dates</p>
        </div>

        {/* Calendar Controls */}
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={previousMonth}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Previous
            </button>

            <h2 className="text-2xl font-bold text-gray-100">{monthName}</h2>

            <button
              onClick={nextMonth}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span>Published</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>Failed</span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading calendar...</div>
        ) : (
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 bg-gray-700 border-b border-gray-600">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="px-3 py-3 text-center text-sm font-semibold text-gray-200"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                const schedule = getDaySchedule(date);
                const today = isToday(date);

                return (
                  <div
                    key={index}
                    onClick={() => date && schedule && setSelectedDate(schedule)}
                    className={`
                      min-h-24 p-2 border-b border-r border-gray-600
                      ${!date ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}
                      ${schedule ? 'cursor-pointer' : ''}
                      ${today ? 'ring-2 ring-blue-500 ring-inset' : ''}
                    `}
                  >
                    {date && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`
                              text-sm font-medium
                              ${today ? 'text-blue-400 font-bold' : 'text-gray-200'}
                            `}
                          >
                            {date.getDate()}
                          </span>
                          {today && (
                            <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">
                              Today
                            </span>
                          )}
                        </div>

                        {schedule && (
                          <div className="space-y-1">
                            {/* Status Bar */}
                            <div
                              className={`h-1.5 rounded ${getStatusBarColor(schedule)}`}
                            ></div>

                            {/* Stats */}
                            <div className="text-xs text-gray-300">
                              <div>📊 {schedule.total} videos</div>
                              <div className="flex gap-2">
                                <span>🆕 {schedule.new_count}</span>
                                <span>📺 {schedule.old_count}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Date Details Modal */}
        {selectedDate && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setSelectedDate(null)}
          >
            <div
              className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-100">
                  📅 {selectedDate.date}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-200">Total Videos</span>
                  <span className="font-bold text-gray-100">{selectedDate.total}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-200">New Videos</span>
                  <span className="font-bold text-green-400">
                    {selectedDate.new_count}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-200">Old Videos</span>
                  <span className="font-bold text-blue-400">{selectedDate.old_count}</span>
                </div>

                <div className="border-t border-gray-600 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Pending</span>
                    <span className="font-medium text-gray-200">{selectedDate.pending}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-400">Processing</span>
                    <span className="font-medium text-gray-200">{selectedDate.processing}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Ready</span>
                    <span className="font-medium text-gray-200">{selectedDate.ready}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-400">Published</span>
                    <span className="font-medium text-gray-200">{selectedDate.published}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Failed</span>
                    <span className="font-medium text-gray-200">{selectedDate.failed}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedDate(null);
                    onNavigateScheduleToday();
                  }}
                  className="block w-full mt-4 px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Full Schedule →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleCalendar;
