-- Migration 008: Add chunk progress tracking for scheduled videos
-- Allows resuming failed chunk processing

-- Add columns for tracking chunk processing progress
ALTER TABLE scheduled_videos
ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chunk_results JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS failed_chunks JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN scheduled_videos.total_chunks IS 'Total number of chunks for this video transcript';
COMMENT ON COLUMN scheduled_videos.completed_chunks IS 'Number of successfully processed chunks';
COMMENT ON COLUMN scheduled_videos.chunk_results IS 'Array of {index, content, processed_at} for completed chunks';
COMMENT ON COLUMN scheduled_videos.failed_chunks IS 'Array of chunk indices that failed processing';
