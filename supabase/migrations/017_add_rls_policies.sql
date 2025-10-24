-- Migration 017: Add RLS policies for multi-user support
-- Allow users to manage their own data

-- Enable RLS on tables if not already enabled
ALTER TABLE schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_monitor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_pool_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_pool_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_usage_tracker ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own schedule_config" ON schedule_config;
DROP POLICY IF EXISTS "Users can insert own schedule_config" ON schedule_config;
DROP POLICY IF EXISTS "Users can update own schedule_config" ON schedule_config;
DROP POLICY IF EXISTS "Users can delete own schedule_config" ON schedule_config;

DROP POLICY IF EXISTS "Users can view own auto_monitor_settings" ON auto_monitor_settings;
DROP POLICY IF EXISTS "Users can insert own auto_monitor_settings" ON auto_monitor_settings;
DROP POLICY IF EXISTS "Users can update own auto_monitor_settings" ON auto_monitor_settings;
DROP POLICY IF EXISTS "Users can delete own auto_monitor_settings" ON auto_monitor_settings;

DROP POLICY IF EXISTS "Users can view own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can insert own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can update own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can delete own scheduled_videos" ON scheduled_videos;

DROP POLICY IF EXISTS "Users can view own video_pool_old" ON video_pool_old;
DROP POLICY IF EXISTS "Users can insert own video_pool_old" ON video_pool_old;
DROP POLICY IF EXISTS "Users can update own video_pool_old" ON video_pool_old;
DROP POLICY IF EXISTS "Users can delete own video_pool_old" ON video_pool_old;

DROP POLICY IF EXISTS "Users can view own video_pool_new" ON video_pool_new;
DROP POLICY IF EXISTS "Users can insert own video_pool_new" ON video_pool_new;
DROP POLICY IF EXISTS "Users can update own video_pool_new" ON video_pool_new;
DROP POLICY IF EXISTS "Users can delete own video_pool_new" ON video_pool_new;

DROP POLICY IF EXISTS "Users can view own video_usage_tracker" ON video_usage_tracker;
DROP POLICY IF EXISTS "Users can insert own video_usage_tracker" ON video_usage_tracker;

-- schedule_config policies
CREATE POLICY "Users can view own schedule_config"
  ON schedule_config FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own schedule_config"
  ON schedule_config FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own schedule_config"
  ON schedule_config FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own schedule_config"
  ON schedule_config FOR DELETE
  USING (user_id = auth.uid());

-- auto_monitor_settings policies
CREATE POLICY "Users can view own auto_monitor_settings"
  ON auto_monitor_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own auto_monitor_settings"
  ON auto_monitor_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own auto_monitor_settings"
  ON auto_monitor_settings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own auto_monitor_settings"
  ON auto_monitor_settings FOR DELETE
  USING (user_id = auth.uid());

-- scheduled_videos policies
CREATE POLICY "Users can view own scheduled_videos"
  ON scheduled_videos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own scheduled_videos"
  ON scheduled_videos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own scheduled_videos"
  ON scheduled_videos FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own scheduled_videos"
  ON scheduled_videos FOR DELETE
  USING (user_id = auth.uid());

-- video_pool_old policies
CREATE POLICY "Users can view own video_pool_old"
  ON video_pool_old FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own video_pool_old"
  ON video_pool_old FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own video_pool_old"
  ON video_pool_old FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own video_pool_old"
  ON video_pool_old FOR DELETE
  USING (user_id = auth.uid());

-- video_pool_new policies
CREATE POLICY "Users can view own video_pool_new"
  ON video_pool_new FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own video_pool_new"
  ON video_pool_new FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own video_pool_new"
  ON video_pool_new FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own video_pool_new"
  ON video_pool_new FOR DELETE
  USING (user_id = auth.uid());

-- video_usage_tracker policies (only select and insert needed)
CREATE POLICY "Users can view own video_usage_tracker"
  ON video_usage_tracker FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own video_usage_tracker"
  ON video_usage_tracker FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Comment
COMMENT ON POLICY "Users can view own schedule_config" ON schedule_config IS 'Users can only view their own schedule configuration';
COMMENT ON POLICY "Users can insert own schedule_config" ON schedule_config IS 'Users can only create their own schedule configuration';
COMMENT ON POLICY "Users can update own schedule_config" ON schedule_config IS 'Users can only update their own schedule configuration';
