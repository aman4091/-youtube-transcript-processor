-- Migration 011: Add raw_transcript column to scheduled_videos
-- This stores the actual raw transcript content from SupaData (not path)

ALTER TABLE scheduled_videos
ADD COLUMN IF NOT EXISTS raw_transcript TEXT;

COMMENT ON COLUMN scheduled_videos.raw_transcript IS
'Raw transcript content from SupaData (stored directly in database instead of Google Drive)';
