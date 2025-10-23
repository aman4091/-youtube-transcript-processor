-- Migration 014: Add user_id to all existing tables for multi-user support
-- Strategy: Add column with default, update data, make NOT NULL, add foreign key

-- Default admin user ID
DO $$
DECLARE
  admin_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN

  -- 1. schedule_config table - handle TEXT to UUID conversion
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_config' AND column_name = 'user_id' AND data_type = 'text'
  ) THEN
    -- Column exists as TEXT, convert to UUID
    ALTER TABLE schedule_config RENAME COLUMN user_id TO user_id_old;
    ALTER TABLE schedule_config ADD COLUMN user_id UUID;
    UPDATE schedule_config SET user_id = admin_user_id;
    ALTER TABLE schedule_config ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE schedule_config ADD CONSTRAINT fk_schedule_config_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE schedule_config DROP COLUMN user_id_old;
    CREATE INDEX idx_schedule_config_user_id ON schedule_config(user_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_config' AND column_name = 'user_id'
  ) THEN
    -- Column doesn't exist, create as UUID
    ALTER TABLE schedule_config ADD COLUMN user_id UUID;
    UPDATE schedule_config SET user_id = admin_user_id WHERE user_id IS NULL;
    ALTER TABLE schedule_config ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE schedule_config ADD CONSTRAINT fk_schedule_config_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_schedule_config_user_id ON schedule_config(user_id);
  END IF;

  -- 2. scheduled_videos table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_videos' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE scheduled_videos ADD COLUMN user_id UUID;
    UPDATE scheduled_videos SET user_id = admin_user_id WHERE user_id IS NULL;
    ALTER TABLE scheduled_videos ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE scheduled_videos ADD CONSTRAINT fk_scheduled_videos_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_scheduled_videos_user_id ON scheduled_videos(user_id);
  END IF;

  -- 3. video_pool_old table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_pool_old' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE video_pool_old ADD COLUMN user_id UUID;
    UPDATE video_pool_old SET user_id = admin_user_id WHERE user_id IS NULL;
    ALTER TABLE video_pool_old ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE video_pool_old ADD CONSTRAINT fk_video_pool_old_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_video_pool_old_user_id ON video_pool_old(user_id);
  END IF;

  -- 4. video_pool_new table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_pool_new' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE video_pool_new ADD COLUMN user_id UUID;
    UPDATE video_pool_new SET user_id = admin_user_id WHERE user_id IS NULL;
    ALTER TABLE video_pool_new ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE video_pool_new ADD CONSTRAINT fk_video_pool_new_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_video_pool_new_user_id ON video_pool_new(user_id);
  END IF;

  -- 5. video_usage_tracker table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_usage_tracker' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE video_usage_tracker ADD COLUMN user_id UUID;
    UPDATE video_usage_tracker SET user_id = admin_user_id WHERE user_id IS NULL;
    ALTER TABLE video_usage_tracker ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE video_usage_tracker ADD CONSTRAINT fk_video_usage_tracker_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_video_usage_tracker_user_id ON video_usage_tracker(user_id);
  END IF;

  -- 6. target_channels table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'target_channels') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'target_channels' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE target_channels ADD COLUMN user_id UUID;
      UPDATE target_channels SET user_id = admin_user_id WHERE user_id IS NULL;
      ALTER TABLE target_channels ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE target_channels ADD CONSTRAINT fk_target_channels_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      CREATE INDEX idx_target_channels_user_id ON target_channels(user_id);
    END IF;
  END IF;

  -- 7. auto_monitor_settings table - convert user_id from TEXT to UUID
  -- First check if column exists and is TEXT type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_monitor_settings' AND column_name = 'user_id' AND data_type = 'text'
  ) THEN
    -- Rename old column
    ALTER TABLE auto_monitor_settings RENAME COLUMN user_id TO user_id_old;

    -- Add new UUID column
    ALTER TABLE auto_monitor_settings ADD COLUMN user_id UUID;

    -- Set to admin user
    UPDATE auto_monitor_settings SET user_id = admin_user_id;

    -- Make NOT NULL and add foreign key
    ALTER TABLE auto_monitor_settings ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE auto_monitor_settings ADD CONSTRAINT fk_auto_monitor_settings_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- Drop old column
    ALTER TABLE auto_monitor_settings DROP COLUMN user_id_old;

    -- Create index
    CREATE INDEX idx_auto_monitor_settings_user_id ON auto_monitor_settings(user_id);
  END IF;

END $$;

COMMENT ON COLUMN schedule_config.user_id IS 'User who owns this configuration';
COMMENT ON COLUMN scheduled_videos.user_id IS 'User who scheduled this video';
COMMENT ON COLUMN video_pool_old.user_id IS 'User who owns this video in their pool';
COMMENT ON COLUMN video_pool_new.user_id IS 'User who owns this video in their pool';
COMMENT ON COLUMN video_usage_tracker.user_id IS 'User who used this video';
