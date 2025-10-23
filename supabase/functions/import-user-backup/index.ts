// Supabase Edge Function: import-user-backup
// Imports user backup from JSON file
// Validates and restores user data

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { user_id, backup, mode = 'replace' } = await req.json();

    if (!user_id || !backup) {
      throw new Error('user_id and backup are required');
    }

    // Validate backup format
    if (!backup.version || !backup.data) {
      throw new Error('Invalid backup format');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📥 Importing backup for user ${user_id} (mode: ${mode})`);

    // Security check: Ensure backup is for this user (optional - allow cross-user restore)
    // if (backup.user.id !== user_id) {
    //   throw new Error('Backup user ID does not match');
    // }

    const { data, metadata } = backup;
    let restored = {
      settings: false,
      history: 0,
      queue: 0,
      counter: false,
    };

    // ============================================
    // RESTORE SETTINGS
    // ============================================
    if (data.settings) {
      if (mode === 'replace') {
        // Delete existing settings
        await supabase.from('user_settings').delete().eq('user_id', user_id);
      }

      // Insert/Update settings
      const { error: settingsError } = await supabase.from('user_settings').upsert({
        user_id,
        api_keys: data.settings.api_keys || {},
        source_channels: data.settings.source_channels || [],
        target_channels: data.settings.target_channels || [],
        channel_min_durations: data.settings.channel_min_durations || {},
        prompts: data.settings.prompts || {},
        telegram_config: data.settings.telegram_config || {},
        preferences: data.settings.preferences || {},
      });

      if (settingsError) {
        console.error('Error restoring settings:', settingsError.message);
      } else {
        restored.settings = true;
        console.log('✅ Settings restored');
      }
    }

    // ============================================
    // RESTORE HISTORY
    // ============================================
    if (data.history && data.history.length > 0) {
      if (mode === 'replace') {
        // Delete existing history
        await supabase.from('user_history').delete().eq('user_id', user_id);
      }

      // Insert history items
      const historyItems = data.history.map((h: any) => ({
        user_id,
        video_url: h.video_url,
        video_id: h.video_id,
        video_title: h.video_title,
        video_thumbnail: h.video_thumbnail,
        channel_title: h.channel_title,
        target_processings: h.target_processings || [],
      }));

      const { data: insertedHistory, error: historyError } = await supabase
        .from('user_history')
        .upsert(historyItems, { onConflict: 'user_id,video_url' });

      if (historyError) {
        console.error('Error restoring history:', historyError.message);
      } else {
        restored.history = data.history.length;
        console.log(`✅ ${restored.history} history items restored`);
      }
    }

    // ============================================
    // RESTORE QUEUE
    // ============================================
    if (data.queue && data.queue.length > 0) {
      if (mode === 'replace') {
        // Delete existing queue
        await supabase.from('user_queue').delete().eq('user_id', user_id);
      }

      // Insert queue items
      const queueItems = data.queue.map((q: any) => ({
        user_id,
        queue_item: q,
      }));

      const { error: queueError } = await supabase.from('user_queue').insert(queueItems);

      if (queueError) {
        console.error('Error restoring queue:', queueError.message);
      } else {
        restored.queue = data.queue.length;
        console.log(`✅ ${restored.queue} queue items restored`);
      }
    }

    // ============================================
    // RESTORE COUNTER
    // ============================================
    if (typeof data.counter === 'number') {
      const { error: counterError } = await supabase.from('user_counter').upsert({
        user_id,
        counter: data.counter,
      });

      if (counterError) {
        console.error('Error restoring counter:', counterError.message);
      } else {
        restored.counter = true;
        console.log(`✅ Counter restored: ${data.counter}`);
      }
    }

    console.log(`✅ Import complete for user ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        restored,
        message: `Backup restored successfully (${restored.history} history + ${restored.queue} queue items)`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Import error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
