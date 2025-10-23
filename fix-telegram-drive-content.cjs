const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'supabase', 'functions', 'bulk-push-to-telegram', 'index.ts');

const newContent = `// Supabase Edge Function: bulk-push-to-telegram
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

    // Get video IDs from request body
    const body = await req.json();
    const videoIds = body.video_ids;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new Error('video_ids array is required');
    }

    console.log(\`📹 Pushing \${videoIds.length} selected videos\`);

    // Get settings
    const { data: config } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (!config) {
      throw new Error('Configuration not found');
    }

    const telegramChannelId = config.telegram_channel_id;
    const telegramBotToken = config.telegram_bot_token;

    if (!telegramChannelId || !telegramBotToken) {
      throw new Error('Telegram credentials not configured');
    }

    // Fetch selected videos by IDs
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .in('id', videoIds)
      .eq('status', 'ready')
      .order('target_channel_name', { ascending: true })
      .order('slot_number', { ascending: true });

    if (error) {
      throw new Error(\`Failed to fetch ready videos: \${error.message}\`);
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

    console.log(\`📦 Found \${videos.length} ready videos\`);

    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const video of videos) {
      const result = await sendVideoToTelegram(
        video,
        telegramChannelId,
        telegramBotToken,
        supabase
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

        console.log(\`✅ Sent: \${result.filename}\`);
      } else {
        failed++;
        console.error(\`❌ Failed: \${result.filename} - \${result.error}\`);
      }

      // Rate limit: 2 second delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(\`✅ Bulk push complete: \${sent} sent, \${failed} failed\`);

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

// Refresh Google Drive access token
async function refreshGoogleDriveToken(supabase: any): Promise<string> {
  const { data: config } = await supabase
    .from('schedule_config')
    .select('google_drive_refresh_token')
    .eq('user_id', 'default_user')
    .single();

  if (!config?.google_drive_refresh_token) {
    throw new Error('Google Drive refresh token not found');
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: config.google_drive_refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google Drive token');
  }

  const data = await response.json();
  return data.access_token;
}

// Get file content from Google Drive
async function getFileFromGoogleDrive(
  filePath: string,
  supabase: any
): Promise<string> {
  try {
    const accessToken = await refreshGoogleDriveToken(supabase);

    // Search for file by path
    const fileName = filePath.split('/').pop();
    const searchResponse = await fetch(
      \`https://www.googleapis.com/drive/v3/files?q=name='\${fileName}'&fields=files(id,name)\`,
      {
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for file in Google Drive');
    }

    const searchData = await searchResponse.json();
    if (!searchData.files || searchData.files.length === 0) {
      throw new Error(\`File not found: \${fileName}\`);
    }

    const fileId = searchData.files[0].id;

    // Download file content
    const downloadResponse = await fetch(
      \`https://www.googleapis.com/drive/v3/files/\${fileId}?alt=media\`,
      {
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error('Failed to download file from Google Drive');
    }

    const content = await downloadResponse.text();
    return content;
  } catch (error: any) {
    console.error(\`Error fetching from Google Drive: \${error.message}\`);
    throw error;
  }
}

// Send single video to Telegram
async function sendVideoToTelegram(
  video: any,
  channelId: string,
  botToken: string,
  supabase: any
): Promise<{
  filename: string;
  messageId: string | null;
  success: boolean;
  error?: string;
}> {
  try {
    // Generate filename: YYYY-MM-DD_ChannelName_VideoN.txt
    const filename = \`\${video.schedule_date}_\${sanitizeFilename(video.target_channel_name)}_Video\${video.slot_number}.txt\`;

    // Fetch actual content from Google Drive
    let content: string;

    if (video.processed_script_path) {
      try {
        console.log(\`📥 Fetching script from Google Drive: \${video.processed_script_path}\`);
        content = await getFileFromGoogleDrive(video.processed_script_path, supabase);
        console.log(\`✅ Successfully fetched script (\${content.length} characters)\`);
      } catch (error: any) {
        console.error(\`❌ Failed to fetch from Google Drive: \${error.message}\`);
        // Fallback to placeholder
        content = \`Video: \${video.video_title}\\nVideo ID: \${video.video_id}\\nChannel: \${video.target_channel_name}\\nSlot: \${video.slot_number}\\nType: \${video.video_type}\\n\\n[Error fetching script: \${error.message}]\`;
      }
    } else {
      // No processed_script_path available
      content = \`Video: \${video.video_title}\\nVideo ID: \${video.video_id}\\nChannel: \${video.target_channel_name}\\nSlot: \${video.slot_number}\\nType: \${video.video_type}\\n\\n[No processed script available]\`;
    }

    // Create file blob
    const fileBlob = new Blob([content], { type: 'text/plain' });

    // Prepare form data
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('document', fileBlob, filename);
    formData.append(
      'caption',
      \`📅 \${video.schedule_date}\\n🎯 \${video.target_channel_name}\\n📺 \${video.video_title}\`
    );

    // Send to Telegram
    const response = await fetch(
      \`https://api.telegram.org/bot\${botToken}/sendDocument\`,
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
      filename: \`\${video.schedule_date}_\${video.target_channel_name}_Video\${video.slot_number}.txt\`,
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
`;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✅ Updated bulk-push-to-telegram/index.ts with Google Drive content fetching');
