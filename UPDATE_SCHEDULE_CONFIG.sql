-- Update schedule_config with all credentials
-- Run this in Supabase SQL Editor

UPDATE schedule_config
SET
  source_channel_id = 'UCSbbWXDlbQzVPO3CcwrXweA',
  source_channel_name = 'god says today',
  source_channel_url = 'https://www.youtube.com/@godsays32',

  youtube_api_key = 'YOUR_YOUTUBE_API_KEY',

  telegram_channel_id = 'YOUR_TELEGRAM_CHANNEL_ID',
  telegram_bot_token = 'YOUR_TELEGRAM_BOT_TOKEN',

  target_channels = '[{"id": "1", "name": "GYH", "active": true},{"id": "2", "name": "JIMMY", "active": true},{"id": "3", "name": "BI", "active": true},{"id": "4", "name": "AFG", "active": true}]'::jsonb,

  google_drive_config = 'YOUR_GOOGLE_DRIVE_CONFIG_FROM_SETTINGS_PAGE'::jsonb,

  system_start_date = '2025-01-21',
  system_status = 'active',
  videos_per_channel = 4

WHERE user_id = 'default_user';

-- Verify the update
SELECT * FROM schedule_config WHERE user_id = 'default_user';
