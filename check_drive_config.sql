SELECT 
  google_drive_config,
  jsonb_pretty(google_drive_config) as config_pretty
FROM schedule_config
WHERE user_id = 'default_user';
