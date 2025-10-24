// User Initialization Service
// Automatically sets up new users with required database entries

import { supabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Initialize new user with all required database entries
 * Called automatically on first login
 */
export async function initializeNewUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔧 Initializing user: ${userId}`);

    // 1. Create schedule_config entry
    const { error: configError } = await supabase
      .from('schedule_config')
      .upsert({
        user_id: userId,
        videos_per_channel: 4, // 3 old + 1 new
        new_videos_per_day: 1,
        last_schedule_generated_date: null,
      }, {
        onConflict: 'user_id'
      });

    if (configError && !configError.message.includes('duplicate')) {
      console.error('❌ Failed to create schedule_config:', configError);
    } else {
      console.log('✓ Schedule config initialized');
    }

    // 2. Create auto_monitor_settings entry (if table exists)
    try {
      const { error: monitorError } = await supabase
        .from('auto_monitor_settings')
        .upsert({
          user_id: userId,
          enabled: false,
          check_interval_hours: 2,
          last_check: null,
        }, {
          onConflict: 'user_id'
        });

      if (monitorError && !monitorError.message.includes('duplicate')) {
        console.warn('⚠️ Auto-monitor settings not created:', monitorError.message);
      } else {
        console.log('✓ Auto-monitor settings initialized');
      }
    } catch (e) {
      console.warn('⚠️ Auto-monitor table may not exist');
    }

    console.log('✅ User initialization complete!');
    return { success: true };

  } catch (error: any) {
    console.error('❌ User initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync video pools for user
 * Call this when user adds channels in settings
 */
export async function syncUserVideoPools(userId: string, channelUrls: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    if (!channelUrls || channelUrls.length === 0) {
      console.log('⚠️ No channels to sync');
      return { success: true };
    }

    console.log(`🔄 Syncing video pools for ${channelUrls.length} channels...`);

    // Call sync-new-videos-pool Edge Function
    const syncNewResponse = await fetch(`${SUPABASE_URL}/functions/v1/sync-new-videos-pool`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!syncNewResponse.ok) {
      console.warn('⚠️ Failed to sync new videos pool');
    } else {
      console.log('✓ New videos pool synced');
    }

    // Call refresh-old-video-pool Edge Function
    const refreshOldResponse = await fetch(`${SUPABASE_URL}/functions/v1/refresh-old-video-pool`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!refreshOldResponse.ok) {
      console.warn('⚠️ Failed to refresh old videos pool');
    } else {
      console.log('✓ Old videos pool refreshed');
    }

    console.log('✅ Video pools synced!');
    return { success: true };

  } catch (error: any) {
    console.error('❌ Video pool sync failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-generate schedule for user
 * Call this after video pools are populated
 */
export async function autoGenerateSchedule(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📅 Auto-generating schedule...');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Schedule generation failed: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Schedule generated:', result);

    return { success: true };

  } catch (error: any) {
    console.error('❌ Schedule generation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete setup for new user
 * 1. Initialize database entries
 * 2. Sync video pools
 * 3. Generate schedule
 */
export async function completeUserSetup(
  userId: string,
  channelUrls: string[],
  targetChannels: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🚀 Starting complete user setup...');

    // Step 1: Initialize
    await initializeNewUser(userId);

    // Step 2: Check if channels and targets exist
    if (!channelUrls || channelUrls.length === 0) {
      console.log('⚠️ No source channels configured yet');
      return { success: true };
    }

    if (!targetChannels || targetChannels.length === 0) {
      console.log('⚠️ No target channels configured yet');
      return { success: true };
    }

    // Step 3: Sync video pools
    await syncUserVideoPools(userId, channelUrls);

    // Step 4: Wait a bit for pools to populate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Generate schedule
    await autoGenerateSchedule(userId);

    console.log('🎉 Complete user setup finished!');
    return { success: true };

  } catch (error: any) {
    console.error('❌ Complete setup failed:', error);
    return { success: false, error: error.message };
  }
}
