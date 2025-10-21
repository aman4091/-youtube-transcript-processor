// Supabase Edge Function: get-drive-file
// Fetches file content from Google Drive by path
// Used by Telegram bulk sender

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
    const { filePath } = await req.json();

    if (!filePath) {
      throw new Error('filePath is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const fileName = filePath.split('/').pop();

    // Search for file by name
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      throw new Error(`File not found: ${fileName}`);
    }

    const fileId = searchData.files[0].id;

    // Get file content
    const contentResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!contentResponse.ok) {
      throw new Error('Failed to fetch file content');
    }

    const content = await contentResponse.text();

    return new Response(
      JSON.stringify({ success: true, content }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
