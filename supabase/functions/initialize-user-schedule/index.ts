// Initialize schedule system for a user
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const user_id = body.user_id;

    console.log(`🚀 Initializing schedule system for user: ${user_id}`);

    // Check if config exists
    const { data: existingConfig, error: checkError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!existingConfig) {
      console.log('Creating new schedule_config...');

      const { error: insertError } = await supabase
        .from('schedule_config')
        .insert({
          user_id,
          source_channel_id: 'default',
          source_channel_name: 'Default Source',
          source_channel_url: 'https://youtube.com',
          system_status: 'active',
          system_start_date: new Date().toISOString().split('T')[0],
          target_channels: [
            {
              id: 'gyh_channel',
              name: 'GYH Channel',
              active: true,
            }
          ],
          videos_per_channel: 4,
        });

      if (insertError) throw insertError;
      console.log('✅ Config created');
    } else {
      console.log('✅ Config already exists');

      // Make sure it's active
      if (existingConfig.system_status !== 'active') {
        await supabase
          .from('schedule_config')
          .update({ system_status: 'active' })
          .eq('user_id', user_id);
        console.log('✅ Config activated');
      }
    }

    // Clear old scheduled_videos
    console.log('🗑️ Clearing old scheduled videos...');
    const { count } = await supabase
      .from('scheduled_videos')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);

    console.log(`✅ Deleted ${count || 0} old videos`);

    // Generate fresh schedule
    console.log('📅 Generating fresh schedule...');
    const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-daily-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const genResult = await genResponse.json();

    if (!genResult.success && !genResult.skipped) {
      throw new Error(`Schedule generation failed: ${genResult.error}`);
    }

    console.log('✅ Initialization complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Schedule system initialized successfully',
        schedule_result: genResult,
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
