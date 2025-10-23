// Supabase Edge Function: generate-daily-schedule
// Generates 7-day rolling schedule with smart video selection and uniqueness rules

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
    console.log('🗓️ Starting 7-day rolling schedule generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request
    const body = await req.json();
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Generating schedule for user: ${user_id}`);

    // Fetch config first
    const { data: config, error: configError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuration not found');
    }

    if (config.system_status !== 'active') {
      return new Response(
        JSON.stringify({ message: 'System is paused', skipped: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Generate 7 dates (today + next 6 days)
    const today = new Date();
    const datesToGenerate: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesToGenerate.push(date.toISOString().split('T')[0]);
    }

    console.log(`📅 Checking dates: ${datesToGenerate.join(', ')}`);

    // Check which dates already exist for this user
    const { data: existingSchedules } = await supabase
      .from('scheduled_videos')
      .select('schedule_date')
      .eq('user_id', user_id)
      .in('schedule_date', datesToGenerate);

    const existingDates = new Set(
      (existingSchedules || []).map((s: any) => s.schedule_date)
    );

    const missingDates = datesToGenerate.filter(date => !existingDates.has(date));

    if (missingDates.length === 0) {
      console.log('✅ All 7 days already scheduled');
      return new Response(
        JSON.stringify({
          message: 'All 7 days already scheduled',
          dates: datesToGenerate,
          skipped: true
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log(`🆕 Generating schedules for: ${missingDates.join(', ')}`);

    const targetChannels = config.target_channels || [];
    if (targetChannels.length === 0) {
      throw new Error('No target channels configured');
    }

    const startDate = config.system_start_date || today.toISOString().split('T')[0];
    let totalVideosScheduled = 0;

    // Generate schedule for each missing date
    for (const date of missingDates) {
      console.log(`\n📆 Generating schedule for ${date}...`);

      // Calculate day number
      const dayNumber = Math.floor(
        (new Date(date).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      const requiresNew = dayNumber >= 6;
      const newPerChannel = requiresNew ? 1 : 0;
      const oldPerChannel = requiresNew ? 3 : 4;

      console.log(`Day ${dayNumber}: ${newPerChannel} new + ${oldPerChannel} old per channel`);

      // Select videos for each channel
      const usedToday: string[] = [];

      for (const channel of targetChannels.filter((c: any) => c.active)) {
        const channelVideos: any[] = [];

        // Select NEW videos (Day 6+)
        if (newPerChannel > 0) {
          const newVideos = await selectVideos(supabase, 'new', channel.id, usedToday, date, newPerChannel, user_id);
          channelVideos.push(...newVideos);
          usedToday.push(...newVideos.map((v: any) => v.video_id));
        }

        // Select OLD videos
        const oldVideos = await selectVideos(supabase, 'old', channel.id, usedToday, date, oldPerChannel, user_id);
        channelVideos.push(...oldVideos);
        usedToday.push(...oldVideos.map((v: any) => v.video_id));

        // Shuffle and assign slots
        shuffleArray(channelVideos);

        // Insert into database
        for (let i = 0; i < channelVideos.length; i++) {
          const video = channelVideos[i];
          await supabase.from('scheduled_videos').insert({
            schedule_date: date,
            target_channel_id: channel.id,
            target_channel_name: channel.name,
            slot_number: i + 1,
            video_id: video.video_id,
            video_title: video.title,
            video_type: video.type,
            status: 'pending',
            user_id: user_id,
          });

          // Update usage tracker (same user)
          await supabase.from('video_usage_tracker').insert({
            video_id: video.video_id,
            used_date: date,
            target_channel_id: channel.id,
            target_channel_name: channel.name,
            user_id: user_id,
          });

          // Track cross-user usage (for 10-day gap enforcement)
          await supabase.from('cross_user_video_usage').insert({
            video_id: video.video_id,
            used_date: date,
            user_id: user_id,
            source_channel_id: video.source_channel_id || null,
            target_channel_name: channel.name,
          });

          totalVideosScheduled++;
        }

        console.log(`  ✓ ${channel.name}: ${channelVideos.length} videos scheduled`);
      }
    }

    // Update config
    const lastGeneratedDate = missingDates[missingDates.length - 1];
    await supabase
      .from('schedule_config')
      .update({ last_schedule_generated_date: lastGeneratedDate })
      .eq('user_id', 'default_user');

    console.log(`\n✅ Schedule generation complete!`);
    console.log(`   Dates generated: ${missingDates.length}`);
    console.log(`   Total videos: ${totalVideosScheduled}`);

    return new Response(
      JSON.stringify({
        success: true,
        dates_generated: missingDates,
        total_videos: totalVideosScheduled,
        all_dates: datesToGenerate,
        existing_dates: Array.from(existingDates),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});

// Helper: Select videos with uniqueness rules + cross-user gap
async function selectVideos(supabase: any, type: string, channelId: string, exclude: string[], date: string, count: number, user_id: string) {
  const table = type === 'new' ? 'video_pool_new' : 'video_pool_old';

  // Get recent usage by SAME user (15 days same channel, 10 days cross channel)
  const { data: recentSame } = await supabase
    .from('video_usage_tracker')
    .select('video_id')
    .eq('user_id', user_id)
    .eq('target_channel_id', channelId)
    .gte('used_date', subtractDays(date, 15));

  const { data: recentCross } = await supabase
    .from('video_usage_tracker')
    .select('video_id')
    .eq('user_id', user_id)
    .neq('target_channel_id', channelId)
    .gte('used_date', subtractDays(date, 10));

  // Get cross-user usage (10-day gap for OTHER users)
  const { data: crossUserRecent } = await supabase
    .from('cross_user_video_usage')
    .select('video_id')
    .neq('user_id', user_id)
    .gte('used_date', subtractDays(date, 10));

  const excludeAll = [
    ...exclude,
    ...(recentSame?.map((r: any) => r.video_id) || []),
    ...(recentCross?.map((r: any) => r.video_id) || []),
    ...(crossUserRecent?.map((r: any) => r.video_id) || []),
  ];

  // Filter by user_id for this user's video pool
  const { data: videos } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .not('video_id', 'in', `(${excludeAll.length > 0 ? excludeAll.join(',') : 'NULL'})`)
    .order(type === 'old' ? 'view_count' : 'added_at', { ascending: false })
    .limit(count * 2);

  if (!videos || videos.length < count) {
    throw new Error(`Not enough ${type} videos for channel ${channelId}`);
  }

  return videos.slice(0, count).map((v: any) => ({
    video_id: v.video_id,
    title: v.title,
    type,
  }));
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function shuffleArray(arr: any[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
