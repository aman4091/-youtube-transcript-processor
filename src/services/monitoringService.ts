import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  AutoMonitorSettings,
  MonitoringStats,
  ProcessedVideo,
  MonitoringLog,
  ProcessingQueue,
  ErrorLog,
  DailyStats,
  ChannelStats,
  SyncSettingsResponse,
} from '../types/monitoring';

// ============================================
// Settings Sync
// ============================================

/**
 * Sync monitoring settings from frontend to Supabase backend
 * This will enable/disable auto-monitoring and update configuration
 */
export async function syncSettingsToSupabase(
  settings: AutoMonitorSettings
): Promise<SyncSettingsResponse> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to environment variables.'
      );
    }

    console.log('🔄 Syncing settings to Supabase...');

    // Call sync-settings Edge Function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to sync settings');
    }

    const data = await response.json();
    console.log('✅ Settings synced successfully');

    return data;
  } catch (error: any) {
    console.error('❌ Error syncing settings:', error);
    throw error;
  }
}

// ============================================
// Monitoring Stats
// ============================================

/**
 * Get current monitoring statistics
 */
export async function getMonitoringStats(): Promise<MonitoringStats | null> {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured');
      return null;
    }

    // Call database function
    const { data, error } = await supabase.rpc('get_monitoring_stats');

    if (error) {
      console.error('❌ Error fetching monitoring stats:', error);
      return null;
    }

    return data as MonitoringStats;
  } catch (error: any) {
    console.error('❌ Error in getMonitoringStats:', error);
    return null;
  }
}

/**
 * Get recent processed videos
 */
export async function getProcessedVideos(
  limit: number = 50
): Promise<ProcessedVideo[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('processed_videos')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching processed videos:', error);
      return [];
    }

    return data as ProcessedVideo[];
  } catch (error: any) {
    console.error('❌ Error in getProcessedVideos:', error);
    return [];
  }
}

/**
 * Get recent monitoring logs
 */
export async function getMonitoringLogs(
  limit: number = 20
): Promise<MonitoringLog[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('monitoring_logs')
      .select('*')
      .order('check_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching monitoring logs:', error);
      return [];
    }

    return data as MonitoringLog[];
  } catch (error: any) {
    console.error('❌ Error in getMonitoringLogs:', error);
    return [];
  }
}

/**
 * Get current processing queue
 */
export async function getProcessingQueue(): Promise<ProcessingQueue[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('processing_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching processing queue:', error);
      return [];
    }

    return data as ProcessingQueue[];
  } catch (error: any) {
    console.error('❌ Error in getProcessingQueue:', error);
    return [];
  }
}

/**
 * Get recent error logs
 */
export async function getErrorLogs(
  limit: number = 20
): Promise<ErrorLog[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching error logs:', error);
      return [];
    }

    return data as ErrorLog[];
  } catch (error: any) {
    console.error('❌ Error in getErrorLogs:', error);
    return [];
  }
}

/**
 * Get daily statistics
 */
export async function getDailyStats(days: number = 7): Promise<DailyStats[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .limit(days);

    if (error) {
      console.error('❌ Error fetching daily stats:', error);
      return [];
    }

    return data as DailyStats[];
  } catch (error: any) {
    console.error('❌ Error in getDailyStats:', error);
    return [];
  }
}

/**
 * Get channel statistics
 */
export async function getChannelStats(): Promise<ChannelStats[]> {
  try {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const { data, error } = await supabase
      .from('channel_stats')
      .select('*')
      .limit(50);

    if (error) {
      console.error('❌ Error fetching channel stats:', error);
      return [];
    }

    return data as ChannelStats[];
  } catch (error: any) {
    console.error('❌ Error in getChannelStats:', error);
    return [];
  }
}

// ============================================
// Manual Triggers
// ============================================

/**
 * Manually trigger a check for new videos (for testing)
 */
export async function triggerManualCheck(): Promise<any> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    console.log('🔍 Triggering manual video check...');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/check-new-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to trigger check');
    }

    const data = await response.json();
    console.log('✅ Manual check triggered:', data);

    return data;
  } catch (error: any) {
    console.error('❌ Error triggering manual check:', error);
    throw error;
  }
}

/**
 * Trigger processing of pending videos
 */
export async function processPendingVideos(): Promise<any> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    console.log('🔄 Triggering pending videos processor...');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/process-pending-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process pending videos');
    }

    const data = await response.json();
    console.log('✅ Pending videos processor triggered:', data);

    return data;
  } catch (error: any) {
    console.error('❌ Error triggering pending videos processor:', error);
    throw error;
  }
}

/**
 * Get current auto-monitor settings from database
 */
export async function getAutoMonitorSettings(): Promise<AutoMonitorSettings | null> {
  try {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const { data, error } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (error) {
      console.error('❌ Error fetching auto-monitor settings:', error);
      return null;
    }

    return data as AutoMonitorSettings;
  } catch (error: any) {
    console.error('❌ Error in getAutoMonitorSettings:', error);
    return null;
  }
}

/**
 * Toggle monitoring on/off
 */
export async function toggleMonitoring(enabled: boolean): Promise<boolean> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase
      .from('auto_monitor_settings')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('user_id', 'default_user');

    if (error) {
      console.error('❌ Error toggling monitoring:', error);
      throw error;
    }

    console.log(`✅ Monitoring ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error: any) {
    console.error('❌ Error in toggleMonitoring:', error);
    return false;
  }
}

// ============================================
// Real-time Subscriptions (Optional)
// ============================================

/**
 * Subscribe to real-time updates for processed videos
 * Usage: const subscription = subscribeToProcessedVideos((payload) => { ... });
 * Cleanup: subscription.unsubscribe();
 */
export function subscribeToProcessedVideos(
  callback: (payload: any) => void
) {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured for real-time subscriptions');
    return { unsubscribe: () => {} };
  }

  return supabase
    .channel('processed_videos_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'processed_videos',
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to real-time updates for monitoring logs
 */
export function subscribeToMonitoringLogs(
  callback: (payload: any) => void
) {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured for real-time subscriptions');
    return { unsubscribe: () => {} };
  }

  return supabase
    .channel('monitoring_logs_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'monitoring_logs',
      },
      callback
    )
    .subscribe();
}
