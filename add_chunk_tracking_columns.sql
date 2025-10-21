-- Add chunk tracking columns to scheduled_videos table
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_videos
ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chunk_results JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS failed_chunks JSONB DEFAULT '[]'::jsonb;

-- Verify columns were added
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'scheduled_videos'
  AND column_name IN ('total_chunks', 'completed_chunks', 'chunk_results', 'failed_chunks');
