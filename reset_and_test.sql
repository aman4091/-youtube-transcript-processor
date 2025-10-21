-- Reset failed/processing videos to pending for 2025-10-21
UPDATE scheduled_videos
SET
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_started_at = NULL,
  processing_completed_at = NULL
WHERE schedule_date = '2025-10-21'
  AND status IN ('failed', 'processing');

-- Check current status
SELECT
  status,
  COUNT(*) as count
FROM scheduled_videos
WHERE schedule_date = '2025-10-21'
GROUP BY status
ORDER BY status;
