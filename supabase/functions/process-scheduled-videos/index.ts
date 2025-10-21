// Supabase Edge Function: process-scheduled-videos
// Processes pending scheduled videos (transcript + AI + Google Drive)
// Called by GitHub Actions every 4 hours

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
    console.log('🔄 Starting scheduled video processing...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get settings
    const { data: settings } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Fetch pending videos (limit 1 per run - process one at a time)
    const { data: pendingVideos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch pending videos: ${error.message}`);
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending videos to process', processed: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    console.log(`📦 Found ${pendingVideos.length} pending videos`);

    let processed = 0;
    let failed = 0;

    for (const video of pendingVideos) {
      try {
        console.log(`Processing: ${video.video_id} (${video.video_type})`);

        // Update status to processing
        await supabase
          .from('scheduled_videos')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        // Process video (both old and new use same pipeline now)
        console.log(`Processing ${video.video_type} video: ${video.video_id}`);
        const result = await processOldVideo(video, settings, supabase);

        if (result.success) {
          // All chunks complete - upload to Google Drive
          console.log(`📤 Uploading to Google Drive...`);
          const drivePath = await uploadToGoogleDrive(
            video.schedule_date,
            video.target_channel_name,
            video.slot_number,
            result.finalScript,
            supabase
          );

          if (drivePath) {
            console.log(`✅ Uploaded to Google Drive: ${drivePath}`);
          } else {
            console.log(`⚠️ Google Drive upload failed, continuing anyway`);
          }

          // Mark as ready
          await supabase
            .from('scheduled_videos')
            .update({
              status: 'ready',
              processed_script_path: drivePath,
              processing_completed_at: new Date().toISOString(),
            })
            .eq('id', video.id);

          processed++;
          console.log(`✅ ${video.video_type} video ${video.video_id} processed successfully`);
        } else if (result.partialSuccess) {
          // Some chunks complete - keep as processing for next run
          console.log(`⚠️ Partial success: ${result.completedChunks}/${result.totalChunks} chunks done`);
          console.log(`Will retry failed chunks in next run`);
        } else {
          throw new Error(result.error);
        }

        // 2 second delay between videos
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (videoError: any) {
        console.error(`❌ Error processing ${video.video_id}:`, videoError.message);

        await supabase
          .from('scheduled_videos')
          .update({
            status: 'failed',
            error_message: videoError.message,
            retry_count: (video.retry_count || 0) + 1,
          })
          .eq('id', video.id);

        failed++;
      }
    }

    console.log(`✅ Processing complete: ${processed} success, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingVideos.length,
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

// Process old video with full pipeline and resume capability
// NO TIMEOUT - let Gemini take as much time as it needs
async function processOldVideo(video: any, settings: any, supabase: any) {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
    const transcript = await fetchTranscriptWithRotation(videoUrl, settings);
    console.log(`Transcript fetched: ${transcript.length} chars`);

    const chunks = chunkText(transcript, 7000);
    const totalChunks = chunks.length;
    console.log(`Split into ${totalChunks} chunks`);

    const existingResults = video.chunk_results || [];
    const completedIndices = new Set(existingResults.map((r: any) => r.index));
    console.log(`📦 Found ${existingResults.length} previously completed chunks`);
    console.log(`🚀 Processing ${totalChunks - existingResults.length} NEW chunks!`);

    await supabase.from('scheduled_videos').update({ total_chunks: totalChunks }).eq('id', video.id);

    const chunkPromises = chunks.map(async (chunk, i) => {
      if (completedIndices.has(i)) {
        console.log(`⏭️ [${i + 1}/${totalChunks}] Skipping (already done)`);
        const existing = existingResults.find((r: any) => r.index === i);
        return { index: i, content: existing.content, status: 'skipped' };
      }

      console.log(`[${i + 1}/${totalChunks}] Starting...`);

      const chunkPrompt = settings.custom_prompt || 'Process this transcript:';
      const fullPrompt = totalChunks > 1 ? `${chunkPrompt}\n\n[Part ${i + 1} of ${totalChunks}]` : chunkPrompt;

      // Process chunk without timeout - let Gemini take as long as it needs
      try {
        let aiResult;
        if (settings.ai_model === 'deepseek') {
          aiResult = await processWithDeepSeek(fullPrompt, chunk, settings.deepseek_api_key);
        } else {
          aiResult = await processWithGeminiFlash(fullPrompt, chunk, settings.gemini_api_key);
        }
        if (aiResult.error) throw new Error(aiResult.error);
        console.log(`✅ [${i + 1}] Done (${aiResult.content.length} chars)`);
        return { index: i, content: aiResult.content, status: 'fulfilled' };
      } catch (error: any) {
        console.error(`❌ [${i + 1}] FAILED:`, error.message);
        return { index: i, error: error.message, status: 'rejected' };
      }
    });

    console.log(`⏳ Waiting for all chunks to complete (no timeout)...`);
    const startTime = Date.now();
    const results = await Promise.allSettled(chunkPromises);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    const successfulChunks: any[] = [];
    const failedChunks: number[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const chunkData = result.value;
        if (chunkData.status === 'fulfilled' || chunkData.status === 'skipped') {
          successfulChunks.push({ index: chunkData.index, content: chunkData.content, processed_at: new Date().toISOString() });
        } else if (chunkData.status === 'rejected') {
          failedChunks.push(chunkData.index);
        }
      }
    });

    const allChunkResults = [...existingResults.filter((r: any) => !successfulChunks.find(s => s.index === r.index)), ...successfulChunks];
    const completedCount = allChunkResults.length;

    console.log(`✅ New: ${successfulChunks.length - existingResults.length} | ❌ Failed: ${failedChunks.length} | Total: ${completedCount}/${totalChunks} | Time: ${processingTime}s`);

    await supabase.from('scheduled_videos').update({ chunk_results: allChunkResults, completed_chunks: completedCount, failed_chunks: failedChunks }).eq('id', video.id);

    if (completedCount === totalChunks) {
      const sortedResults = allChunkResults.sort((a: any, b: any) => a.index - b.index);
      const finalScript = sortedResults.map((r: any) => r.content).join('\n\n');
      console.log(`🎉 ALL COMPLETE! Script: ${finalScript.length} chars`);
      return { success: true, totalChunks, completedChunks: completedCount, finalScript };
    } else {
      console.log(`⚠️ Partial (${completedCount}/${totalChunks}) - will resume next run`);
      return { success: false, partialSuccess: true, totalChunks, completedChunks: completedCount, error: `${failedChunks.length} chunks failed` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// SupaData API Key Rotation Helper Functions
// ============================================

/**
 * Get active SupaData API keys (with fallback to legacy single key)
 */
function getActiveSupadataKeys(settings: any): string[] {
  // Try new multi-key system first
  if (settings.supadata_keys && settings.supadata_keys.length > 0) {
    const activeKeys = settings.supadata_keys
      .filter((k: any) => k.active)
      .map((k: any) => k.key);

    if (activeKeys.length > 0) {
      console.log(`🔑 Found ${activeKeys.length} active SupaData API keys`);
      return activeKeys;
    }
  }

  // Fallback to legacy single key
  if (settings.supabase_api_key) {
    console.log('🔑 Using legacy single API key');
    return [settings.supabase_api_key];
  }

  return [];
}

/**
 * Fetch transcript with automatic API key rotation
 */
async function fetchTranscriptWithRotation(
  videoUrl: string,
  settings: any
): Promise<string> {
  const apiKeys = getActiveSupadataKeys(settings);

  if (apiKeys.length === 0) {
    throw new Error('No active SupaData API keys configured');
  }

  let lastError: Error | null = null;

  // Try each API key until one succeeds
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const keyLabel = settings.supadata_keys?.[i]?.label || `Key ${i + 1}`;

    try {
      console.log(`🔑 Attempting with ${keyLabel}...`);
      const transcript = await fetchTranscript(videoUrl, apiKey);
      console.log(`✅ Success with ${keyLabel}`);
      return transcript;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || 'Unknown error';

      // Check if it's a rate limit or auth error
      if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        console.log(`⏳ ${keyLabel} rate limited, trying next key...`);
        continue;
      } else if (errorMsg.includes('invalid') || errorMsg.includes('expired') || errorMsg.includes('401')) {
        console.log(`❌ ${keyLabel} invalid/expired, trying next key...`);
        continue;
      } else {
        // Other errors (no transcript, network issues, etc) - don't try other keys
        console.error(`❌ ${keyLabel} failed with non-recoverable error: ${errorMsg}`);
        throw error;
      }
    }
  }

  // All keys failed
  throw new Error(`All ${apiKeys.length} API keys failed. Last error: ${lastError?.message}`);
}

/**
 * Fetch transcript from SupaData API (single key attempt)
 */
async function fetchTranscript(videoUrl: string, apiKey: string): Promise<string> {
  const url = new URL('https://api.supadata.ai/v1/transcript');
  url.searchParams.set('url', videoUrl);
  url.searchParams.set('text', 'true');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('SupaData API key is invalid or expired');
    }
    if (response.status === 429) {
      throw new Error('SupaData API rate limit exceeded');
    }
    throw new Error(`SupaData API error: ${response.statusText}`);
  }

  const data = await response.json();
  const transcript = data.data?.transcript || data.content || data.text || data.transcript;

  if (!transcript) {
    throw new Error('No transcript available');
  }

  return transcript;
}

