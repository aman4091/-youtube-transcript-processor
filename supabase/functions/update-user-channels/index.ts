// Supabase Edge Function: update-user-channels
// Updates both schedule_config and auto_monitor_settings with user channels

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
    console.log('📝 Updating user channels...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get parameters from request
    const body = await req.json();
    const user_id = body.user_id;
    const source_channels = body.source_channels;
    const target_channels = body.target_channels;
    const youtube_api_key = body.youtube_api_key;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Updating channels for user: ${user_id}`);
    console.log(`📺 Source channels: ${source_channels?.length || 0}`);
    console.log(`🎯 Target channels: ${target_channels?.length || 0}`);

    // 1. Update schedule_config with target channels
    const { error: scheduleError } = await supabase
      .from('schedule_config')
      .update({
        target_channels: target_channels || [],
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (scheduleError) {
      console.error('❌ Failed to update schedule_config:', scheduleError);
      throw scheduleError;
    }

    console.log('✓ Schedule config updated');

    // 2. Update auto_monitor_settings with source channels and YouTube API key
    const { error: monitorError } = await supabase
      .from('auto_monitor_settings')
      .update({
        source_channels: source_channels || [],
        youtube_api_key: youtube_api_key || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (monitorError) {
      console.error('❌ Failed to update auto_monitor_settings:', monitorError);
      throw monitorError;
    }

    console.log('✓ Auto-monitor settings updated');
    console.log('✅ User channels updated successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User channels updated',
        user_id: user_id,
        source_channels_count: source_channels?.length || 0,
        target_channels_count: target_channels?.length || 0,
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
    console.error('❌ Error:', error.message);
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
