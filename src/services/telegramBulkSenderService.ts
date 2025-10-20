// =====================================================
// Telegram Bulk Sender Service
// Sends scheduled videos to Telegram Channel 1
// =====================================================

import { supabase } from './supabaseClient';
import { getFileContent } from './googleDriveService';
import type { ScheduledVideo, TelegramSendResult } from '../types/scheduling';

/**
 * Bulk send all ready videos for a date to Telegram
 */
export async function bulkPushToTelegram(
  date: string,
  telegramChannelId: string,
  telegramBotToken: string
): Promise<{
  sent: number;
  failed: number;
  filenames: string[];
  details: TelegramSendResult[];
}> {
  try {
    console.log(`[TelegramBulk] Starting bulk push for ${date}...`);

    // Fetch all ready videos for the date
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('schedule_date', date)
      .eq('status', 'ready')
      .order('target_channel_name', { ascending: true })
      .order('slot_number', { ascending: true });

    if (error || !videos || videos.length === 0) {
      throw new Error('No ready videos found for this date');
    }

    console.log(`[TelegramBulk] Found ${videos.length} ready videos`);

    const results: TelegramSendResult[] = [];
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
      } else {
        failed++;
      }

      // Rate limit: 2 second delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`[TelegramBulk] Complete: ${sent} sent, ${failed} failed`);

    return {
      sent,
      failed,
      filenames: results.map((r) => r.filename),
      details: results,
    };
  } catch (error: any) {
    console.error('[TelegramBulk] Error:', error.message);
    throw error;
  }
}

/**
 * Send single video to Telegram
 */
async function sendVideoToTelegram(
  video: ScheduledVideo,
  channelId: string,
  botToken: string
): Promise<TelegramSendResult> {
  try {
    // Generate filename: YYYY-MM-DD_ChannelName_VideoN.txt
    const filename = `${video.schedule_date}_${sanitizeFilename(video.target_channel_name)}_Video${video.slot_number}.txt`;

    // Get script content from Google Drive
    let content = '';

    if (video.processed_script_path) {
      const driveContent = await getFileContent(video.processed_script_path);
      content = driveContent || `Error: Failed to fetch script from Google Drive\n\nVideo: ${video.video_title}\nVideo ID: ${video.video_id}`;
    } else {
      content = `Error: No script path found\n\nVideo: ${video.video_title}\nVideo ID: ${video.video_id}\nChannel: ${video.target_channel_name}\nSlot: ${video.slot_number}\nType: ${video.video_type}`;
    }

    // Create file blob
    const fileBlob = new Blob([content], { type: 'text/plain' });

    // Prepare form data
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('document', fileBlob, filename);
    formData.append(
      'caption',
      `📅 ${video.schedule_date}\n🎯 ${video.target_channel_name}\n📺 ${video.video_title}`
    );

    // Send to Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
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

    console.log(`[TelegramBulk] ✅ Sent: ${filename}`);

    return {
      filename,
      messageId: data.result?.message_id?.toString() || null,
      success: true,
    };
  } catch (error: any) {
    console.error(`[TelegramBulk] ❌ Failed to send ${video.video_id}:`, error.message);

    return {
      filename: `${video.schedule_date}_${video.target_channel_name}_Video${video.slot_number}.txt`,
      messageId: null,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sanitize filename (remove invalid chars)
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}
