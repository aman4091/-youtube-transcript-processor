-- Reset all failed videos to pending for re-processing
-- Run this in Supabase SQL Editor

UPDATE scheduled_videos
SET
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_completed_at = NULL,
  processed_script_path = NULL
WHERE schedule_date = '2025-10-21'
  AND status = 'failed'
RETURNING id, video_id, video_title, target_channel_name, slot_number;
