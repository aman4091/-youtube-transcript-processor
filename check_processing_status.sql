-- Check detailed status of today's videos
SELECT
  video_id,
  status,
  error_message,
  retry_count,
  processing_started_at,
  processing_completed_at,
  LENGTH(processed_script) as script_length,
  processed_script IS NOT NULL as has_script
FROM scheduled_videos
WHERE schedule_date = '2025-10-21'
ORDER BY processing_started_at DESC NULLS LAST;
