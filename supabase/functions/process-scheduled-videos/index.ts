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

    // Fetch pending videos (limit 5 per run)
    const { data: pendingVideos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

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

        if (video.video_type === 'new') {
          // New video: Already processed by monitoring system
          const { data: processedVideo } = await supabase
            .from('processed_videos')
            .select('*')
            .eq('video_id', video.video_id)
            .eq('status', 'success')
            .order('processed_at', { ascending: false })
            .limit(1)
            .single();

          if (!processedVideo) {
            throw new Error('Processed video not found in monitoring system');
          }

          // Mark as ready (Google Drive upload will be handled separately)
          await supabase
            .from('scheduled_videos')
            .update({
              status: 'ready',
              processing_completed_at: new Date().toISOString(),
            })
            .eq('id', video.id);

          processed++;
          console.log(`✅ New video ${video.video_id} marked as ready`);
        } else {
          // Old video: Full processing pipeline
          const result = await processOldVideo(video, settings);

          if (result.success) {
            await supabase
              .from('scheduled_videos')
              .update({
                status: 'ready',
                processing_completed_at: new Date().toISOString(),
              })
              .eq('id', video.id);

            processed++;
            console.log(`✅ Old video ${video.video_id} processed successfully`);
          } else {
            throw new Error(result.error);
          }
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

// Process old video with full pipeline
async function processOldVideo(video: any, settings: any) {
  try {
    // Fetch transcript with API key rotation
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
    const transcript = await fetchTranscriptWithRotation(videoUrl, settings);
    console.log(`Transcript fetched: ${transcript.length} chars`);

    // Split into chunks (7000 chars)
    const chunks = chunkText(transcript, 7000);
    console.log(`Split into ${chunks.length} chunks`);

    const processedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = settings.custom_prompt || 'Process this transcript:';
      const fullPrompt =
        chunks.length > 1
          ? `${chunkPrompt}\n\n[Part ${i + 1} of ${chunks.length}]`
          : chunkPrompt;

      let aiResult;

      if (settings.ai_model === 'deepseek') {
        aiResult = await processWithDeepSeek(
          fullPrompt,
          chunks[i],
          settings.deepseek_api_key
        );
      } else {
        aiResult = await processWithGeminiFlash(
          fullPrompt,
          chunks[i],
          settings.gemini_api_key
        );
      }

      if (aiResult.error) {
        throw new Error(`AI processing error: ${aiResult.error}`);
      }

      processedChunks.push(aiResult.content);

      // Delay between chunks
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const finalScript = processedChunks.join('\n\n');
    console.log(`AI processing complete: ${finalScript.length} chars`);

    return { success: true };
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      error: null,
    };
  } catch (error: any) {
    return { content: '', error: error.message };
  }
}
