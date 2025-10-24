// Supabase Edge Function: refresh-old-video-pool
// Fetches old videos from source channel and refreshes pool
// Called by GitHub Actions weekly

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
    console.log('🔄 Starting old video pool refresh...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Refreshing old video pool for user: ${user_id}`);

    // Get monitor settings (use source_channels from auto_monitor_settings)
    const { data: monitorSettings } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!monitorSettings) {
      throw new Error('Monitor settings not found');
    }

    const sourceChannels = monitorSettings.source_channels || [];
    const youtubeApiKey = monitorSettings.youtube_api_key;

    if (!sourceChannels || sourceChannels.length === 0) {
      throw new Error('No source channels configured in settings');
    }

    if (!youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }

    console.log(`📺 Processing ${sourceChannels.length} source channels...`);

    let totalAdded = 0;
    let totalUpdated = 0;

    // Process each source channel
    for (const channelUrl of sourceChannels) {
      console.log(`\n🔍 Processing channel: ${channelUrl}`);

      // Extract channel ID
      const channelId = extractChannelId(channelUrl);
      if (!channelId) {
        console.log(`⚠️ Skipping invalid channel URL: ${channelUrl}`);
        continue;
      }

    // Get uploads playlist and channel name
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${channelId}&key=${youtubeApiKey}`
    );

    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel details');
    }

    const channelData = await channelResponse.json();
    const uploadsPlaylistId =
      channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    const channelName = channelData.items?.[0]?.snippet?.title || 'Unknown Channel';

    if (!uploadsPlaylistId) {
      throw new Error('Uploads playlist not found');
    }

    console.log(`📺 Channel: ${channelName}`);
    console.log(`📺 Uploads playlist: ${uploadsPlaylistId}`);

    // Fetch videos from playlist (max 200)
    const videoIds: string[] = [];
    let nextPageToken = '';
    let pageCount = 0;
    const maxPages = 4; // 50 per page = 200 total

    while (pageCount < maxPages) {
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken}&key=${youtubeApiKey}`;
      const playlistResponse = await fetch(playlistUrl);

      if (!playlistResponse.ok) break;

      const playlistData = await playlistResponse.json();
      const items = playlistData.items || [];

      for (const item of items) {
        videoIds.push(item.contentDetails.videoId);
      }

      nextPageToken = playlistData.nextPageToken || '';
      pageCount++;

      if (!nextPageToken) break;

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`📦 Found ${videoIds.length} videos`);

    // Fetch video details (duration, views) in batches of 50
    const videos: any[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${batch.join(',')}&key=${youtubeApiKey}`;

      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) continue;

      const detailsData = await detailsResponse.json();

      for (const item of detailsData.items || []) {
        const duration = parseDuration(item.contentDetails.duration);
        const viewCount = parseInt(item.statistics.viewCount || '0', 10);

        // Filter: 27+ minutes
        if (duration >= 27 * 60) {
          videos.push({
            video_id: item.id,
            title: item.snippet.title,
            duration,
            view_count: viewCount,
            published_at: item.snippet.publishedAt,
          });
        }
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`✅ Filtered ${videos.length} videos (27+ min)`);

    // Sort by view count (descending)
    videos.sort((a, b) => b.view_count - a.view_count);

      // Update database for this channel
      let added = 0;
      let updated = 0;

      for (const video of videos) {
        // Check if video exists (regardless of user_id - we'll claim it for this user)
        const { data: existing } = await supabase
          .from('video_pool_old')
          .select('id, user_id')
          .eq('video_id', video.video_id)
          .maybeSingle();

        if (existing) {
          // Update existing video and claim it for this user (fixes NULL user_id videos)
          const { error: updateError } = await supabase
            .from('video_pool_old')
            .update({
              view_count: video.view_count,
              user_id: user_id,  // Set/update user_id to claim this video
              source_channel_id: channelId,
              source_channel_name: channelName,
              status: 'active',  // CRITICAL: Set status to active for schedule queries
              updated_at: new Date().toISOString(),
            })
            .eq('video_id', video.video_id);

          if (updateError) {
            console.error(`❌ Failed to update video ${video.video_id}:`, updateError);
          } else {
            updated++;
          }
        } else {
          // Insert new video
          const { error: insertError } = await supabase.from('video_pool_old').insert({
            video_id: video.video_id,
            title: video.title,
            duration: video.duration,
            view_count: video.view_count,
            published_at: video.published_at,
            source_channel_id: channelId,
            source_channel_name: channelName,
            status: 'active',
            user_id: user_id,
          });

          if (insertError) {
            console.error(`❌ Failed to insert video ${video.video_id}:`, insertError);
          } else {
            added++;
          }
        }
      }

      totalAdded += added;
      totalUpdated += updated;

      console.log(`  ✅ Channel complete: ${added} added, ${updated} updated`);
    }

    // Get total count for THIS user
    const { count } = await supabase
      .from('video_pool_old')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    console.log(`\n✅ Refresh complete: ${totalAdded} added, ${totalUpdated} updated (claimed for user), ${count} total for this user`);

    return new Response(
      JSON.stringify({
        success: true,
        added: totalAdded,
        updated: totalUpdated,
        total: count || 0,
        channels_processed: sourceChannels.length,
        message: `Refreshed old video pool from ${sourceChannels.length} channels`,
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

// Extract channel ID from various YouTube URL formats
function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
