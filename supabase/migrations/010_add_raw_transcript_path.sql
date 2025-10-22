-- Migration 010: Add raw_transcript_path column to scheduled_videos
-- Store Google Drive path for raw transcript (from SupaData) for manual editing

ALTER TABLE scheduled_videos
ADD COLUMN IF NOT EXISTS raw_transcript_path TEXT;

COMMENT ON COLUMN scheduled_videos.raw_transcript_path IS
'Google Drive path to raw transcript file from SupaData (e.g., Schedule/2024-01-15/Channel1/Video1_raw.txt)';
