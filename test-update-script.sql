-- Check if any videos have processed_script_path but script content is placeholder
SELECT 
  id,
  video_title,
  status,
  processed_script_path,
  raw_transcript_path,
  schedule_date
FROM scheduled_videos 
WHERE schedule_date = '2025-10-22'
  AND status = 'ready'
ORDER BY slot_number;
