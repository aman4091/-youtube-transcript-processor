import { useHistoryStore } from '../stores/historyStore';
import { supabase } from '../services/supabaseClient';

export async function syncPublishedVideosToHistory(date: string) {
  const { addProcessedLink } = useHistoryStore.getState();

  try {
    // Fetch all published videos for the date
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('schedule_date', date)
      .eq('status', 'published');

    if (error) {
      console.error('Error fetching published videos:', error);
      return { success: false, error: error.message };
    }

    if (!videos || videos.length === 0) {
      return { success: true, synced: 0, message: 'No published videos to sync' };
    }

    // Add each published video to history
    let syncedCount = 0;
    for (const video of videos) {
      const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

      addProcessedLink(
        videoUrl,
        video.target_channel_name, // Using channel name as ID for scheduled videos
        video.target_channel_name,
        video.video_id,
        video.video_title,
        undefined, // No thumbnail
        undefined, // No source channel title
        true, // isScheduled = true
        video.schedule_date,
        video.slot_number
      );

      syncedCount++;
    }

    console.log(`✅ Synced ${syncedCount} published videos to history`);
    return { success: true, synced: syncedCount };

  } catch (error: any) {
    console.error('Error syncing to history:', error);
    return { success: false, error: error.message };
  }
}

// Sync all published videos (for initial setup)
export async function syncAllPublishedVideos() {
  const { addProcessedLink } = useHistoryStore.getState();

  try {
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .eq('status', 'published')
      .order('telegram_sent_at', { ascending: false })
      .limit(100); // Limit to last 100

    if (error) throw error;

    if (!videos || videos.length === 0) {
      return { success: true, synced: 0 };
    }

    for (const video of videos) {
      const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

      addProcessedLink(
        videoUrl,
        video.target_channel_name,
        video.target_channel_name,
        video.video_id,
        video.video_title,
        undefined,
        undefined,
        true,
        video.schedule_date,
        video.slot_number
      );
    }

    console.log(`✅ Synced ${videos.length} published videos to history`);
    return { success: true, synced: videos.length };

  } catch (error: any) {
    console.error('Error syncing all published videos:', error);
    return { success: false, error: error.message };
  }
}
