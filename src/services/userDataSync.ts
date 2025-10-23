// User Data Sync Service
// Handles synchronization between localStorage and database
// Supports real-time sync, conflict detection, backup/restore

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SyncResult {
  success: boolean;
  hasConflict?: boolean;
  serverData?: any;
  error?: string;
}

export interface BackupData {
  version: number;
  exported_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
  };
  data: {
    settings: any;
    history: any[];
    queue: any[];
    counter: number;
  };
  metadata: {
    total_history: number;
    total_queue: number;
  };
}

// ============================================
// SYNC TO DATABASE
// ============================================

/**
 * Sync settings to database
 */
export async function syncSettings(user_id: string, settings: any, client_timestamp?: number): Promise<SyncResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-user-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        store_type: 'settings',
        data: {
          api_keys: {
            supaDataApiKeys: settings.supaDataApiKeys || [],
            deepSeekApiKey: settings.deepSeekApiKey || '',
            geminiApiKey: settings.geminiApiKey || '',
            openRouterApiKey: settings.openRouterApiKey || '',
            youtubeApiKey: settings.youtubeApiKey || '',
          },
          source_channels: settings.channelUrls || [],
          target_channels: settings.targetChannels || [],
          channel_min_durations: settings.channelMinDurations || {},
          prompts: {
            customPrompt: settings.customPrompt || '',
            titlePrompt: settings.titlePrompt || '',
          },
          telegram_config: {
            botToken: settings.telegramBotToken || '',
            chatId: settings.telegramChatId || '',
            chatIdWithTitle: settings.telegramChatIdWithTitle || '',
          },
          preferences: {
            enableDeepSeek: settings.enableDeepSeek ?? true,
            enableGeminiFlash: settings.enableGeminiFlash ?? true,
            enableGeminiPro: settings.enableGeminiPro ?? true,
            enableOpenRouter: settings.enableOpenRouter ?? true,
            videoSortOrder: settings.videoSortOrder || 'popular',
            selectedOpenRouterModel: settings.selectedOpenRouterModel || '',
            autoMonitoringEnabled: settings.autoMonitoringEnabled ?? false,
            monitoringIntervalHours: settings.monitoringIntervalHours || 2,
            monitoringAIModel: settings.monitoringAIModel || 'deepseek',
            autoRemoveExhaustedKeys: settings.autoRemoveExhaustedKeys ?? false,
          },
        },
        client_timestamp,
      }),
    });

    return await response.json();
  } catch (error: any) {
    console.error('Settings sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync history to database
 */
export async function syncHistory(user_id: string, history: any[]): Promise<SyncResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-user-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        store_type: 'history',
        data: history,
      }),
    });

    return await response.json();
  } catch (error: any) {
    console.error('History sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync queue to database
 */
export async function syncQueue(user_id: string, queue: any[]): Promise<SyncResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-user-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        store_type: 'queue',
        data: queue,
      }),
    });

    return await response.json();
  } catch (error: any) {
    console.error('Queue sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync counter to database
 */
export async function syncCounter(user_id: string, counter: number, client_timestamp?: number): Promise<SyncResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-user-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        store_type: 'counter',
        data: counter,
        client_timestamp,
      }),
    });

    return await response.json();
  } catch (error: any) {
    console.error('Counter sync error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// LOAD FROM DATABASE
// ============================================

/**
 * Load all user data from database on login
 * Uses export-backup to get all data efficiently
 */
export async function loadUserData(user_id: string) {
  try {
    console.log('🔄 Loading user data from database...');

    // Use export backup to fetch all data at once
    const result = await exportBackup(user_id);

    if (!result.success || !result.data) {
      console.log('⚠️ No data found in database, using defaults');
      return {
        success: true,
        data: {
          settings: null,
          history: [],
          queue: [],
          counter: 0,
        },
      };
    }

    console.log('✓ User data loaded successfully');

    // Extract data from backup format
    const backupData = result.data.data;

    return {
      success: true,
      data: {
        settings: backupData.settings || null,
        history: backupData.history || [],
        queue: backupData.queue || [],
        counter: backupData.counter || 0,
      },
    };
  } catch (error: any) {
    console.error('Load user data error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// BACKUP / RESTORE
// ============================================

/**
 * Export user backup
 */
export async function exportBackup(user_id: string): Promise<{ success: boolean; data?: BackupData; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/export-user-backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    if (!response.ok) {
      throw new Error('Failed to export backup');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('Export backup error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import user backup
 */
export async function importBackup(
  user_id: string,
  backup: BackupData,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean; restored?: any; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/import-user-backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id, backup, mode }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Import backup error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CASCADE DELETE
// ============================================

/**
 * Delete data when source channel is removed
 */
export async function cascadeDeleteChannel(_user_id: string, channelUrl: string) {
  // This will be handled on backend when settings are synced
  // Frontend just needs to call syncSettings with updated channel list
  console.log(`Cascade delete for channel: ${channelUrl}`);
}

/**
 * Delete data when target channel is removed
 */
export async function cascadeDeleteTargetChannel(_user_id: string, targetChannelId: string) {
  // This will be handled on backend when settings are synced
  console.log(`Cascade delete for target channel: ${targetChannelId}`);
}
