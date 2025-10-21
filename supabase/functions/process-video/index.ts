// Supabase Edge Function: process-video
// Purpose: Process a single video - fetch transcript, run AI processing, send to Telegram

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Types
interface ProcessVideoRequest {
  video_id: string;
}

interface MonitorSettings {
  ai_model: string;
  custom_prompt: string;
  supabase_api_key: string; // Legacy - single key
  supadata_keys?: Array<{
    key: string;
    label?: string;
    active: boolean;
    added_at?: string;
    last_used_at?: string;
  }>; // New - multiple keys for rotation
  deepseek_api_key: string;
  gemini_api_key: string;
  openrouter_api_key: string;
  openrouter_model: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_chat_id_with_title?: string; // Chat 2 for auto-monitoring
  delay_between_videos_seconds: number;
}

serve(async (req) => {
  // Handle CORS preflight
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
    console.log('🎬 Starting process-video function...');
    const startTime = Date.now();

    // Parse request
    const body: ProcessVideoRequest = await req.json();
    const { video_id } = body;

    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'video_id is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    console.log(`📺 Processing video: ${video_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch settings
    console.log('📥 Fetching settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (settingsError || !settings) {
      throw new Error(`Failed to fetch settings: ${settingsError?.message}`);
    }

    const monitorSettings: MonitorSettings = settings;

    // Step 2: Get video details from queue
    const { data: queueItem, error: queueError } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('video_id', video_id)
      .single();

    if (queueError || !queueItem) {
      console.error('❌ Video not found in queue');
      return new Response(
        JSON.stringify({ error: 'Video not found in queue' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const videoUrl = queueItem.video_url;
    const videoTitle = queueItem.video_title;

    // Update queue status to processing
    await supabase
      .from('processing_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('video_id', video_id);

    try {
      // Step 3: Fetch transcript with API key rotation
      console.log('📝 Fetching transcript...');
      const transcript = await fetchTranscriptWithRotation(
        videoUrl,
        monitorSettings
      );

      console.log(`✓ Transcript fetched: ${transcript.length} characters`);

      // Step 4: Process with AI (with chunking for large transcripts)
      console.log(`🤖 Processing with AI model: ${monitorSettings.ai_model}`);
      const aiOutput = await processWithAIChunked(
        transcript,
        monitorSettings.custom_prompt ||
          'Summarize the following video transcript in an engaging way:',
        monitorSettings
      );

      console.log(`✓ AI processing complete: ${aiOutput.length} characters`);

      // Step 5: Clean markdown
      const cleanedOutput = cleanMarkdown(aiOutput);

      // Step 6: REMOVED - No automatic Telegram sending
      // Videos will only be sent to Telegram via manual "Push to Telegram" button
      console.log('✅ Processing complete - video ready for scheduling');

      // Step 7: Mark as successfully processed
      await supabase.from('processed_videos').insert({
        video_id: video_id,
        video_title: videoTitle,
        video_url: videoUrl,
        channel_id: queueItem.channel_id,
        channel_title: queueItem.channel_title,
        status: 'success',
        ai_model: monitorSettings.ai_model,
        transcript_length: transcript.length,
        output_length: cleanedOutput.length,
        telegram_sent: false, // No longer auto-sending to Telegram
        telegram_message_id: null,
        processed_at: new Date().toISOString(),
      });

      // Update queue to completed
      await supabase
        .from('processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('video_id', video_id);

      const duration = Date.now() - startTime;
      console.log(`✅ Video processed successfully in ${duration}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          video_id,
          video_title: videoTitle,
          transcript_length: transcript.length,
          output_length: cleanedOutput.length,
          duration_ms: duration,
          message: 'Video processed and ready for scheduling',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    } catch (processingError: any) {
      console.error('❌ Processing failed:', processingError.message);

      // Update retry count
      const retryCount = (queueItem.retry_count || 0) + 1;
      const maxRetries = queueItem.max_retries || 3;

      if (retryCount < maxRetries) {
        // Mark for retry
        await supabase
          .from('processing_queue')
          .update({
            status: 'pending',
            retry_count: retryCount,
            error_message: processingError.message,
          })
          .eq('video_id', video_id);

        console.log(`🔄 Will retry (attempt ${retryCount}/${maxRetries})`);
      } else {
        // Max retries reached - mark as failed
        await supabase
          .from('processing_queue')
          .update({
            status: 'failed',
            error_message: processingError.message,
            completed_at: new Date().toISOString(),
          })
          .eq('video_id', video_id);

        // Add to processed_videos as failed
        await supabase.from('processed_videos').insert({
          video_id: video_id,
          video_title: videoTitle,
          video_url: videoUrl,
          channel_id: queueItem.channel_id,
          channel_title: queueItem.channel_title,
          status: 'failed',
          error_message: processingError.message,
          retry_count: retryCount,
          processed_at: new Date().toISOString(),
        });

        console.log('❌ Max retries reached - marked as failed');
      }

      // Log error
      await supabase.from('error_logs').insert({
        error_type: 'video_processing',
        error_message: processingError.message,
        error_stack: processingError.stack,
        context: { video_id, videoTitle, retry_count: retryCount },
        video_id: video_id,
        function_name: 'process-video',
        severity: retryCount >= maxRetries ? 'high' : 'medium',
      });

      throw processingError;
    }
  } catch (error: any) {
    console.error('❌ Fatal error in process-video:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Get active SupaData API keys (with fallback to legacy single key)
 */
function getActiveSupadataKeys(settings: MonitorSettings): string[] {
  // Try new multi-key system first
  if (settings.supadata_keys && settings.supadata_keys.length > 0) {
    const activeKeys = settings.supadata_keys
      .filter(k => k.active)
      .map(k => k.key);

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
  settings: MonitorSettings
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
async function fetchTranscript(
  videoUrl: string,
  apiKey: string
): Promise<string> {
  // Build URL with query parameters
  const url = new URL('https://api.supadata.ai/v1/transcript');
  url.searchParams.set('url', videoUrl);
  url.searchParams.set('text', 'true');
  url.searchParams.set('mode', 'auto');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
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

  // Handle async job (202 status)
  if (response.status === 202) {
    const jobId = data.jobId;
    if (!jobId) {
      throw new Error('SupaData returned 202 but no job ID');
    }
    return await pollJobResult(jobId, apiKey);
  }

  // Direct response - handle multiple possible field names
  const transcript = data.content || data.text || data.transcript || '';

  if (!transcript) {
    throw new Error('No transcript available - video may not have captions');
  }

  return transcript.trim();
}

/**
 * Poll for async job completion (for large videos)
 */
async function pollJobResult(jobId: string, apiKey: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes max
  let attempt = 0;

  while (attempt < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    const pollUrl = `https://api.supadata.ai/v1/transcript/${jobId}`;
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Job polling error: ${response.statusText}`);
    }

    const data = await response.json();
    const { status, content, error } = data;

    if (status === 'completed') {
      if (!content) {
        throw new Error('Job completed but no transcript content returned');
      }
      return content;
    } else if (status === 'failed') {
      throw new Error(`SupaData job failed: ${error || 'Unknown error'}`);
    }

    // Continue polling if queued/active
    attempt++;
  }

  throw new Error('Job polling timeout - video processing took too long');
}

/**
 * Chunk text into smaller pieces at sentence boundaries
 */
function chunkText(text: string, maxChars: number = 7000): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxChars;

    if (endIndex >= text.length) {
      chunks.push(text.substring(currentIndex).trim());
      break;
    }

    // Look for nearest full stop
    let fullStopIndex = text.indexOf('.', endIndex);

    if (fullStopIndex === -1 || fullStopIndex > currentIndex + maxChars + 500) {
      for (let i = endIndex; i > currentIndex; i--) {
        if (text[i] === '.') {
          fullStopIndex = i;
          break;
        }
      }
    }

    if (fullStopIndex !== -1 && fullStopIndex > currentIndex) {
      endIndex = fullStopIndex + 1;
    }

    chunks.push(text.substring(currentIndex, endIndex).trim());
    currentIndex = endIndex;
  }

  return chunks;
}

/**
 * Process transcript with AI (with chunking support)
 */
async function processWithAIChunked(
  transcript: string,
  prompt: string,
  settings: MonitorSettings
): Promise<string> {
  // Split into chunks if too large
  const chunks = chunkText(transcript, 7000);

  console.log(`📦 Split transcript into ${chunks.length} chunks`);

  if (chunks.length === 1) {
    // Single chunk - process directly
    return await processWithAI(transcript, prompt, settings);
  }

  // Multiple chunks - process each and merge
  const processedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);

    const chunkPrompt = `${prompt}\n\n[Part ${i + 1} of ${chunks.length}]`;
    const processed = await processWithAI(chunks[i], chunkPrompt, settings);

    processedChunks.push(processed);

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`✅ All ${chunks.length} chunks processed, merging...`);

  // Merge all processed chunks
  return processedChunks.join('\n\n');
}

/**
 * Process transcript with AI model (single chunk)
 */
async function processWithAI(
  transcript: string,
  prompt: string,
  settings: MonitorSettings
): Promise<string> {
  const model = settings.ai_model;

  switch (model) {
    case 'deepseek':
      return await processWithDeepSeek(
        prompt,
        transcript,
        settings.deepseek_api_key
      );

    case 'gemini-flash':
      return await processWithGemini(
        prompt,
        transcript,
        settings.gemini_api_key,
        'gemini-2.0-flash-exp'
      );

    case 'gemini-pro':
      return await processWithGemini(
        prompt,
        transcript,
        settings.gemini_api_key,
        'gemini-2.5-pro-exp-03-25'
      );

    case 'openrouter':
      return await processWithOpenRouter(
        prompt,
        transcript,
        settings.openrouter_api_key,
        settings.openrouter_model
      );

    default:
      throw new Error(`Unknown AI model: ${model}`);
  }
}

/**
 * Process with DeepSeek
 */
async function processWithDeepSeek(
  prompt: string,
  content: string,
  apiKey: string
): Promise<string> {
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
        { role: 'user', content: content },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Process with Google Gemini
 */
async function processWithGemini(
  prompt: string,
  content: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${prompt}\n\n${content}` }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Process with OpenRouter
 */
async function processWithOpenRouter(
  prompt: string,
  content: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: content },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Send processed content to Telegram
 */
async function sendToTelegram(
  botToken: string,
  chatId: string,
  content: string,
  videoTitle: string | null,
  videoUrl: string,
  videoId: string
): Promise<{ success: boolean; messageId: string }> {
  // Create .txt file
  const filename = `${videoId}.txt`;
  const fileBlob = new Blob([content], { type: 'text/plain' });

  // Prepare form data
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', fileBlob, filename);

  if (videoTitle) {
    formData.append(
      'caption',
      `📄 ${videoTitle}\n🔗 ${videoUrl}\n\n✅ Auto-processed`
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Telegram API error: ${errorData.description || response.statusText}`
    );
  }

  const data = await response.json();

  return {
    success: data.ok,
    messageId: data.result?.message_id?.toString() || '',
  };
}

/**
 * Clean markdown formatting from text
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Remove horizontal lines (---, ***, ___)
    .replace(/\*\*/g, '') // Remove bold (**text**)
    .replace(/\*/g, '') // Remove italics (*text*)
    .replace(/#{1,6}\s/g, '') // Remove headers (# Header)
    .replace(/`{1,3}/g, '') // Remove code blocks (` or ```)
    .replace(/^\s*>\s/gm, '') // Remove blockquotes (> text)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links [text](url) -> text
    .trim();
}
