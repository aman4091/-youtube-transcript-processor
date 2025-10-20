// =====================================================
// Google Drive Service (Using token.pickle & credentials.json)
// Uploads processed scripts to Google Drive
// =====================================================

import { supabase } from './supabaseClient';

interface GoogleDriveConfig {
  tokenPickle: string; // Base64 encoded token.pickle content
  credentialsJson: string; // credentials.json content as JSON string
  folderId: string; // Root folder ID for all schedules
}

/**
 * Get Google Drive configuration from Supabase
 */
async function getGoogleDriveConfig(): Promise<GoogleDriveConfig | null> {
  try {
    const { data, error } = await supabase
      .from('schedule_config')
      .select('google_drive_config')
      .eq('user_id', 'default_user')
      .single();

    if (error || !data || !data.google_drive_config) {
      console.error('[GoogleDrive] Config not found');
      return null;
    }

    return data.google_drive_config as GoogleDriveConfig;
  } catch (error: any) {
    console.error('[GoogleDrive] Error getting config:', error.message);
    return null;
  }
}

/**
 * Decode token.pickle and get access token
 * Note: token.pickle is a Python pickle file, so we'll use the refresh_token from it
 */
async function getAccessToken(config: GoogleDriveConfig): Promise<string | null> {
  try {
    // Parse credentials.json
    const credentials = JSON.parse(config.credentialsJson);
    const { client_id, client_secret } = credentials.installed || credentials.web;

    // Decode token.pickle (base64) and parse
    // token.pickle contains refresh_token in pickled format
    // For simplicity, we'll expect the config to have the refresh_token extracted
    const tokenData = JSON.parse(atob(config.tokenPickle));
    const refreshToken = tokenData.refresh_token || tokenData.token;

    if (!refreshToken) {
      throw new Error('No refresh token found in token.pickle');
    }

    // Get new access token using refresh token
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

    if (!response.ok) {
      throw new Error(data.error_description || 'Failed to get access token');
    }

    return data.access_token;
  } catch (error: any) {
    console.error('[GoogleDrive] Error getting access token:', error.message);
    return null;
  }
}

/**
 * Create folder in Google Drive
 */
async function createFolder(
  folderName: string,
  parentFolderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Check if folder already exists
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      console.log(`[GoogleDrive] Folder "${folderName}" already exists`);
      return searchData.files[0].id;
    }

    // Create new folder
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to create folder');
    }

    console.log(`[GoogleDrive] Created folder "${folderName}": ${data.id}`);
    return data.id;
  } catch (error: any) {
    console.error('[GoogleDrive] Error creating folder:', error.message);
    return null;
  }
}

/**
 * Upload file to Google Drive
 */
async function uploadFile(
  fileName: string,
  content: string,
  folderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Create metadata
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'text/plain',
    };

    // Create multipart form data
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain\r\n\r\n' +
      content +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload file');
    }

    console.log(`[GoogleDrive] Uploaded file "${fileName}": ${data.id}`);
    return data.id;
  } catch (error: any) {
    console.error('[GoogleDrive] Error uploading file:', error.message);
    return null;
  }
}

/**
 * Upload scheduled video script to Google Drive
 * Structure: /Schedule/YYYY-MM-DD/ChannelName/VideoN.txt
 */
export async function uploadScheduledVideoScript(
  scheduleDate: string,
  channelName: string,
  slotNumber: number,
  videoTitle: string,
  scriptContent: string
): Promise<string | null> {
  try {
    console.log(`[GoogleDrive] Uploading script for ${scheduleDate}/${channelName}/Video${slotNumber}`);

    // Get config
    const config = await getGoogleDriveConfig();
    if (!config) {
      throw new Error('Google Drive not configured');
    }

    // Get access token
    const accessToken = await getAccessToken(config);
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Create folder structure: Schedule/YYYY-MM-DD/ChannelName/
    // 1. Create "Schedule" folder (or get existing)
    const scheduleFolderId = await createFolder('Schedule', config.folderId, accessToken);
    if (!scheduleFolderId) {
      throw new Error('Failed to create Schedule folder');
    }

    // 2. Create date folder (YYYY-MM-DD)
    const dateFolderId = await createFolder(scheduleDate, scheduleFolderId, accessToken);
    if (!dateFolderId) {
      throw new Error(`Failed to create ${scheduleDate} folder`);
    }

    // 3. Create channel folder
    const channelFolderId = await createFolder(channelName, dateFolderId, accessToken);
    if (!channelFolderId) {
      throw new Error(`Failed to create ${channelName} folder`);
    }

    // 4. Upload file
    const fileName = `Video${slotNumber}.txt`;
    const fileId = await uploadFile(fileName, scriptContent, channelFolderId, accessToken);

    if (!fileId) {
      throw new Error('Failed to upload file');
    }

    const filePath = `Schedule/${scheduleDate}/${channelName}/${fileName}`;
    console.log(`[GoogleDrive] ✅ Successfully uploaded: ${filePath}`);

    return filePath;
  } catch (error: any) {
    console.error('[GoogleDrive] Error uploading script:', error.message);
    return null;
  }
}

/**
 * Upload new video to backup folder
 * Structure: /New Videos Pool/VideoID.txt
 */
export async function uploadNewVideoBackup(
  videoId: string,
  videoTitle: string,
  scriptContent: string
): Promise<string | null> {
  try {
    console.log(`[GoogleDrive] Uploading new video backup: ${videoId}`);

    // Get config
    const config = await getGoogleDriveConfig();
    if (!config) {
      throw new Error('Google Drive not configured');
    }

    // Get access token
    const accessToken = await getAccessToken(config);
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Create "New Videos Pool" folder (or get existing)
    const poolFolderId = await createFolder('New Videos Pool', config.folderId, accessToken);
    if (!poolFolderId) {
      throw new Error('Failed to create New Videos Pool folder');
    }

    // Upload file
    const fileName = `${videoId}.txt`;
    const fileId = await uploadFile(fileName, scriptContent, poolFolderId, accessToken);

    if (!fileId) {
      throw new Error('Failed to upload file');
    }

    const filePath = `New Videos Pool/${fileName}`;
    console.log(`[GoogleDrive] ✅ Successfully uploaded new video backup: ${filePath}`);

    return filePath;
  } catch (error: any) {
    console.error('[GoogleDrive] Error uploading new video backup:', error.message);
    return null;
  }
}

/**
 * Get file content from Google Drive by path
 */
export async function getFileContent(filePath: string): Promise<string | null> {
  try {
    console.log(`[GoogleDrive] Getting file content: ${filePath}`);

    // Get config
    const config = await getGoogleDriveConfig();
    if (!config) {
      throw new Error('Google Drive not configured');
    }

    // Get access token
    const accessToken = await getAccessToken(config);
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // Parse path and search for file
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];

    // Search for file by name
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      throw new Error('File not found');
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
      throw new Error('Failed to get file content');
    }

    const content = await contentResponse.text();
    console.log(`[GoogleDrive] ✅ Retrieved file content: ${content.length} chars`);

    return content;
  } catch (error: any) {
    console.error('[GoogleDrive] Error getting file content:', error.message);
    return null;
  }
}
