import { Youtube, History, Scissors, Sparkles, Settings as SettingsIcon, Send, Activity, Calendar, CalendarDays, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavigationBarProps {
  currentPage?: 'home' | 'history' | 'shorts' | 'title' | 'monitoring' | 'settings' | 'schedule-today' | 'schedule-calendar';
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateShorts: () => void;
  onNavigateTitle: () => void;
  onNavigateMonitoring: () => void;
  onNavigateSettings: () => void;
  onNavigateScheduleToday?: () => void;
  onNavigateScheduleCalendar?: () => void;
  onPushToChat?: () => void;
  queueCount?: number;
}

export default function NavigationBar({
  currentPage = 'home',
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
  queueCount = 0,
}: NavigationBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getButtonClass = (page: string, isMobile = false) => {
    const isActive = currentPage === page;
    const baseClass = isMobile
      ? 'flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all w-full'
      : 'flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-sm transition-all whitespace-nowrap';

    return `${baseClass} ${
      isActive
        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 dark:border-blue-400'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
    }`;
  };

  const handleNavClick = (callback: () => void) => {
    callback();
    setMobileMenuOpen(false);
  };

  return (
    <nav className="w-full bg-white dark:bg-gray-800 sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Mobile: Hamburger + Essential Items */}
          <div className="flex items-center gap-2 md:hidden flex-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Essential items visible on mobile */}
            <button onClick={onNavigateHome} className={getButtonClass('home')}>
              <Youtube className="w-4 h-4" />
            </button>

            {onNavigateScheduleToday && (
              <button onClick={onNavigateScheduleToday} className={getButtonClass('schedule-today')}>
                <Calendar className="w-4 h-4" />
              </button>
            )}

            <button onClick={onNavigateSettings} className={getButtonClass('settings')}>
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop: All navigation links */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            <button onClick={onNavigateHome} className={getButtonClass('home')}>
              <Youtube className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>Home</span>
            </button>

            <button onClick={onNavigateHistory} className={getButtonClass('history')}>
              <History className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>History</span>
            </button>

            <button onClick={onNavigateShorts} className={getButtonClass('shorts')}>
              <Scissors className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="hidden lg:inline">Find Shorts</span>
              <span className="lg:hidden">Shorts</span>
            </button>

            <button onClick={onNavigateTitle} className={getButtonClass('title')}>
              <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>Title</span>
            </button>

            <button onClick={onNavigateMonitoring} className={getButtonClass('monitoring')}>
              <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="hidden lg:inline">Monitoring</span>
              <span className="lg:hidden">Monitor</span>
            </button>

            {onNavigateScheduleToday && (
              <button onClick={onNavigateScheduleToday} className={getButtonClass('schedule-today')}>
                <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="hidden lg:inline">Today</span>
                <span className="lg:hidden">Today</span>
              </button>
            )}

            {onNavigateScheduleCalendar && (
              <button onClick={onNavigateScheduleCalendar} className={getButtonClass('schedule-calendar')}>
                <CalendarDays className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="hidden lg:inline">Calendar</span>
                <span className="lg:hidden">Cal</span>
              </button>
            )}

            <button onClick={onNavigateSettings} className={getButtonClass('settings')}>
              <SettingsIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>Settings</span>
            </button>
          </div>

          {/* Right side action button */}
          {onPushToChat && queueCount > 0 && (
            <button
              onClick={onPushToChat}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all font-medium text-sm shadow-sm hover:shadow-md relative ml-2 sm:ml-4 whitespace-nowrap flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Push to Chat</span>
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {queueCount}
              </span>
            </button>
          )}
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 absolute left-0 right-0 shadow-lg">
            <div className="py-2">
              <button onClick={() => handleNavClick(onNavigateHistory)} className={getButtonClass('history', true)}>
                <History className="w-5 h-5" />
                <span>History</span>
              </button>

              <button onClick={() => handleNavClick(onNavigateShorts)} className={getButtonClass('shorts', true)}>
                <Scissors className="w-5 h-5" />
                <span>Find Shorts</span>
              </button>

              <button onClick={() => handleNavClick(onNavigateTitle)} className={getButtonClass('title', true)}>
                <Sparkles className="w-5 h-5" />
                <span>Title Creator</span>
              </button>

              <button onClick={() => handleNavClick(onNavigateMonitoring)} className={getButtonClass('monitoring', true)}>
                <Activity className="w-5 h-5" />
                <span>Auto Monitor</span>
              </button>

              {onNavigateScheduleCalendar && (
                <button onClick={() => handleNavClick(onNavigateScheduleCalendar)} className={getButtonClass('schedule-calendar', true)}>
                  <CalendarDays className="w-5 h-5" />
                  <span>Schedule Calendar</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
