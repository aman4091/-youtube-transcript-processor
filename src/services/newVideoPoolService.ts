// =====================================================
// New Video Pool Service
// Syncs new videos from auto-monitoring system
// =====================================================

import { supabase } from './supabaseClient';
import type { VideoPoolNew, VideoSelectionCriteria } from '../types/scheduling';

// ============= Sync from Monitoring System =============

/**
 * Sync new videos from monitoring system (processed_videos table)
 * Runs hourly to keep pool updated
 */
export async function syncNewVideosFromMonitoring(): Promise<{
  synced: number;
  existing: number;
  total: number;
}> {
  try {
    console.log('[NewVideoPool] Starting sync from monitoring system...');

    // Get last sync time from config
    const { data: config } = await supabase
      .from('schedule_config')
      .select('updated_at')
      .eq('user_id', 'default_user')
      .single();

    const lastSync = config?.updated_at || new Date(0).toISOString();

    // Fetch new processed videos from monitoring system
    // Filter: status = 'success', created after last sync, 27+ minutes
    const { data: processedVideos, error } = await supabase
      .from('processed_videos')
      .select('*')
      .eq('status', 'success')
      .gte('created_at', lastSync)
      .gte('transcript_length', 27 * 60 * 4); // Rough estimate: 4 chars/second

    if (error) {
      throw new Error(`Failed to fetch processed videos: ${error.message}`);
    }

    if (!processedVideos || processedVideos.length === 0) {
      console.log('[NewVideoPool] No new videos to sync');
      return { synced: 0, existing: 0, total: 0 };
    }

    console.log(`[NewVideoPool] Found ${processedVideos.length} new processed videos`);

    let synced = 0;
    let existing = 0;

    for (const video of processedVideos) {
      // Check if already in pool
      const { data: existingVideo } = await supabase
        .from('video_pool_new')
        .select('id')
        .eq('video_id', video.video_id)
        .single();

      if (existingVideo) {
        existing++;
        continue;
      }

      // Insert into new video pool
      const { error: insertError } = await supabase.from('video_pool_new').insert({
        video_id: video.video_id,
        title: video.video_title,
        duration: Math.floor(video.transcript_length / 4), // Rough estimate
        view_count: 0, // Will be updated later if needed
        published_at: video.processed_at,
        source_channel_id: video.channel_id || 'unknown',
        processed_script_path: null, // Will be set when scheduled
        status: 'active',
      });

      if (insertError) {
        console.error(
          `[NewVideoPool] Error inserting video ${video.video_id}:`,
          insertError.message
        );
        continue;
      }

      synced++;
    }

    // Get total count
    const { count } = await supabase
      .from('video_pool_new')
      .select('*', { count: 'exact', head: true });

    console.log(
      `[NewVideoPool] Sync complete: ${synced} new, ${existing} existing, ${count} total`
    );

    return { synced, existing, total: count || 0 };
  } catch (error: any) {
    console.error('[NewVideoPool] Error syncing from monitoring:', error.message);
    throw error;
  }
}

// ============= Video Selection =============

/**
 * Get available new videos for scheduling
 */