// ============================================
// Text Processing Helpers
// ============================================

// Chunking helper
function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (sentence.length > maxLength) {
        const words = sentence.split(' ');
        for (const word of words) {
          if (currentChunk.length + word.length + 1 > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// AI Processors
async function processWithDeepSeek(prompt: string, transcript: string, apiKey: string) {
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: transcript },
        ],
      }),
    });

    const data = await response.json();
    return { content: data.choices[0].message.content, error: null };
  } catch (error: any) {
    return { content: '', error: error.message };
  }
}

async function processWithGeminiFlash(prompt: string, transcript: string, apiKey: string) {
  try {
    console.log(`🔗 Calling Gemini 2.5-flash API...`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { text: transcript },
              ],
            },
          ],
        }),
      }
    );

    console.log(`📡 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${errorText}`);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.candidates || !data.candidates[0]) {
      console.error(`❌ No candidates in response`);
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
      }
      throw new Error('Invalid Gemini response - no candidates');
    }

    if (!data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      console.error(`❌ Invalid candidate structure`);
      throw new Error('Invalid Gemini response structure');
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log(`✅ Got response: ${text.length} chars`);

    return {
      content: text,
      error: null,
    };
  } catch (error: any) {
    console.error(`💥 Gemini exception:`, error.message);
    return { content: '', error: error.message };
  }
}


