// Supabase Edge Function: sync-user-data
// Syncs user data (settings, history, queue, counter) to database
// Supports real-time sync with conflict detection

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
    const { user_id, store_type, data, client_timestamp } = await req.json();

    if (!user_id || !store_type || !data) {
      throw new Error('user_id, store_type, and data are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📤 Syncing ${store_type} for user ${user_id}`);

    let result;
    let hasConflict = false;

    switch (store_type) {
      case 'settings':
        result = await syncSettings(supabase, user_id, data, client_timestamp);
        hasConflict = result.hasConflict;
        break;

      case 'history':
        result = await syncHistory(supabase, user_id, data);
        break;

      case 'queue':
        result = await syncQueue(supabase, user_id, data);
        break;

      case 'counter':
        result = await syncCounter(supabase, user_id, data, client_timestamp);
        hasConflict = result.hasConflict;
        break;

      default:
        throw new Error(`Invalid store_type: ${store_type}`);
    }

    console.log(`✅ Sync complete for ${store_type}`);

    return new Response(
      JSON.stringify({
        success: true,
        hasConflict,
        serverData: result.serverData || null,
        message: hasConflict
          ? 'Conflict detected - server has newer data'
          : 'Synced successfully',
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
    console.error('❌ Sync error:', error.message);
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

// ============================================
// SETTINGS SYNC
// ============================================
async function syncSettings(supabase: any, user_id: string, data: any, client_timestamp?: number) {
  // Check for conflicts
  const { data: existing, error: fetchError } = await supabase
    .from('user_settings')
    .select('updated_at')
    .eq('user_id', user_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to check settings: ${fetchError.message}`);
  }

  // Conflict detection
  if (existing && client_timestamp) {
    const serverTimestamp = new Date(existing.updated_at).getTime();
    if (serverTimestamp > client_timestamp) {
      // Server has newer data - conflict!
      const { data: serverData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user_id)
        .single();

      return { hasConflict: true, serverData };
    }
  }

  // No conflict - upsert
  const { error: upsertError } = await supabase
    .from('user_settings')
    .upsert({
      user_id,
      api_keys: data.api_keys || {},
      source_channels: data.source_channels || [],
      target_channels: data.target_channels || [],
      channel_min_durations: data.channel_min_durations || {},
      prompts: data.prompts || {},
      telegram_config: data.telegram_config || {},
      preferences: data.preferences || {},
    });

  if (upsertError) {
    throw new Error(`Failed to sync settings: ${upsertError.message}`);
  }

  return { hasConflict: false };
}

// ============================================
// HISTORY SYNC
// ============================================
async function syncHistory(supabase: any, user_id: string, data: any[]) {
  // data is array of ProcessedLink objects
  for (const video of data) {
    await supabase.from('user_history').upsert(
      {
        user_id,
        video_url: video.url,
        video_id: video.videoId,
        video_title: video.title,
        video_thumbnail: video.thumbnail,
        channel_title: video.channelTitle,
        target_processings: video.targetChannelProcessings || [],
      },
      { onConflict: 'user_id,video_url' }
    );
  }

  return { hasConflict: false };
}

// ============================================
// QUEUE SYNC
// ============================================
async function syncQueue(supabase: any, user_id: string, data: any[]) {
  // Clear existing queue for this user
  await supabase.from('user_queue').delete().eq('user_id', user_id);

  // Insert new queue items
  if (data.length > 0) {
    const queueItems = data.map((item) => ({
      user_id,
      queue_item: item,
    }));

    const { error } = await supabase.from('user_queue').insert(queueItems);

    if (error) {
      throw new Error(`Failed to sync queue: ${error.message}`);
    }
  }

  return { hasConflict: false };
}

// ============================================
// COUNTER SYNC
// ============================================
async function syncCounter(supabase: any, user_id: string, data: number, client_timestamp?: number) {
  // Check for conflicts
  const { data: existing, error: fetchError } = await supabase
    .from('user_counter')
    .select('counter, updated_at')
    .eq('user_id', user_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to check counter: ${fetchError.message}`);
  }

  // Conflict detection - always take the higher counter
  if (existing) {
    const serverCounter = existing.counter;
    if (serverCounter > data) {
      // Server has higher counter - conflict
      return { hasConflict: true, serverData: { counter: serverCounter } };
    }
  }

  // Upsert counter
  const { error: upsertError } = await supabase
    .from('user_counter')
    .upsert({
      user_id,
      counter: data,
    });

  if (upsertError) {
    throw new Error(`Failed to sync counter: ${upsertError.message}`);
  }

  return { hasConflict: false };
}
