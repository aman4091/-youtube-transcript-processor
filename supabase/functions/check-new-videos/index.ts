// Supabase Edge Function: check-new-videos
// Purpose: Cron job that runs every 2 hours to check for new YouTube videos
// and queue them for processing

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Types
interface MonitorSettings {
  enabled: boolean;
  source_channels: string[];
  youtube_api_key: string;
  check_interval_hours: number;
  min_video_duration_minutes: number;
  max_video_duration_minutes: number;
  min_view_count: number;
  keywords_include: string[];
  keywords_exclude: string[];
  max_videos_per_check: number;
}

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string; // ISO 8601 format (PT15M33S)
  viewCount: number;
  url: string;
}

serve(async (req) => {
  // Handle CORS preflight
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
    console.log('🔍 Starting check-new-videos cron job...');
    const startTime = Date.now();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request (optional)
    const body = await req.json().catch(() => ({}));
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Checking new videos for user: ${user_id}`);

    // Step 1: Fetch monitoring settings
    console.log('📥 Fetching monitoring settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (settingsError || !settings) {
      throw new Error(`Failed to fetch settings: ${settingsError?.message}`);
    }

    // Check if monitoring is enabled
    if (!settings.enabled) {
      console.log('⏸️ Monitoring is disabled. Skipping check.');
      return new Response(
        JSON.stringify({ message: 'Monitoring disabled', skipped: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const monitorSettings: MonitorSettings = settings;

    // Validate YouTube API key
    if (!monitorSettings.youtube_api_key) {
      throw new Error('YouTube API key not configured');
    }

    if (
      !monitorSettings.source_channels ||
      monitorSettings.source_channels.length === 0
    ) {
      console.log('⚠️ No source channels configured');
      return new Response(
        JSON.stringify({ message: 'No channels to monitor', skipped: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Step 2: Fetch new videos from all channels
    console.log(
      `🔎 Checking ${monitorSettings.source_channels.length} channels...`
    );
    const allVideos: YouTubeVideo[] = [];
    const channelErrors: string[] = [];

    for (const channelUrl of monitorSettings.source_channels) {
      try {
        const channelId = extractChannelId(channelUrl);
        if (!channelId) {
          console.error(`❌ Invalid channel URL: ${channelUrl}`);
          channelErrors.push(`Invalid URL: ${channelUrl}`);
          continue;
        }

        const videos = await fetchChannelVideos(
          channelId,
          monitorSettings.youtube_api_key,
          monitorSettings.max_videos_per_check || 10
        );

        console.log(`✓ Found ${videos.length} videos from channel ${channelId}`);
        allVideos.push(...videos);
      } catch (error: any) {
        console.error(`❌ Error fetching channel ${channelUrl}:`, error.message);
        channelErrors.push(`${channelUrl}: ${error.message}`);
      }
    }

    // Step 3: Filter videos based on criteria
    console.log(`🔍 Filtering ${allVideos.length} videos...`);
    const filteredVideos = allVideos.filter((video) => {
      // Duration filter
      const durationMinutes = parseDuration(video.duration);
      if (
        durationMinutes < monitorSettings.min_video_duration_minutes ||
        durationMinutes > monitorSettings.max_video_duration_minutes
      ) {
        return false;
      }

      // View count filter
      if (video.viewCount < monitorSettings.min_view_count) {
        return false;
      }

      // Keyword include filter
      if (
        monitorSettings.keywords_include &&
        monitorSettings.keywords_include.length > 0
      ) {
        const hasIncludeKeyword = monitorSettings.keywords_include.some((kw) =>
          video.title.toLowerCase().includes(kw.toLowerCase())
        );
        if (!hasIncludeKeyword) return false;
      }

      // Keyword exclude filter
      if (
        monitorSettings.keywords_exclude &&
        monitorSettings.keywords_exclude.length > 0
      ) {
        const hasExcludeKeyword = monitorSettings.keywords_exclude.some((kw) =>
          video.title.toLowerCase().includes(kw.toLowerCase())
        );
        if (hasExcludeKeyword) return false;
      }

      return true;
    });

    console.log(`✓ ${filteredVideos.length} videos passed filters`);

    // Step 4: Check which videos are already in pool
    const videoIds = filteredVideos.map((v) => v.videoId);
    const { data: poolVideos, error: poolError } = await supabase
      .from('video_pool_new')
      .select('video_id')
      .eq('user_id', user_id)
      .in('video_id', videoIds);

    if (poolError) {
      console.error('❌ Error checking video pool:', poolError);
    }

    const poolVideoIds = new Set(
      poolVideos?.map((v) => v.video_id) || []
    );

    const newVideos = filteredVideos.filter(
      (v) => !poolVideoIds.has(v.videoId)
    );

    console.log(`🆕 ${newVideos.length} new videos to add to pool`);

    // Step 5: Add new videos directly to video_pool_new (NO AI processing)
    let videosAdded = 0;
    if (newVideos.length > 0) {
      // Parse duration to seconds
      const poolEntries = newVideos.map((video) => {
        const durationMinutes = parseDuration(video.duration);
        const durationSeconds = Math.round(durationMinutes * 60);
        return {
          video_id: video.videoId,
          title: video.title,
          duration: durationSeconds,
          view_count: video.viewCount,
          published_at: video.publishedAt,
          source_channel_id: video.channelId,
          times_scheduled: 0,
          status: 'active',
          user_id: user_id,
        };
      });

      const { data: addedData, error: addError } = await supabase
        .from('video_pool_new')
        .insert(poolEntries)
        .select();

      if (addError) {
        console.error('❌ Error adding to pool:', addError);
        throw addError;
      }

      videosAdded = addedData?.length || 0;
      console.log(`✅ Added ${videosAdded} videos to pool (will be processed when scheduled)`);
    }
    // Step 6: Log monitoring check
    const duration = Date.now() - startTime;
    await supabase.from('monitoring_logs').insert({
      channels_checked: monitorSettings.source_channels.length,
      new_videos_found: newVideos.length,
      videos_processed: 0, // Videos added to pool, will process when scheduled
      errors: channelErrors.length,
      status: channelErrors.length > 0 ? 'partial_success' : 'success',
      error_details: channelErrors.length > 0 ? { errors: channelErrors } : null,
      duration_ms: duration,
      api_calls_made: monitorSettings.source_channels.length,
      user_id: user_id,
    });

    console.log(`✅ Check completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        channels_checked: monitorSettings.source_channels.length,
        videos_found: allVideos.length,
        videos_filtered: filteredVideos.length,
        new_videos: newVideos.length,
        videos_added_to_pool: videosAdded,
        errors: channelErrors,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error: any) {
    console.error('❌ Fatal error in check-new-videos:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Extract channel ID from YouTube URL
 */
function extractChannelId(url: string): string | null {
  // Handle different YouTube channel URL formats
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch recent videos from a YouTube channel
 */
async function fetchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults: number
): Promise<YouTubeVideo[]> {
  // Step 1: Get channel's uploads playlist ID
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  );

  if (!channelResponse.ok) {
    throw new Error(`YouTube API error: ${channelResponse.statusText}`);
  }

  const channelData = await channelResponse.json();
  const uploadsPlaylistId =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist');
  }

  // Step 2: Get recent videos from uploads playlist
  const playlistResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`
  );

  if (!playlistResponse.ok) {
    throw new Error(`YouTube API error: ${playlistResponse.statusText}`);
  }

  const playlistData = await playlistResponse.json();
  const videoIds = playlistData.items?.map(
    (item: any) => item.snippet.resourceId.videoId
  );

  if (!videoIds || videoIds.length === 0) {
    return [];
  }

  // Step 3: Get video details (duration, views, etc.)
  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`
  );

  if (!videosResponse.ok) {
    throw new Error(`YouTube API error: ${videosResponse.statusText}`);
  }

  const videosData = await videosResponse.json();

  return videosData.items.map((item: any) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    duration: item.contentDetails.duration,
    viewCount: parseInt(item.statistics.viewCount || '0', 10),
    url: `https://www.youtube.com/watch?v=${item.id}`,
  }));
}

/**
 * Parse ISO 8601 duration to minutes
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 60 + minutes + seconds / 60;
}
