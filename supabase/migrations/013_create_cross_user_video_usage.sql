-- Migration 013: Create cross_user_video_usage table
-- Tracks video usage across all users to enforce 10-day gap when same source channel

CREATE TABLE IF NOT EXISTS cross_user_video_usage (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  used_date DATE NOT NULL,
  user_id UUID NOT NULL,
  source_channel_id TEXT,
  target_channel_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cross_user_video_id_date ON cross_user_video_usage(video_id, used_date DESC);
CREATE INDEX IF NOT EXISTS idx_cross_user_user_id ON cross_user_video_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_user_used_date ON cross_user_video_usage(used_date DESC);

COMMENT ON TABLE cross_user_video_usage IS 'Tracks video usage across all users for enforcing 10-day cross-user gap rule';
COMMENT ON COLUMN cross_user_video_usage.video_id IS 'YouTube video ID';
COMMENT ON COLUMN cross_user_video_usage.used_date IS 'Date when video was scheduled';
COMMENT ON COLUMN cross_user_video_usage.user_id IS 'User who scheduled this video';
