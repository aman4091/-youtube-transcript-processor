-- Migration 006: Add support for multiple SupaData API keys with rotation
-- This allows adding multiple API keys and rotating when rate limit is hit

-- Add new column for multiple API keys (array of objects with key and status)
ALTER TABLE auto_monitor_settings
ADD COLUMN IF NOT EXISTS supabase_api_keys JSONB DEFAULT '[]'::jsonb;

-- Comment
COMMENT ON COLUMN auto_monitor_settings.supabase_api_keys IS
'Array of SupaData API keys with rotation support. Format: [{"key": "sd_xxx", "active": true, "last_used": "2025-01-01"}]';

-- Migrate existing single key to array (if exists)
UPDATE auto_monitor_settings
SET supabase_api_keys =
  CASE
    WHEN supabase_api_key IS NOT NULL AND supabase_api_key != ''
    THEN jsonb_build_array(
      jsonb_build_object(
        'key', supabase_api_key,
        'active', true,
        'last_used', NOW()::text
      )
    )
    ELSE '[]'::jsonb
  END
WHERE supabase_api_keys = '[]'::jsonb OR supabase_api_keys IS NULL;
