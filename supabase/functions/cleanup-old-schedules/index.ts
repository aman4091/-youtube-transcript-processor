// Supabase Edge Function: cleanup-old-schedules
// Deletes Google Drive folders older than 7 days from Schedule folder
// Runs weekly via GitHub Actions

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
    console.log('🗑️ Starting cleanup of old schedule folders...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Google Drive config
    const { data: config } = await supabase
      .from('schedule_config')
      .select('google_drive_config')
      .eq('user_id', 'default_user')
      .single();

    if (!config || !config.google_drive_config) {
      throw new Error('Google Drive config not found');
    }

    const driveConfig = config.google_drive_config;
    const accessToken = await getGoogleDriveAccessToken(driveConfig);

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Access token obtained');

    // Find "Schedule" folder inside YouTube Scheduler folder
    const scheduleFolderId = await findFolder('Schedule', driveConfig.folderId, accessToken);

    if (!scheduleFolderId) {
      console.log('⚠️ Schedule folder not found - nothing to cleanup');
      return new Response(
        JSON.stringify({ success: true, message: 'No Schedule folder found', deleted: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log(`📁 Schedule folder ID: ${scheduleFolderId}`);

    // Get all date folders inside Schedule folder
    const dateFolders = await listFolders(scheduleFolderId, accessToken);
    console.log(`📦 Found ${dateFolders.length} date folders`);

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`🗓️ Cutoff date: ${cutoffString} (folders older than this will be deleted)`);

    let deletedCount = 0;
    const deletedFolders: string[] = [];

    for (const folder of dateFolders) {
      // Check if folder name is a valid date (YYYY-MM-DD format)
      const dateMatch = folder.name.match(/^\d{4}-\d{2}-\d{2}$/);

      if (dateMatch && folder.name < cutoffString) {
        console.log(`🗑️ Deleting old folder: ${folder.name}`);

        try {
          await deleteFolder(folder.id, accessToken);
          deletedCount++;
          deletedFolders.push(folder.name);
          console.log(`✅ Deleted: ${folder.name}`);
        } catch (error: any) {
          console.error(`❌ Failed to delete ${folder.name}: ${error.message}`);
        }

        // Rate limit: 1 second delay between deletions
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (dateMatch) {
        console.log(`⏭️ Keeping recent folder: ${folder.name}`);
      } else {
        console.log(`⚠️ Skipping non-date folder: ${folder.name}`);
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} folders deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        folders: deletedFolders,
        cutoff_date: cutoffString,
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

// Get Google Drive access token
async function getGoogleDriveAccessToken(config: any): Promise<string | null> {
  try {
    const tokenData = config.tokenData;

    const refreshToken = tokenData.refresh_token;
    const client_id = tokenData.client_id;
    const client_secret = tokenData.client_secret;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        client_secret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    return data.access_token;
  } catch (error: any) {
    console.error(`❌ Token error: ${error.message}`);
    return null;
  }
}

// Find folder by name
async function findFolder(
  name: string,
  parentId: string,
  accessToken: string
): Promise<string | null> {
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  return null;
}

// List all folders in a parent folder
async function listFolders(
  parentId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  return data.files || [];
}

// Delete a folder
async function deleteFolder(folderId: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.statusText}`);
  }
}
