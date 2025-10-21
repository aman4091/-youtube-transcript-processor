-- ============================================
-- QUICK COMMANDS: Shift 21 Oct → 23 Oct + Reset 22 Oct
-- ============================================

-- 1️⃣ Shift ALL 21 Oct videos to 23 Oct (mark as pending)
UPDATE scheduled_videos
SET
  schedule_date = '2025-10-23',
  status = 'pending',
  error_message = NULL,
  retry_count = 0,
  processing_started_at = NULL,
  processing_completed_at = NULL,
  telegram_sent_at = NULL,
  chunk_results = '[]'::jsonb,
  total_chunks = 0,
  completed_chunks = 0,
  failed_chunks = '[]'::jsonb,
  updated_at = NOW()
WHERE schedule_date = '2025-10-21';

-- 2️⃣ Reset ALL 22 Oct videos to pending (will be processed automatically)
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
WHERE schedule_date = '2025-10-22';

-- 3️⃣ Verify results
SELECT
  schedule_date,
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'ready') as ready,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM scheduled_videos
WHERE schedule_date IN ('2025-10-21', '2025-10-22', '2025-10-23')
GROUP BY schedule_date
ORDER BY schedule_date;
