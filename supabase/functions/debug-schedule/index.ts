// Supabase Edge Function: debug-schedule
// Debug scheduled_videos to see what's wrong

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const user_id = body.user_id;
    const date = body.date || '2025-10-24';

    console.log(`🔍 Debugging schedule for user ${user_id}, date ${date}`);

    // Check total rows in scheduled_videos
    const { count: totalCount } = await supabase
      .from('scheduled_videos')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total scheduled_videos in database: ${totalCount}`);

    // Check rows for this user
    const { data: userVideos, count: userCount } = await supabase
      .from('scheduled_videos')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id);

    console.log(`👤 Total for user ${user_id}: ${userCount}`);

    // Check rows for this date
    const { data: dateVideos, count: dateCount } = await supabase
      .from('scheduled_videos')
      .select('*', { count: 'exact' })
      .eq('schedule_date', date);

    console.log(`📅 Total for date ${date}: ${dateCount}`);

    // Check rows for this user AND date
    const { data: userDateVideos, count: userDateCount } = await supabase
      .from('scheduled_videos')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id)
      .eq('schedule_date', date);

    console.log(`🎯 Total for user ${user_id} AND date ${date}: ${userDateCount}`);

    // Get sample data
    const { data: sampleData } = await supabase
      .from('scheduled_videos')
      .select('schedule_date, user_id, target_channel_name, video_title, status')
      .limit(5);

    console.log('📝 Sample data:', JSON.stringify(sampleData, null, 2));

    // Check RLS policies
    const { data: policies } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
          FROM pg_policies
          WHERE tablename = 'scheduled_videos';
        `
      });

    console.log('🔒 RLS Policies:', JSON.stringify(policies, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        total_in_db: totalCount,
        total_for_user: userCount,
        total_for_date: dateCount,
        total_for_user_and_date: userDateCount,
        sample_data: sampleData,
        user_videos: userVideos,
        date_videos: dateVideos,
        user_date_videos: userDateVideos,
        rls_policies: policies,
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
