-- YouTube Auto-Monitor Database Schema
-- Migration: 001 - Initial Schema
-- Created: 2025-10-19

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table 1: Processed Videos Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS processed_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT UNIQUE NOT NULL,
  video_title TEXT,
  video_url TEXT,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_url TEXT,
  duration_seconds INTEGER,
  view_count INTEGER,
  published_at TIMESTAMP,
  processed_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('success', 'failed', 'pending', 'retrying')) NOT NULL DEFAULT 'pending',
  ai_model TEXT,
  transcript_length INTEGER,
  output_length INTEGER,
  error_message TEXT,
  telegram_sent BOOLEAN DEFAULT false,
  telegram_message_id TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_processed_videos_video_id ON processed_videos(video_id);
CREATE INDEX idx_processed_videos_channel_id ON processed_videos(channel_id);
CREATE INDEX idx_processed_videos_status ON processed_videos(status);
CREATE INDEX idx_processed_videos_processed_at ON processed_videos(processed_at DESC);
CREATE INDEX idx_processed_videos_created_at ON processed_videos(created_at DESC);

-- ============================================
-- Table 2: Monitoring Logs
-- ============================================
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_time TIMESTAMP DEFAULT NOW(),
  channels_checked INTEGER DEFAULT 0,
  new_videos_found INTEGER DEFAULT 0,
  videos_processed INTEGER DEFAULT 0,
  videos_failed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('success', 'partial_success', 'failed')) NOT NULL,
  error_details JSONB,
  duration_ms INTEGER,
  api_calls_made INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_monitoring_logs_check_time ON monitoring_logs(check_time DESC);
CREATE INDEX idx_monitoring_logs_status ON monitoring_logs(status);

-- ============================================
-- Table 3: Auto-Monitor Settings
-- ============================================
CREATE TABLE IF NOT EXISTS auto_monitor_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT DEFAULT 'default_user',
  enabled BOOLEAN DEFAULT true,
  check_interval_hours INTEGER DEFAULT 2 CHECK (check_interval_hours >= 1 AND check_interval_hours <= 24),

  -- Source channels to monitor
  source_channels TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- AI Model settings
  ai_model TEXT CHECK (ai_model IN ('deepseek', 'gemini-flash', 'gemini-pro', 'openrouter')) DEFAULT 'deepseek',
  custom_prompt TEXT DEFAULT '',

  -- API Keys (encrypted in production)
  supabase_api_key TEXT,
  deepseek_api_key TEXT,
  gemini_api_key TEXT,
  openrouter_api_key TEXT,
  openrouter_model TEXT,
  youtube_api_key TEXT,

  -- Telegram settings
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  telegram_chat_id_with_title TEXT,

  -- Filtering settings
  min_video_duration_minutes INTEGER DEFAULT 27,
  max_video_duration_minutes INTEGER DEFAULT 120,
  min_view_count INTEGER DEFAULT 0,
  keywords_include TEXT[] DEFAULT ARRAY[]::TEXT[],
  keywords_exclude TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Rate limiting
  max_videos_per_check INTEGER DEFAULT 10,
  delay_between_videos_seconds INTEGER DEFAULT 5,

  -- Notification settings
  notify_on_success BOOLEAN DEFAULT false,
  notify_on_error BOOLEAN DEFAULT true,

  -- Metadata
  last_sync_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure only one settings row per user
  UNIQUE(user_id)
);

-- Insert default settings
INSERT INTO auto_monitor_settings (user_id, enabled)
VALUES ('default_user', false)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- Table 4: Processing Queue
-- ============================================
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_title TEXT,
  channel_id TEXT,
  channel_title TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for queue processing
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority DESC, created_at ASC);
CREATE INDEX idx_processing_queue_video_id ON processing_queue(video_id);

-- ============================================
-- Table 5: Error Logs
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  video_id TEXT,
  function_name TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for error tracking
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for processed_videos
CREATE TRIGGER update_processed_videos_updated_at
  BEFORE UPDATE ON processed_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for auto_monitor_settings
CREATE TRIGGER update_auto_monitor_settings_updated_at
  BEFORE UPDATE ON auto_monitor_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for processing_queue
CREATE TRIGGER update_processing_queue_updated_at
  BEFORE UPDATE ON processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views for Analytics
-- ============================================

-- View: Daily statistics
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(processed_at) as date,
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(DISTINCT channel_id) as unique_channels,
  AVG(transcript_length) as avg_transcript_length,
  AVG(output_length) as avg_output_length
FROM processed_videos
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- View: Channel statistics
CREATE OR REPLACE VIEW channel_stats AS
SELECT
  channel_id,
  channel_title,
  COUNT(*) as videos_processed,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  MAX(processed_at) as last_processed,
  AVG(view_count) as avg_views
FROM processed_videos
GROUP BY channel_id, channel_title
ORDER BY videos_processed DESC;

-- View: Recent errors
CREATE OR REPLACE VIEW recent_errors AS
SELECT
  pv.video_id,
  pv.video_title,
  pv.channel_title,
  pv.error_message,
  pv.retry_count,
  pv.processed_at
FROM processed_videos pv
WHERE pv.status = 'failed'
ORDER BY pv.processed_at DESC
LIMIT 50;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE processed_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_monitor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (for now, allow all - customize based on auth later)
CREATE POLICY "Allow all operations on processed_videos" ON processed_videos FOR ALL USING (true);
CREATE POLICY "Allow all operations on monitoring_logs" ON monitoring_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations on auto_monitor_settings" ON auto_monitor_settings FOR ALL USING (true);
CREATE POLICY "Allow all operations on processing_queue" ON processing_queue FOR ALL USING (true);
CREATE POLICY "Allow all operations on error_logs" ON error_logs FOR ALL USING (true);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get monitoring statistics
CREATE OR REPLACE FUNCTION get_monitoring_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_videos_processed', (SELECT COUNT(*) FROM processed_videos),
    'successful_videos', (SELECT COUNT(*) FROM processed_videos WHERE status = 'success'),
    'failed_videos', (SELECT COUNT(*) FROM processed_videos WHERE status = 'failed'),
    'videos_today', (SELECT COUNT(*) FROM processed_videos WHERE DATE(processed_at) = CURRENT_DATE),
    'last_check', (SELECT MAX(check_time) FROM monitoring_logs),
    'monitoring_enabled', (SELECT enabled FROM auto_monitor_settings WHERE user_id = 'default_user'),
    'total_channels', (SELECT COUNT(DISTINCT channel_id) FROM processed_videos)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE processed_videos IS 'Tracks all videos that have been processed by the auto-monitoring system';
COMMENT ON TABLE monitoring_logs IS 'Logs each monitoring check with statistics';
COMMENT ON TABLE auto_monitor_settings IS 'Configuration for the auto-monitoring system';
COMMENT ON TABLE processing_queue IS 'Queue of videos waiting to be processed';
COMMENT ON TABLE error_logs IS 'Centralized error logging for debugging';

COMMENT ON COLUMN processed_videos.status IS 'Current status: pending, processing, success, failed, retrying';
COMMENT ON COLUMN processed_videos.retry_count IS 'Number of retry attempts for failed videos';
COMMENT ON COLUMN auto_monitor_settings.check_interval_hours IS 'How frequently to check for new videos (1-24 hours)';
COMMENT ON COLUMN auto_monitor_settings.max_videos_per_check IS 'Maximum number of videos to process per monitoring check';
