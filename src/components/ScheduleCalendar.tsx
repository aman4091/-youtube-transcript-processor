import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

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

const ScheduleCalendar: React.FC = () => {
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
    return date.toISOString().split('T')[0];
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Calendar</h1>
        <p className="text-gray-600">Overview of all scheduled publishing dates</p>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ← Previous
          </button>

          <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>

          <button
            onClick={nextMonth}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Next →
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
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
        <div className="text-center py-12 text-gray-600">Loading calendar...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-sm font-semibold text-gray-700"
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
                    min-h-24 p-2 border-b border-r border-gray-200
                    ${!date ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}
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
                            ${today ? 'text-blue-600 font-bold' : 'text-gray-700'}
                          `}
                        >
                          {date.getDate()}
                        </span>
                        {today && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
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
                          <div className="text-xs text-gray-600">
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                📅 {selectedDate.date}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">Total Videos</span>
                <span className="font-bold text-gray-900">{selectedDate.total}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">New Videos</span>
                <span className="font-bold text-green-600">
                  {selectedDate.new_count}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">Old Videos</span>
                <span className="font-bold text-blue-600">{selectedDate.old_count}</span>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-medium">{selectedDate.pending}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Processing</span>
                  <span className="font-medium">{selectedDate.processing}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Ready</span>
                  <span className="font-medium">{selectedDate.ready}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-purple-600">Published</span>
                  <span className="font-medium">{selectedDate.published}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Failed</span>
                  <span className="font-medium">{selectedDate.failed}</span>
                </div>
              </div>

              <a
                href={`/schedule-today?date=${selectedDate.date}`}
                className="block w-full mt-4 px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700"
              >
                View Full Schedule →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;
