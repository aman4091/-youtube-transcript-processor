// Supabase Edge Function: generate-daily-schedule
// Generates daily schedule with smart video selection and uniqueness rules

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
    console.log('🗓️ Starting daily schedule generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date (tomorrow by default)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', 'default_user')
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

    // Check if schedule exists
    const { data: existing } = await supabase
      .from('scheduled_videos')
      .select('id')
      .eq('schedule_date', date)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ message: `Schedule for ${date} already exists`, skipped: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const targetChannels = config.target_channels || [];
    if (targetChannels.length === 0) {
      throw new Error('No target channels configured');
    }

    // Calculate day number
    const startDate = config.system_start_date || date;
    const dayNumber = Math.floor(
      (new Date(date).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const requiresNew = dayNumber >= 6;
    const newPerChannel = requiresNew ? 1 : 0;
    const oldPerChannel = requiresNew ? 3 : 4;

    console.log(`Day ${dayNumber}: ${newPerChannel} new + ${oldPerChannel} old per channel`);

    // Select videos for each channel
    const usedToday: string[] = [];
    let totalScheduled = 0;

    for (const channel of targetChannels.filter((c: any) => c.active)) {
      const channelVideos: any[] = [];

      // Select NEW videos (Day 6+)
      if (newPerChannel > 0) {
        const newVideos = await selectVideos(supabase, 'new', channel.id, usedToday, date, newPerChannel);
        channelVideos.push(...newVideos);
        usedToday.push(...newVideos.map((v: any) => v.video_id));
      }

      // Select OLD videos
      const oldVideos = await selectVideos(supabase, 'old', channel.id, usedToday, date, oldPerChannel);
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
        });

        // Update usage tracker
        await supabase.from('video_usage_tracker').insert({
          video_id: video.video_id,
          used_date: date,
          target_channel_id: channel.id,
          target_channel_name: channel.name,
        });

        totalScheduled++;
      }
    }

    // Update config
    await supabase
      .from('schedule_config')
      .update({ last_schedule_generated_date: date })
      .eq('user_id', 'default_user');

    console.log(`✅ Scheduled ${totalScheduled} videos for ${date}`);

    return new Response(
      JSON.stringify({
        success: true,
        date,
        total_videos: totalScheduled,
        day_number: dayNumber,
        message: `Generated schedule for ${date}`,
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

// Helper: Select videos with uniqueness rules
async function selectVideos(supabase: any, type: string, channelId: string, exclude: string[], date: string, count: number) {
  const table = type === 'new' ? 'video_pool_new' : 'video_pool_old';

  // Get recent usage (15 days same channel, 10 days cross channel)
  const { data: recentSame } = await supabase
    .from('video_usage_tracker')
    .select('video_id')
    .eq('target_channel_id', channelId)
    .gte('used_date', subtractDays(date, 15));

  const { data: recentCross } = await supabase
    .from('video_usage_tracker')
    .select('video_id')
    .neq('target_channel_id', channelId)
    .gte('used_date', subtractDays(date, 10));

  const excludeAll = [
    ...exclude,
    ...(recentSame?.map((r: any) => r.video_id) || []),
    ...(recentCross?.map((r: any) => r.video_id) || []),
  ];

  const { data: videos } = await supabase
    .from(table)
    .select('*')
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
