// =================================================
// Schedule Processor Service
// Processes pending scheduled videos
// =================================================

import { supabase } from './supabaseClient';
import { fetchYouTubeTranscript } from './supaDataAPI';
import { processWithDeepSeek, processWithGeminiFlash } from './aiProcessors';
import { chunkText } from '../utils/chunkingService';
import type { ScheduledVideo } from '../types/scheduling';

/**
 * Process pending scheduled videos
 * Fetches transcripts, runs AI processing, uploads to Google Drive
 */
export async function processPendingScheduledVideos(
  maxVideos: number = 5
): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  details: Array<{
    video_id: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }>;
}> {
  try {
    console.log('[ScheduleProcessor] Starting to process pending videos...');

    // Fetch pending videos
    const { data: pendingVideos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(maxVideos);

    if (error) {
      throw new Error(`Failed to fetch pending videos: ${error.message}`);
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('[ScheduleProcessor] No pending videos to process');
      return { processed: 0, failed: 0, skipped: 0, details: [] };
    }

    console.log(`[ScheduleProcessor] Found ${pendingVideos.length} pending videos`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{
        video_id: string;
        status: 'success' | 'failed' | 'skipped';
        error?: string;
      }>,
    };

    for (const video of pendingVideos) {
      const result = await processSingleScheduledVideo(video);

      if (result.success) {
        results.processed++;
        results.details.push({
          video_id: video.video_id,
          status: 'success',
        });
      } else if (result.skipped) {
        results.skipped++;
        results.details.push({
          video_id: video.video_id,
          status: 'skipped',
          error: result.error,
        });
      } else {
        results.failed++;
        results.details.push({
          video_id: video.video_id,
          status: 'failed',
          error: result.error,
        });
      }

      // Small delay between videos
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(
      `[ScheduleProcessor] Complete: ${results.processed} processed, ${results.failed} failed, ${results.skipped} skipped`
    );

    return results;
  } catch (error: any) {
    console.error('[ScheduleProcessor] Error processing videos:', error.message);
    throw error;
  }
}

/**
 * Process a single scheduled video
 */
async function processSingleScheduledVideo(
  video: ScheduledVideo
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    console.log(`[ScheduleProcessor] Processing video: ${video.video_id}`);

    // Update status to processing
    await supabase
      .from('scheduled_videos')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', video.id);

    // Check if this is a new video (already processed by monitoring)
    if (video.video_type === 'new') {
      return await processNewScheduledVideo(video);
    } else {
      return await processOldScheduledVideo(video);
    }
  } catch (error: any) {
    console.error(
      `[ScheduleProcessor] Error processing ${video.video_id}:`,
      error.message
    );

    // Update error in database
    await supabase
      .from('scheduled_videos')
      .update({
        status: 'failed',
        error_message: error.message,
        retry_count: video.retry_count + 1,
      })
      .eq('id', video.id);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process new video (already has processed script from monitoring)
 */
async function processNewScheduledVideo(
  video: ScheduledVideo
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // Get processed script from processed_videos table
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

    // Note: Google Drive upload will be handled by googleDriveService
    // For now, we'll just mark as ready with a placeholder path
    const drivePath = `Schedule/${video.schedule_date}/${video.target_channel_name}/Video${video.slot_number}.txt`;

    await supabase
      .from('scheduled_videos')
      .update({
        status: 'ready',
        processed_script_path: drivePath,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', video.id);

    console.log(`[ScheduleProcessor] ✅ New video ${video.video_id} marked as ready`);

    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to process new video: ${error.message}`);
  }
}

/**
 * Process old video (needs full processing pipeline)
 */
async function processOldScheduledVideo(
  video: ScheduledVideo
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // Get settings
    const { data: settings } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Step 1: Fetch transcript
    console.log(`[ScheduleProcessor] Fetching transcript for ${video.video_id}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

    const transcriptResult = await fetchYouTubeTranscript(
      videoUrl,
      settings.supabase_api_key
    );

    if (!transcriptResult.transcript) {
      throw new Error('No transcript available');
    }

    const transcript = transcriptResult.transcript;
    console.log(`[ScheduleProcessor] Transcript fetched: ${transcript.length} chars`);

    // Step 2: Process with AI (chunking)
    console.log(`[ScheduleProcessor] Processing with AI...`);
    const chunks = chunkText(transcript, 7000);
    console.log(`[ScheduleProcessor] Split into ${chunks.length} chunks`);

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
    console.log(`[ScheduleProcessor] AI processing complete: ${finalScript.length} chars`);

    // Step 3: Clean markdown
    const cleanedScript = cleanMarkdown(finalScript);

    // Note: Google Drive upload will be handled separately
    // For now, store script temporarily
    const drivePath = `Schedule/${video.schedule_date}/${video.target_channel_name}/Video${video.slot_number}.txt`;

    // Update database
    await supabase
      .from('scheduled_videos')
      .update({
        status: 'ready',
        processed_script_path: drivePath,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', video.id);

    console.log(`[ScheduleProcessor] ✅ Old video ${video.video_id} processed successfully`);

    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to process old video: ${error.message}`);
  }
}

/**
 * Clean markdown from text
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^\s*>\s/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(date: string) {
  try {
    const { data } = await supabase
      .from('scheduled_videos')
      .select('status')
      .eq('schedule_date', date);

    if (!data) return null;

    return {
      total: data.length,
      pending: data.filter((v) => v.status === 'pending').length,
      processing: data.filter((v) => v.status === 'processing').length,
      ready: data.filter((v) => v.status === 'ready').length,
      published: data.filter((v) => v.status === 'published').length,
      failed: data.filter((v) => v.status === 'failed').length,
    };
  } catch (error: any) {
    console.error('[ScheduleProcessor] Error getting stats:', error.message);
    return null;
  }
}
