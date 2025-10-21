-- Step 1: Check 21 Oct videos
SELECT
  schedule_date,
  target_channel_name,
  slot_number,
  video_id,
  status
FROM scheduled_videos
WHERE schedule_date = '2025-10-21'
ORDER BY target_channel_name, slot_number;

-- Step 2: Shift 21 Oct videos to 23 Oct
-- Change schedule_date from 2025-10-21 to 2025-10-23
UPDATE scheduled_videos
SET
  schedule_date = '2025-10-23',
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_started_at = NULL,
  processing_completed_at = NULL,
  telegram_sent_at = NULL,
  updated_at = NOW()
WHERE schedule_date = '2025-10-21'
RETURNING
  target_channel_name,
  slot_number,
  video_id,
  'shifted to 23 Oct' as action;

-- Step 3: Reset 22 Oct failed videos to pending
UPDATE scheduled_videos
SET
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_started_at = NULL,
  processing_completed_at = NULL,
  chunk_results = '[]'::jsonb,
  total_chunks = 0,
  completed_chunks = 0,
  failed_chunks = '[]'::jsonb,
  updated_at = NOW()
WHERE schedule_date = '2025-10-22'
  AND status = 'failed'
RETURNING
  target_channel_name,
  slot_number,
  video_id,
  status;

-- Step 4: Check final state
SELECT
  schedule_date,
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'ready') as ready,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'processing') as processing
FROM scheduled_videos
WHERE schedule_date IN ('2025-10-21', '2025-10-22', '2025-10-23')
GROUP BY schedule_date
ORDER BY schedule_date;
