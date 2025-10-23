// Supabase Edge Function: sync-new-videos-pool
// Syncs new videos from monitoring system to video_pool_new
// Called by GitHub Actions every hour

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
    console.log('🔄 Starting new video pool sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Syncing new video pool for user: ${user_id}`);

    // Get last sync time
    const { data: config } = await supabase
      .from('schedule_config')
      .select('updated_at')
      .eq('user_id', user_id)
      .single();

    const lastSync = config?.updated_at || new Date(0).toISOString();

    // Fetch new processed videos from monitoring system
    // Filter: status = 'success', created after last sync, 27+ minutes duration
    const { data: processedVideos, error } = await supabase
      .from('processed_videos')
      .select('*')
      .eq('status', 'success')
      .gte('created_at', lastSync)
      .gte('transcript_length', 27 * 60 * 4); // ~4 chars/second

    if (error) {
      throw new Error(`Failed to fetch processed videos: ${error.message}`);
    }

    if (!processedVideos || processedVideos.length === 0) {
      console.log('No new videos to sync');
      return new Response(
        JSON.stringify({ message: 'No new videos to sync', synced: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log(`📦 Found ${processedVideos.length} new processed videos`);

    let synced = 0;
    let existing = 0;

    for (const video of processedVideos) {
      // Check if already in pool
      const { data: existingVideo } = await supabase
        .from('video_pool_new')
        .select('id')
        .eq('video_id', video.video_id)
        .eq('user_id', user_id)
        .single();

      if (existingVideo) {
        existing++;
        continue;
      }

      // Insert into new video pool
      const { error: insertError } = await supabase.from('video_pool_new').insert({
        video_id: video.video_id,
        title: video.video_title,
        duration: Math.floor(video.transcript_length / 4), // Rough estimate
        view_count: 0,
        published_at: video.processed_at,
        source_channel_id: video.channel_id || 'unknown',
        processed_script_path: null,
        status: 'active',
        user_id: user_id,
      });

      if (insertError) {
        console.error(`Error inserting video ${video.video_id}:`, insertError.message);
        continue;
      }

      synced++;
      console.log(`✅ Synced: ${video.video_id}`);
    }

    // Get total count
    const { count } = await supabase
      .from('video_pool_new')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    console.log(`✅ Sync complete: ${synced} new, ${existing} existing, ${count} total`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        existing,
        total: count || 0,
        message: `Synced ${synced} new videos`,
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
