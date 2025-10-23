// Google Drive Service
// Handles Google Drive operations for transcript management

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Update processed script content in Google Drive
 * @param videoId - ID of the scheduled video
 * @param newContent - New script content to replace existing
 * @param user_id - User ID for authorization
 * @param token - Supabase auth token
 * @returns Promise<void>
 */
export async function updateProcessedScript(
  videoId: number,
  newContent: string,
  user_id: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/update-processed-script`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        new_script_content: newContent,
        user_id: user_id,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to update processed script');
  }

  return data;
}

/**
 * Fetch file content from Google Drive by path
 * @param filePath - Google Drive file path (e.g., Schedule/2024-01-15/Channel1/Video1_raw.txt)
 * @param token - Supabase auth token
 * @returns Promise<string> - File content
 */
export async function getGoogleDriveFile(
  filePath: string,
  token: string
): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-drive-file`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch file from Google Drive');
  }

  return data.content;
}
