-- Migration: Support Multiple SupaData API Keys
-- Date: 2025-10-21
-- Description: Enable rotation of multiple SupaData API keys for uninterrupted processing

-- Add new supadata_keys column (JSONB array)
ALTER TABLE auto_monitor_settings
ADD COLUMN IF NOT EXISTS supadata_keys JSONB DEFAULT '[]';

-- Migrate existing single API key to array format (if exists)
UPDATE auto_monitor_settings
SET supadata_keys =
  CASE
    WHEN supabase_api_key IS NOT NULL AND supabase_api_key != ''
    THEN jsonb_build_array(
      jsonb_build_object(
        'key', supabase_api_key,
        'label', 'Primary Key',
        'active', true,
        'added_at', NOW()::text
      )
    )
    ELSE '[]'::jsonb
  END
WHERE supadata_keys = '[]'::jsonb;

-- Keep old column for backward compatibility (will deprecate later)
-- ALTER TABLE auto_monitor_settings
-- ALTER COLUMN supabase_api_key DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN auto_monitor_settings.supadata_keys IS 'Array of SupaData API keys for rotation: [{key, label, active, added_at, last_used_at}]';

-- Example after migration:
-- supadata_keys = [
--   {"key": "sk-xxx1", "label": "Primary Key", "active": true, "added_at": "2025-10-21T10:00:00Z"},
--   {"key": "sk-xxx2", "label": "Backup Key 1", "active": true, "added_at": "2025-10-21T11:00:00Z"},
--   {"key": "sk-xxx3", "label": "Backup Key 2", "active": true, "added_at": "2025-10-21T12:00:00Z"}
-- ]
