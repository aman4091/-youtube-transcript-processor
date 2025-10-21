-- Reset one failed video to pending for re-processing
UPDATE scheduled_videos
SET 
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_completed_at = NULL,
  processed_script_path = NULL
WHERE id = (
  SELECT id 
  FROM scheduled_videos 
  WHERE schedule_date = '2025-10-21' 
    AND status = 'failed'
  LIMIT 1
)
RETURNING video_id, video_title, target_channel_name, slot_number;
