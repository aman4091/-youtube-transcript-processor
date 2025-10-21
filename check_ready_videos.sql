SELECT 
  id,
  video_id,
  video_title,
  status,
  processed_script IS NOT NULL as has_script,
  LENGTH(processed_script) as script_length
FROM scheduled_videos
WHERE schedule_date = '2025-10-21' 
  AND status = 'ready'
ORDER BY target_channel_name, slot_number;
