// Supabase Edge Function: update-processed-script
// Updates processed script content in Google Drive
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

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('scheduled_videos')
      .select('id, processed_script_path')
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
    }

    if (!video.processed_script_path) {
      throw new Error('Video does not have a processed script path');
    }

    // Get Google Drive config
    const { data: configData } = await supabase
      .from('schedule_config')
      .select('google_drive_config')
      .eq('user_id', 'default_user')
      .single();

    if (!configData?.google_drive_config) {
      throw new Error('Google Drive config not found');
    }

    const config = configData.google_drive_config;
    const tokenData = config.tokenData;

    // Get access token
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

    const tokenJson = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenJson.error_description || 'Failed to get access token');
    }

    const accessToken = tokenJson.access_token;

    // Parse file path to get filename
    const fileName = video.processed_script_path.split('/').pop();

    // Search for file by name
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      throw new Error(`File not found in Google Drive: ${fileName}`);
    }

    const fileId = searchData.files[0].id;

    // Update file content using Google Drive API v3 update endpoint
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'text/plain',
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain\r\n\r\n' +
      new_script_content +
      closeDelimiter;

    const updateResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`Failed to update file: ${JSON.stringify(errorData)}`);
    }

    console.log(`✅ Updated processed script for video ${video_id}: ${fileName}`);

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
