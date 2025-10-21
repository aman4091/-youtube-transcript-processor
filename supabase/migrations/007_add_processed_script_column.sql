-- Migration 007: Add processed_script column to scheduled_videos
-- Store AI processed scripts directly in database

ALTER TABLE scheduled_videos
ADD COLUMN IF NOT EXISTS processed_script TEXT;

COMMENT ON COLUMN scheduled_videos.processed_script IS
'AI processed script content - stored here instead of Google Drive for faster access';