export async function getAvailableNewVideos(
  criteria: VideoSelectionCriteria
): Promise<VideoPoolNew[]> {
  try {
    const { excludeVideoIds, count } = criteria;

    // Query active videos, sorted by added_at (newest first)
    let query = supabase
      .from('video_pool_new')
      .select('*')
      .eq('status', 'active')
      .order('added_at', { ascending: false })
      .limit(count * 2); // Fetch extra for uniqueness filtering

    if (excludeVideoIds.length > 0) {
      query = query.not('video_id', 'in', `(${excludeVideoIds.join(',')})`);
    }

    const { data: videos, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch new videos: ${error.message}`);
    }

    if (!videos || videos.length === 0) {
      console.warn('[NewVideoPool] No available new videos found');
      return [];
    }

    console.log(
      `[NewVideoPool] Found ${videos.length} candidate new videos (before uniqueness check)`
    );

    return videos.slice(0, count);
  } catch (error: any) {
    console.error('[NewVideoPool] Error getting available videos:', error.message);
    throw error;
  }
}

/**
 * Mark video as used
 */
export async function markNewVideoAsUsed(
  videoId: string,
  usedDate: string,
  channelId: string,
  channelName: string
): Promise<void> {
  try {
    // Add to usage tracker
    const { error: trackerError } = await supabase
      .from('video_usage_tracker')
      .insert({
        video_id: videoId,
        used_date: usedDate,
        target_channel_id: channelId,
        target_channel_name: channelName,
      });

    if (trackerError && !trackerError.message.includes('duplicate')) {
      console.error('[NewVideoPool] Error adding to usage tracker:', trackerError.message);
    }

    // Update video pool
    const { error: poolError } = await supabase
      .from('video_pool_new')
      .update({
        times_scheduled: supabase.sql`times_scheduled + 1`,
        last_scheduled_date: usedDate,
      })
      .eq('video_id', videoId);

    if (poolError) {
      console.error('[NewVideoPool] Error updating pool:', poolError.message);
    }

    console.log(`[NewVideoPool] Marked video ${videoId} as used on ${usedDate}`);
  } catch (error: any) {
    console.error('[NewVideoPool] Error marking video as used:', error.message);
  }
}

/**
 * Get pool statistics
 */
export async function getNewPoolStats(): Promise<{
  total: number;
  active: number;
  exhausted: number;
  avgTimesScheduled: number;
  recentCount: number; // Added in last 7 days
}> {
  try {
    const { data, error } = await supabase.from('video_pool_new').select('*');

    if (error || !data) {
      return {
        total: 0,
        active: 0,
        exhausted: 0,
        avgTimesScheduled: 0,
        recentCount: 0,
      };
    }

    const active = data.filter((v) => v.status === 'active').length;
    const exhausted = data.filter((v) => v.status === 'exhausted').length;
    const avgTimesScheduled =
      data.reduce((sum, v) => sum + v.times_scheduled, 0) / (data.length || 1);

    // Count videos added in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = data.filter(
      (v) => new Date(v.added_at) >= sevenDaysAgo
    ).length;

    return {
      total: data.length,
      active,
      exhausted,
      avgTimesScheduled: Math.round(avgTimesScheduled * 10) / 10,
      recentCount,
    };
  } catch (error: any) {
    console.error('[NewVideoPool] Error getting stats:', error.message);
    return {
      total: 0,
      active: 0,
      exhausted: 0,
      avgTimesScheduled: 0,
      recentCount: 0,
    };
  }
}

/**
 * Mark exhausted new videos (scheduled too many times)
 */
export async function markExhaustedNewVideos(threshold: number = 5): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('video_pool_new')
      .update({ status: 'exhausted' })
      .gte('times_scheduled', threshold)
      .eq('status', 'active')
      .select('id');

    if (error) {
      throw new Error(`Failed to mark exhausted videos: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log(`[NewVideoPool] Marked ${count} new videos as exhausted`);

    return count;
  } catch (error: any) {
    console.error('[NewVideoPool] Error marking exhausted videos:', error.message);
    return 0;
  }
}

/**
 * Get video by ID from new pool
 */
export async function getNewVideoById(videoId: string): Promise<VideoPoolNew | null> {
  try {
    const { data, error } = await supabase
      .from('video_pool_new')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error: any) {
    console.error('[NewVideoPool] Error getting video by ID:', error.message);
    return null;
  }
}

/**
 * Update processed script path for a new video
 */
export async function updateNewVideoScriptPath(
  videoId: string,
  scriptPath: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('video_pool_new')
      .update({ processed_script_path: scriptPath })
      .eq('video_id', videoId);

    if (error) {
      console.error('[NewVideoPool] Error updating script path:', error.message);
    }
  } catch (error: any) {
    console.error('[NewVideoPool] Error updating script path:', error.message);
  }
}
