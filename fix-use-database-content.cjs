const fs = require('fs');
const path = require('path');

// Fix 1: Update update-processed-script to store in database too
const updateScriptPath = path.join(__dirname, 'supabase', 'functions', 'update-processed-script', 'index.ts');
const updateScriptContent = `// Supabase Edge Function: update-processed-script
// Updates processed script content in database and Google Drive
// Used for manual editing of AI-processed scripts

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
    const { video_id, new_script_content } = await req.json();

    if (!video_id || !new_script_content) {
      throw new Error('video_id and new_script_content are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // FIRST: Update database with new content
    const { error: updateError } = await supabase
      .from('scheduled_videos')
      .update({ processed_script: new_script_content })
      .eq('id', video_id);

    if (updateError) {
      throw new Error(\`Failed to update database: \${updateError.message}\`);
    }

    console.log(\`✅ Updated processed script in database for video \${video_id}\`);

    // OPTIONAL: Try to update Google Drive (but don't fail if it doesn't work)
    try {
      const { data: video } = await supabase
        .from('scheduled_videos')
        .select('processed_script_path')
        .eq('id', video_id)
        .single();

      if (video?.processed_script_path) {
        const { data: configData } = await supabase
          .from('schedule_config')
          .select('google_drive_config')
          .eq('user_id', 'default_user')
          .single();

        if (configData?.google_drive_config) {
          const config = configData.google_drive_config;
          const tokenData = config.tokenData;

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: tokenData.client_id,
              client_secret: tokenData.client_secret,
              refresh_token: tokenData.refresh_token,
              grant_type: 'refresh_token',
            }),
          });

          if (tokenResponse.ok) {
            const tokenJson = await tokenResponse.json();
            const accessToken = tokenJson.access_token;
            const fileName = video.processed_script_path.split('/').pop();

            const searchResponse = await fetch(
              \`https://www.googleapis.com/drive/v3/files?q=name='\${fileName}' and trashed=false&fields=files(id,name)\`,
              {
                headers: { Authorization: \`Bearer \${accessToken}\` },
              }
            );

            const searchData = await searchResponse.json();

            if (searchData.files && searchData.files.length > 0) {
              const fileId = searchData.files[0].id;

              const updateResponse = await fetch(
                \`https://www.googleapis.com/upload/drive/v3/files/\${fileId}?uploadType=media\`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': \`Bearer \${accessToken}\`,
                    'Content-Type': 'text/plain',
                  },
                  body: new_script_content,
                }
              );

              if (updateResponse.ok) {
                console.log(\`✅ Also updated Google Drive file: \${fileName}\`);
              }
            }
          }
        }
      }
    } catch (driveError: any) {
      console.log(\`⚠️ Google Drive update skipped: \${driveError.message}\`);
      // Don't throw error - database update is enough
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Script updated successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('Error updating processed script:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
`;

// Fix 2: Update bulk-push-to-telegram to use database content
const bulkPushPath = path.join(__dirname, 'supabase', 'functions', 'bulk-push-to-telegram', 'index.ts');
const bulkPushContent = `// Supabase Edge Function: bulk-push-to-telegram
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
    const filename = \`\${video.schedule_date}_\${sanitizeFilename(video.target_channel_name)}_Video\${video.slot_number}.txt\`;

    // Get content from database
    let content: string;

    if (video.processed_script && video.processed_script.trim()) {
      // Use processed script from database
      content = video.processed_script;
      console.log(\`✅ Using processed script from database (\${content.length} characters)\`);
    } else {
      // Fallback
      content = \`Video: \${video.video_title}\\nVideo ID: \${video.video_id}\\nChannel: \${video.target_channel_name}\\nSlot: \${video.slot_number}\\nType: \${video.video_type}\\n\\n[No processed script available]\`;
      console.log(\`⚠️ No processed script found in database for video \${video.id}\`);
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

fs.writeFileSync(updateScriptPath, updateScriptContent, 'utf8');
console.log('✅ Fixed update-processed-script to use database');

fs.writeFileSync(bulkPushPath, bulkPushContent, 'utf8');
console.log('✅ Fixed bulk-push-to-telegram to use database');

console.log('\n🎯 Both functions now use database content (no Google Drive dependency for Telegram)');
