// Supabase Edge Function: initialize-user
// Creates required database entries for new users
// Uses service_role_key to bypass RLS policies

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
    console.log('🔧 Initializing user...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request
    const body = await req.json();
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Initializing user: ${user_id}`);

    // 1. Create schedule_config entry
    const { error: configError } = await supabase
      .from('schedule_config')
      .upsert({
        user_id: user_id,
        source_channel_id: '',
        source_channel_name: '',
        source_channel_url: '',
        target_channels: [],
        videos_per_channel: 4,
        system_status: 'active',
      }, {
        onConflict: 'user_id'
      });

    if (configError && !configError.message.includes('duplicate')) {
      console.error('❌ Failed to create schedule_config:', configError);
      throw configError;
    } else {
      console.log('✓ Schedule config initialized');
    }

    // 2. Create auto_monitor_settings entry
    const { error: monitorError } = await supabase
      .from('auto_monitor_settings')
      .upsert({
        user_id: user_id,
        enabled: false,
        check_interval_hours: 2,
      }, {
        onConflict: 'user_id'
      });

    if (monitorError && !monitorError.message.includes('duplicate')) {
      console.warn('⚠️ Auto-monitor settings not created:', monitorError.message);
    } else {
      console.log('✓ Auto-monitor settings initialized');
    }

    console.log('✅ User initialization complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User initialized successfully',
        user_id: user_id,
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
