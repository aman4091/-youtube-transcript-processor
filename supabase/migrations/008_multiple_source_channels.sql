-- Migration: Support Multiple Source Channels
-- Date: 2025-10-21
-- Description: Convert single source channel to multiple sources (JSONB array)

-- Add new source_channels column (JSONB array)
ALTER TABLE schedule_config
ADD COLUMN IF NOT EXISTS source_channels JSONB DEFAULT '[]';

-- Migrate existing single source to array format (if exists)
UPDATE schedule_config
SET source_channels =
  CASE
    WHEN source_channel_id IS NOT NULL AND source_channel_id != ''
    THEN jsonb_build_array(
      jsonb_build_object(
        'id', source_channel_id,
        'name', source_channel_name,
        'url', source_channel_url,
        'active', true
      )
    )
    ELSE '[]'::jsonb
  END
WHERE source_channels = '[]'::jsonb;

-- Old columns ko nullable bana do (backward compatibility ke liye)
ALTER TABLE schedule_config
ALTER COLUMN source_channel_id DROP NOT NULL,
ALTER COLUMN source_channel_name DROP NOT NULL,
ALTER COLUMN source_channel_url DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN schedule_config.source_channels IS 'Array of source channels: [{id, name, url, active}]';

-- Example after migration:
-- source_channels = [
--   {"id": "UCxxx", "name": "God Says Today", "url": "https://...", "active": true},
--   {"id": "UCyyy", "name": "Another Channel", "url": "https://...", "active": true}
-- ]