// ============================================
// Google Drive Upload Functions
// ============================================

/**
 * Get Google Drive config from database
 */
async function getGoogleDriveConfig(supabase: any): Promise<any | null> {
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

    return data.google_drive_config;
  } catch (error: any) {
    console.error('[GoogleDrive] Error getting config:', error.message);
    return null;
  }
}

/**
 * Get Google Drive access token
 */
async function getAccessToken(config: any): Promise<string | null> {
  try {
    const tokenData = config.tokenData;
    if (!tokenData) {
      throw new Error('tokenData not found in config');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: tokenData.client_id,
        client_secret: tokenData.client_secret,
        refresh_token: tokenData.refresh_token,
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
 * Create or get existing folder in Google Drive
 */
async function createOrGetFolder(
  folderName: string,
  parentFolderId: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Check if folder exists
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
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
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'text/plain',
    };

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

    return data.id;
  } catch (error: any) {
    console.error('[GoogleDrive] Error uploading file:', error.message);
    return null;
  }
}

/**
 * Upload script to Google Drive
 * Structure: /Schedule/YYYY-MM-DD/ChannelName/VideoN.txt
 */
async function uploadToGoogleDrive(
  scheduleDate: string,
  channelName: string,
  slotNumber: number,
  scriptContent: string,
  supabase: any
): Promise<string | null> {
  try {
    console.log(`[GoogleDrive] Uploading ${scheduleDate}/${channelName}/Video${slotNumber}`);

    const config = await getGoogleDriveConfig(supabase);
    if (!config) {
      console.log('[GoogleDrive] Config not found, skipping upload');
      return null;
    }

    const accessToken = await getAccessToken(config);
    if (!accessToken) {
      console.log('[GoogleDrive] Failed to get access token');
      return null;
    }

    // Create folder structure: Schedule/YYYY-MM-DD/ChannelName/
    const scheduleFolderId = await createOrGetFolder('Schedule', config.folderId, accessToken);
    if (!scheduleFolderId) return null;

    const dateFolderId = await createOrGetFolder(scheduleDate, scheduleFolderId, accessToken);
    if (!dateFolderId) return null;

    const channelFolderId = await createOrGetFolder(channelName, dateFolderId, accessToken);
    if (!channelFolderId) return null;

    // Upload file
    const fileName = `Video${slotNumber}.txt`;
    const fileId = await uploadFile(fileName, scriptContent, channelFolderId, accessToken);

    if (!fileId) return null;

    const filePath = `Schedule/${scheduleDate}/${channelName}/${fileName}`;
    console.log(`[GoogleDrive] ✅ Uploaded: ${filePath}`);

    return filePath;
  } catch (error: any) {
    console.error('[GoogleDrive] Upload error:', error.message);
    return null;
  }
}
