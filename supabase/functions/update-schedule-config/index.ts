// Supabase Edge Function: update-schedule-config
// Updates schedule_config with target channels before schedule generation

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
    console.log('📝 Updating schedule config...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get parameters from request
    const body = await req.json();
    const user_id = body.user_id;
    const target_channels = body.target_channels;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    if (!target_channels || !Array.isArray(target_channels)) {
      throw new Error('target_channels must be an array');
    }

    console.log(`👤 Updating config for user: ${user_id}`);
    console.log(`📋 Target channels: ${target_channels.length}`);

    // Update schedule_config with target channels
    const { error: updateError } = await supabase
      .from('schedule_config')
      .update({
        target_channels: target_channels,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('❌ Failed to update schedule_config:', updateError);
      throw updateError;
    }

    console.log('✅ Schedule config updated successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Schedule config updated',
        user_id: user_id,
        target_channels_count: target_channels.length,
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
