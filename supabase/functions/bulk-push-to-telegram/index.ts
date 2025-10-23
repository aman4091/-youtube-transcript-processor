// Supabase Edge Function: bulk-push-to-telegram
// Bulk sends all ready videos for a date to Telegram Channel 1
// Called manually from web interface

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
    console.log('📤 Starting bulk Telegram push...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video IDs and user_id from request body
    const body = await req.json();
    const videoIds = body.video_ids;
    const user_id = body.user_id;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new Error('video_ids array is required');
    }

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`📹 Pushing ${videoIds.length} selected videos for user ${user_id}`);

    // Get settings for this user
    const { data: config } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!config) {
      throw new Error('Configuration not found');
    }

    const telegramChannelId = config.telegram_channel_id;
    const telegramBotToken = config.telegram_bot_token;

    if (!telegramChannelId || !telegramBotToken) {
      throw new Error('Telegram credentials not configured');
    }

    // Fetch selected videos by IDs (filter by user_id for security)
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .in('id', videoIds)
      .eq('user_id', user_id)
      .eq('status', 'ready')
      .order('target_channel_name', { ascending: true })
      .order('slot_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ready videos: ${error.message}`);
    }

    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No ready videos found for this date', sent: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log(`📦 Found ${videos.length} ready videos`);

    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const video of videos) {
      const result = await sendVideoToTelegram(
        video,
        telegramChannelId,
        telegramBotToken
      );

      results.push(result);

      if (result.success) {
        sent++;

        // Update database
        await supabase
          .from('scheduled_videos')
          .update({
            status: 'published',
            telegram_sent_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        console.log(`✅ Sent: ${result.filename}`);
      } else {
        failed++;
        console.error(`❌ Failed: ${result.filename} - ${result.error}`);
      }

      // Rate limit: 2 second delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`✅ Bulk push complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: videos.length,
        filenames: results.map((r) => r.filename),
        details: results,
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

// Send single video to Telegram
async function sendVideoToTelegram(
  video: any,
  channelId: string,
  botToken: string
): Promise<{
  filename: string;
  messageId: string | null;
  success: boolean;
  error?: string;
}> {
  try {
    // Generate filename: YYYY-MM-DD_ChannelName_VideoN.txt
    const filename = `${video.schedule_date}_${sanitizeFilename(video.target_channel_name)}_Video${video.slot_number}.txt`;

    // Get content from database
    let content: string;

    if (video.processed_script && video.processed_script.trim()) {
      // Use processed script from database
      content = video.processed_script;
      console.log(`✅ Using processed script from database (${content.length} characters)`);
    } else {
      // Fallback
      content = `Video: ${video.video_title}\nVideo ID: ${video.video_id}\nChannel: ${video.target_channel_name}\nSlot: ${video.slot_number}\nType: ${video.video_type}\n\n[No processed script available]`;
      console.log(`⚠️ No processed script found in database for video ${video.id}`);
    }

    // Create file blob
    const fileBlob = new Blob([content], { type: 'text/plain' });

    // Prepare form data
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('document', fileBlob, filename);
    formData.append(
      'caption',
      `📅 ${video.schedule_date}\n🎯 ${video.target_channel_name}\n📺 ${video.video_title}`
    );

    // Send to Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Telegram API error');
    }

    const data = await response.json();

    return {
      filename,
      messageId: data.result?.message_id?.toString() || null,
      success: true,
    };
  } catch (error: any) {
    return {
      filename: `${video.schedule_date}_${video.target_channel_name}_Video${video.slot_number}.txt`,
      messageId: null,
      success: false,
      error: error.message,
    };
  }
}

// Sanitize filename (remove invalid chars)
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}
