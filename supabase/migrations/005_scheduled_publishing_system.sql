-- =====================================================
-- YouTube Scheduled Publishing System - Database Schema
-- Migration 005
-- =====================================================

-- Table 1: Old Video Pool (Source Channel Videos)
-- Stores old videos from source channel for scheduling
CREATE TABLE IF NOT EXISTS video_pool_old (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL, -- Duration in seconds
  view_count BIGINT DEFAULT 0,
  published_at TIMESTAMP,
  source_channel_id TEXT NOT NULL,
  source_channel_name TEXT NOT NULL,
  times_scheduled INTEGER DEFAULT 0,
  last_scheduled_date DATE,
  added_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- 'active' or 'exhausted'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for old video pool
CREATE INDEX idx_video_pool_old_video_id ON video_pool_old(video_id);
CREATE INDEX idx_video_pool_old_status ON video_pool_old(status);
CREATE INDEX idx_video_pool_old_view_count ON video_pool_old(view_count DESC);
CREATE INDEX idx_video_pool_old_last_scheduled ON video_pool_old(last_scheduled_date);

-- =====================================================

-- Table 2: New Video Pool (From Monitoring System)
-- Stores new videos detected by auto-monitoring
CREATE TABLE IF NOT EXISTS video_pool_new (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL,
  view_count BIGINT DEFAULT 0,
  published_at TIMESTAMP,
  source_channel_id TEXT NOT NULL,
  processed_script_path TEXT, -- Google Drive path from monitoring
  times_scheduled INTEGER DEFAULT 0,
  last_scheduled_date DATE,
  added_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for new video pool
CREATE INDEX idx_video_pool_new_video_id ON video_pool_new(video_id);
CREATE INDEX idx_video_pool_new_status ON video_pool_new(status);
CREATE INDEX idx_video_pool_new_added_at ON video_pool_new(added_at DESC);
CREATE INDEX idx_video_pool_new_last_scheduled ON video_pool_new(last_scheduled_date);

-- =====================================================

-- Table 3: Scheduled Videos (Daily Schedule)
-- Stores the daily schedule for all target channels
CREATE TABLE IF NOT EXISTS scheduled_videos (
  id BIGSERIAL PRIMARY KEY,
  schedule_date DATE NOT NULL,
  target_channel_id TEXT NOT NULL,
  target_channel_name TEXT NOT NULL,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  video_type TEXT NOT NULL CHECK (video_type IN ('old', 'new')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'published', 'failed')),
  processed_script_path TEXT, -- Google Drive path after processing
  google_drive_file_id TEXT,
  telegram_sent_at TIMESTAMP,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure uniqueness: one video per slot per channel per date
  UNIQUE(schedule_date, target_channel_id, slot_number),

  -- Prevent same video appearing twice on same date
  UNIQUE(schedule_date, video_id)
);

-- Indexes for scheduled videos
CREATE INDEX idx_scheduled_videos_date ON scheduled_videos(schedule_date);
CREATE INDEX idx_scheduled_videos_status ON scheduled_videos(status);
CREATE INDEX idx_scheduled_videos_date_status ON scheduled_videos(schedule_date, status);
CREATE INDEX idx_scheduled_videos_video_id ON scheduled_videos(video_id);
CREATE INDEX idx_scheduled_videos_channel ON scheduled_videos(target_channel_id, schedule_date);

-- =====================================================

-- Table 4: Video Usage Tracker
-- Tracks when and where videos were used (for uniqueness rules)
CREATE TABLE IF NOT EXISTS video_usage_tracker (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  used_date DATE NOT NULL,
  target_channel_id TEXT NOT NULL,
  target_channel_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Ensure each video can only be scheduled once per channel per date
  UNIQUE(video_id, used_date, target_channel_id)
);

-- Indexes for usage tracker
CREATE INDEX idx_usage_tracker_video_id ON video_usage_tracker(video_id);
CREATE INDEX idx_usage_tracker_date ON video_usage_tracker(used_date DESC);
CREATE INDEX idx_usage_tracker_channel ON video_usage_tracker(target_channel_id);
CREATE INDEX idx_usage_tracker_video_channel ON video_usage_tracker(video_id, target_channel_id, used_date DESC);

-- =====================================================

-- Table 5: Schedule Configuration
-- Stores system configuration for scheduled publishing
CREATE TABLE IF NOT EXISTS schedule_config (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT DEFAULT 'default_user' UNIQUE,
  source_channel_id TEXT NOT NULL,
  source_channel_name TEXT NOT NULL,
  source_channel_url TEXT NOT NULL,
  target_channels JSONB NOT NULL DEFAULT '[]', -- Array of {id, name, url, active}
  videos_per_channel INTEGER DEFAULT 4 CHECK (videos_per_channel > 0),
  system_start_date DATE,
  system_status TEXT DEFAULT 'active' CHECK (system_status IN ('active', 'paused')),
  google_drive_folder_id TEXT,
  google_drive_config JSONB, -- {clientId, clientSecret, refreshToken, folderId}
  telegram_channel_id TEXT,
  telegram_bot_token TEXT,
  youtube_api_key TEXT,
  last_schedule_generated_date DATE,
  last_pool_refresh_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default config (will be updated via Settings page)
INSERT INTO schedule_config (user_id, source_channel_id, source_channel_name, source_channel_url, target_channels)
VALUES ('default_user', '', '', '', '[]')
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_video_pool_old_updated_at
  BEFORE UPDATE ON video_pool_old
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_pool_new_updated_at
  BEFORE UPDATE ON video_pool_new
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_videos_updated_at
  BEFORE UPDATE ON scheduled_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_config_updated_at
  BEFORE UPDATE ON schedule_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- Helper Functions for Uniqueness Checking

-- Function: Get last N days a video was used on a specific channel
CREATE OR REPLACE FUNCTION get_video_last_used_on_channel(
  p_video_id TEXT,
  p_channel_id TEXT
)
RETURNS TABLE(last_used_date DATE, days_ago INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    used_date,
    (CURRENT_DATE - used_date)::INTEGER AS days_ago
  FROM video_usage_tracker
  WHERE video_id = p_video_id
    AND target_channel_id = p_channel_id
  ORDER BY used_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all recent usages of a video (cross-channel)
CREATE OR REPLACE FUNCTION get_video_recent_usages(
  p_video_id TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  used_date DATE,
  channel_id TEXT,
  channel_name TEXT,
  days_ago INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vut.used_date,
    vut.target_channel_id,
    vut.target_channel_name,
    (CURRENT_DATE - vut.used_date)::INTEGER AS days_ago
  FROM video_usage_tracker vut
  WHERE vut.video_id = p_video_id
    AND vut.used_date >= CURRENT_DATE - p_days
  ORDER BY vut.used_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if video is eligible for scheduling
CREATE OR REPLACE FUNCTION is_video_eligible(
  p_video_id TEXT,
  p_channel_id TEXT,
  p_schedule_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_used_same_channel INTEGER;
  v_last_used_cross_channel INTEGER;
BEGIN
  -- Check last usage on same channel (15 day rule)
  SELECT days_ago INTO v_last_used_same_channel
  FROM get_video_last_used_on_channel(p_video_id, p_channel_id);

  IF v_last_used_same_channel IS NOT NULL AND v_last_used_same_channel < 15 THEN
    RETURN FALSE;
  END IF;

  -- Check last usage on any other channel (10 day rule)
  SELECT MIN(days_ago) INTO v_last_used_cross_channel
  FROM get_video_recent_usages(p_video_id, 10)
  WHERE channel_id != p_channel_id;

  IF v_last_used_cross_channel IS NOT NULL AND v_last_used_cross_channel < 10 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================

-- View: Schedule Summary (for dashboard)
CREATE OR REPLACE VIEW schedule_summary AS
SELECT
  schedule_date,
  COUNT(*) AS total_videos,
  COUNT(*) FILTER (WHERE status = 'ready') AS ready_count,
  COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'published') AS published_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE video_type = 'new') AS new_videos_count,
  COUNT(*) FILTER (WHERE video_type = 'old') AS old_videos_count,
  ARRAY_AGG(DISTINCT target_channel_name ORDER BY target_channel_name) AS channels
FROM scheduled_videos
GROUP BY schedule_date
ORDER BY schedule_date DESC;

-- View: Video Pool Stats
CREATE OR REPLACE VIEW video_pool_stats AS
SELECT
  'old' AS pool_type,
  COUNT(*) AS total_videos,
  COUNT(*) FILTER (WHERE status = 'active') AS active_videos,
  COUNT(*) FILTER (WHERE status = 'exhausted') AS exhausted_videos,
  AVG(times_scheduled) AS avg_times_scheduled,
  MAX(view_count) AS max_views,
  MIN(view_count) AS min_views,
  AVG(view_count) AS avg_views
FROM video_pool_old
UNION ALL
SELECT
  'new' AS pool_type,
  COUNT(*) AS total_videos,
  COUNT(*) FILTER (WHERE status = 'active') AS active_videos,
  COUNT(*) FILTER (WHERE status = 'exhausted') AS exhausted_videos,
  AVG(times_scheduled) AS avg_times_scheduled,
  MAX(view_count) AS max_views,
  MIN(view_count) AS min_views,
  AVG(view_count) AS avg_views
FROM video_pool_new;

-- =====================================================

-- Comments for documentation
COMMENT ON TABLE video_pool_old IS 'Old videos from source channel for scheduled publishing';
COMMENT ON TABLE video_pool_new IS 'New videos from auto-monitoring system';
COMMENT ON TABLE scheduled_videos IS 'Daily schedule - 4 videos per target channel';
COMMENT ON TABLE video_usage_tracker IS 'Tracks video usage for uniqueness enforcement (15/10 day rules)';
COMMENT ON TABLE schedule_config IS 'System configuration for scheduled publishing';

COMMENT ON FUNCTION is_video_eligible IS 'Check if video can be scheduled (15 day same channel, 10 day cross channel rules)';
COMMENT ON VIEW schedule_summary IS 'Daily schedule summary with status counts';
COMMENT ON VIEW video_pool_stats IS 'Statistics for old and new video pools';

-- =====================================================
-- Migration Complete
-- =====================================================
