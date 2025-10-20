// =====================================================
// Smart Scheduler Service
// Core algorithm for daily schedule generation
// Enforces uniqueness rules: 15-day same channel, 10-day cross channel
// =====================================================

import { supabase } from './supabaseClient';
import {
  getAvailableOldVideos,
  checkVideoEligibility,
  markVideoAsUsed,
} from './oldVideoPoolService';
import {
  getAvailableNewVideos,
  markNewVideoAsUsed,
} from './newVideoPoolService';
import type {
  DailySchedulePlan,
  ChannelVideos,
  ScheduledVideoItem,
  TargetChannel,
} from '../types/scheduling';

// ============= Main Scheduling Function =============

/**
 * Generate daily schedule for all target channels
 * Day 1-5: 4 old videos per channel
 * Day 6+: 1 new + 3 old videos per channel
 */
export async function generateDailySchedule(
  scheduleDate?: string
): Promise<DailySchedulePlan> {
  try {
    const date = scheduleDate || getTomorrowDate();
    console.log(`[SmartScheduler] Generating schedule for ${date}...`);

    // Step 1: Get configuration
    const { data: config, error: configError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (configError || !config) {
      throw new Error('Schedule configuration not found');
    }

    if (config.system_status !== 'active') {
      throw new Error('Scheduling system is paused');
    }

    const targetChannels: TargetChannel[] = config.target_channels || [];

    if (targetChannels.length === 0) {
      throw new Error('No target channels configured');
    }

    console.log(`[SmartScheduler] Found ${targetChannels.length} target channels`);

    // Step 2: Check if schedule already exists
    const { data: existingSchedule } = await supabase
      .from('scheduled_videos')
      .select('id')
      .eq('schedule_date', date)
      .limit(1);

    if (existingSchedule && existingSchedule.length > 0) {
      console.log(`[SmartScheduler] Schedule for ${date} already exists, skipping`);
      throw new Error(`Schedule for ${date} already exists`);
    }

    // Step 3: Determine day number (calculate from system_start_date)
    const dayNumber = calculateDayNumber(config.system_start_date, date);
    console.log(`[SmartScheduler] Day number: ${dayNumber}`);

    // Step 4: Determine video requirements
    const requiresNewVideos = dayNumber >= 6;
    const newVideosPerChannel = requiresNewVideos ? 1 : 0;
    const oldVideosPerChannel = requiresNewVideos ? 3 : 4;

    console.log(
      `[SmartScheduler] Requirements: ${newVideosPerChannel} new + ${oldVideosPerChannel} old per channel`
    );

    // Step 5: Select videos for each channel
    const channelAssignments: Record<string, ChannelVideos> = {};
    const usedTodayGlobal: string[] = []; // Track all videos used today (cross-channel)

    for (const channel of targetChannels.filter((c) => c.active)) {
      console.log(`[SmartScheduler] Processing channel: ${channel.name}`);

      const videos: ScheduledVideoItem[] = [];

      // Select NEW videos (Day 6+)
      if (newVideosPerChannel > 0) {
        const newVideos = await selectNewVideosForChannel(
          channel,
          newVideosPerChannel,
          usedTodayGlobal,
          date
        );
        videos.push(...newVideos);
        usedTodayGlobal.push(...newVideos.map((v) => v.videoId));
      }

      // Select OLD videos
      const oldVideos = await selectOldVideosForChannel(
        channel,
        oldVideosPerChannel,
        usedTodayGlobal,
        date
      );
      videos.push(...oldVideos);
      usedTodayGlobal.push(...oldVideos.map((v) => v.videoId));

      // Shuffle to randomize slot positions
      shuffleArray(videos);

      // Assign slot numbers
      videos.forEach((video, index) => {
        video.slotNumber = index + 1;
      });

      channelAssignments[channel.id] = {
        channelId: channel.id,
        channelName: channel.name,
        videos,
      };

      console.log(
        `[SmartScheduler] Channel ${channel.name}: ${videos.length} videos assigned`
      );
    }

    // Step 6: Validate total uniqueness
    const totalVideos = Object.values(channelAssignments).reduce(
      (sum, ch) => sum + ch.videos.length,
      0
    );

    if (usedTodayGlobal.length !== new Set(usedTodayGlobal).size) {
      throw new Error('Duplicate videos detected in schedule!');
    }

    console.log(`[SmartScheduler] Total unique videos: ${totalVideos}`);

    // Step 7: Insert into database
    await insertScheduleToDatabase(date, channelAssignments);

    // Step 8: Update usage tracker
    await updateUsageTracker(date, channelAssignments);

    // Step 9: Update config
    await supabase
      .from('schedule_config')
      .update({ last_schedule_generated_date: date })
      .eq('user_id', 'default_user');

    const newVideosCount = Object.values(channelAssignments).reduce(
      (sum, ch) => sum + ch.videos.filter((v) => v.videoType === 'new').length,
      0
    );

    const result: DailySchedulePlan = {
      date,
      channelAssignments,
      totalVideos,
      newVideosCount,
      oldVideosCount: totalVideos - newVideosCount,
    };

    console.log(`[SmartScheduler] ✅ Schedule generated successfully for ${date}`);

    return result;
  } catch (error: any) {
    console.error('[SmartScheduler] Error generating schedule:', error.message);
    throw error;
  }
}

// ============= Video Selection Functions =============

/**
 * Select new videos for a channel (Day 6+)
 */
async function selectNewVideosForChannel(
  channel: TargetChannel,
  count: number,
  excludeGlobal: string[],
  scheduleDate: string
): Promise<ScheduledVideoItem[]> {
  try {
    // Get recently used videos on this channel (15 day rule)
    const { data: recentSameChannel } = await supabase
      .from('video_usage_tracker')
      .select('video_id')
      .eq('target_channel_id', channel.id)
      .gte(
        'used_date',
        subtractDays(scheduleDate, 15)
      );

    const excludeSameChannel = recentSameChannel?.map((r) => r.video_id) || [];

    // Get recently used videos on other channels (10 day rule)
    const { data: recentCrossChannel } = await supabase
      .from('video_usage_tracker')
      .select('video_id')
      .neq('target_channel_id', channel.id)
      .gte(
        'used_date',
        subtractDays(scheduleDate, 10)
      );

    const excludeCrossChannel = recentCrossChannel?.map((r) => r.video_id) || [];

    // Combine all exclusions
    const excludeAll = [
      ...new Set([...excludeGlobal, ...excludeSameChannel, ...excludeCrossChannel]),
    ];

    // Fetch available new videos
    const videos = await getAvailableNewVideos({
      excludeVideoIds: excludeAll,
      count: count * 3, // Fetch extra
    });

    if (videos.length === 0) {
      throw new Error(`No available new videos for channel ${channel.name}`);
    }

    // Apply strict eligibility check
    const eligible: ScheduledVideoItem[] = [];

    for (const video of videos) {
      if (eligible.length >= count) break;

      const eligibilityCheck = await checkVideoEligibility(
        video.video_id,
        channel.id,
        scheduleDate
      );

      if (eligibilityCheck.eligible) {
        eligible.push({
          slotNumber: 0, // Will be assigned later
          videoId: video.video_id,
          videoTitle: video.title,
          videoType: 'new',
          source: 'pool_new',
        });
      }
    }

    if (eligible.length < count) {
      throw new Error(
        `Not enough eligible new videos for ${channel.name}: needed ${count}, found ${eligible.length}`
      );
    }

    return eligible;
  } catch (error: any) {
    console.error(
      `[SmartScheduler] Error selecting new videos for ${channel.name}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Select old videos for a channel
 */
async function selectOldVideosForChannel(
  channel: TargetChannel,
  count: number,
  excludeGlobal: string[],
  scheduleDate: string
): Promise<ScheduledVideoItem[]> {
  try {
    // Get recently used videos on this channel (15 day rule)
    const { data: recentSameChannel } = await supabase
      .from('video_usage_tracker')
      .select('video_id')
      .eq('target_channel_id', channel.id)
      .gte(
        'used_date',
        subtractDays(scheduleDate, 15)
      );

    const excludeSameChannel = recentSameChannel?.map((r) => r.video_id) || [];

    // Get recently used videos on other channels (10 day rule)
    const { data: recentCrossChannel } = await supabase
      .from('video_usage_tracker')
      .select('video_id')
      .neq('target_channel_id', channel.id)
      .gte(
        'used_date',
        subtractDays(scheduleDate, 10)
      );

    const excludeCrossChannel = recentCrossChannel?.map((r) => r.video_id) || [];

    // Combine all exclusions
    const excludeAll = [
      ...new Set([...excludeGlobal, ...excludeSameChannel, ...excludeCrossChannel]),
    ];

    // Fetch available old videos (sorted by views)
    const videos = await getAvailableOldVideos({
      excludeVideoIds: excludeAll,
      count: count * 3, // Fetch extra for eligibility filtering
      preferHighViews: true,
    });

    if (videos.length === 0) {
      throw new Error(`No available old videos for channel ${channel.name}`);
    }

    // Apply strict eligibility check
    const eligible: ScheduledVideoItem[] = [];

    for (const video of videos) {
      if (eligible.length >= count) break;

      const eligibilityCheck = await checkVideoEligibility(
        video.video_id,
        channel.id,
        scheduleDate
      );

      if (eligibilityCheck.eligible) {
        eligible.push({
          slotNumber: 0, // Will be assigned later
          videoId: video.video_id,
          videoTitle: video.title,
          videoType: 'old',
          source: 'pool_old',
        });
      }
    }

    if (eligible.length < count) {
      throw new Error(
        `Not enough eligible old videos for ${channel.name}: needed ${count}, found ${eligible.length}`
      );
    }

    return eligible;
  } catch (error: any) {
    console.error(
      `[SmartScheduler] Error selecting old videos for ${channel.name}:`,
      error.message
    );
    throw error;
  }
}

// ============= Database Operations =============

/**
 * Insert schedule into database
 */
async function insertScheduleToDatabase(
  date: string,
  channelAssignments: Record<string, ChannelVideos>
): Promise<void> {
  try {
    const scheduleEntries = [];

    for (const [channelId, channelData] of Object.entries(channelAssignments)) {
      for (const video of channelData.videos) {
        scheduleEntries.push({
          schedule_date: date,
          target_channel_id: channelId,
          target_channel_name: channelData.channelName,
          slot_number: video.slotNumber,
          video_id: video.videoId,
          video_title: video.videoTitle,
          video_type: video.videoType,
          status: 'pending',
        });
      }
    }

    const { error } = await supabase
      .from('scheduled_videos')
      .insert(scheduleEntries);

    if (error) {
      throw new Error(`Failed to insert schedule: ${error.message}`);
    }

    console.log(`[SmartScheduler] Inserted ${scheduleEntries.length} schedule entries`);
  } catch (error: any) {
    console.error('[SmartScheduler] Error inserting schedule:', error.message);
    throw error;
  }
}

/**
 * Update usage tracker for all scheduled videos
 */
async function updateUsageTracker(
  date: string,
  channelAssignments: Record<string, ChannelVideos>
): Promise<void> {
  try {
    for (const [channelId, channelData] of Object.entries(channelAssignments)) {
      for (const video of channelData.videos) {
        if (video.videoType === 'old') {
          await markVideoAsUsed(
            video.videoId,
            date,
            channelId,
            channelData.channelName
          );
        } else {
          await markNewVideoAsUsed(
            video.videoId,
            date,
            channelId,
            channelData.channelName
          );
        }
      }
    }

    console.log('[SmartScheduler] Usage tracker updated');
  } catch (error: any) {
    console.error('[SmartScheduler] Error updating usage tracker:', error.message);
  }
}

// ============= Helper Functions =============

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Calculate day number from system start date
 */
function calculateDayNumber(startDate: string | null, currentDate: string): number {
  if (!startDate) {
    // If no start date, assume Day 1
    return 1;
  }

  const start = new Date(startDate);
  const current = new Date(currentDate);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Day 1, Day 2, etc.
}

/**
 * Subtract days from a date string
 */
function subtractDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Get schedule summary for a date
 */
export async function getScheduleSummary(date: string) {
  try {
    const { data, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('schedule_date', date);

    if (error || !data) {
      return null;
    }

    const summary = {
      date,
      total: data.length,
      by_channel: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      new_count: data.filter((v) => v.video_type === 'new').length,
      old_count: data.filter((v) => v.video_type === 'old').length,
    };

    // Group by channel
    data.forEach((video) => {
      summary.by_channel[video.target_channel_name] =
        (summary.by_channel[video.target_channel_name] || 0) + 1;
      summary.by_status[video.status] = (summary.by_status[video.status] || 0) + 1;
    });

    return summary;
  } catch (error: any) {
    console.error('[SmartScheduler] Error getting summary:', error.message);
    return null;
  }
}
