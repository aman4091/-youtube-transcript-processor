-- Migration 015: Create User Data Storage Tables
-- Description: Enables multi-device sync by storing user data in database
-- Features: Settings, History, Queue, Counter per user

-- ============================================
-- 1. USER SETTINGS TABLE
-- ============================================
-- Stores all user preferences, API keys, channels, etc.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- API Keys (encrypted in production)
  api_keys JSONB DEFAULT '{
    "supaDataApiKeys": [],
    "deepSeekApiKey": "",
    "geminiApiKey": "",
    "openRouterApiKey": "",
    "youtubeApiKey": ""
  }'::JSONB,

  -- Channel Configuration
  source_channels TEXT[] DEFAULT '{}',
  target_channels JSONB DEFAULT '[]'::JSONB,
  channel_min_durations JSONB DEFAULT '{}'::JSONB,

  -- Prompts
  prompts JSONB DEFAULT '{
    "customPrompt": "",
    "titlePrompt": "Generate 10 catchy, viral YouTube video titles for the following script. Make them engaging and click-worthy."
  }'::JSONB,

  -- Telegram Configuration
  telegram_config JSONB DEFAULT '{
    "botToken": "",
    "chatId": "",
    "chatIdWithTitle": ""
  }'::JSONB,

  -- Preferences
  preferences JSONB DEFAULT '{
    "enableDeepSeek": true,
    "enableGeminiFlash": true,
    "enableGeminiPro": true,
    "enableOpenRouter": true,
    "videoSortOrder": "popular",
    "selectedOpenRouterModel": "meta-llama/llama-3.1-8b-instruct:free",
    "autoMonitoringEnabled": false,
    "monitoringIntervalHours": 2,
    "monitoringAIModel": "deepseek",
    "autoRemoveExhaustedKeys": false
  }'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- 2. USER HISTORY TABLE
-- ============================================
-- Stores processed video history per user
CREATE TABLE IF NOT EXISTS user_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Video Information
  video_url TEXT NOT NULL,
  video_id TEXT,
  video_title TEXT,
  video_thumbnail TEXT,
  channel_title TEXT,

  -- Processing Information (array of target channel processings)
  target_processings JSONB DEFAULT '[]'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique video per user
  CONSTRAINT unique_user_video UNIQUE(user_id, video_url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_video_url ON user_history(video_url);
CREATE INDEX IF NOT EXISTS idx_user_history_created_at ON user_history(created_at DESC);

-- ============================================
-- 3. USER QUEUE TABLE
-- ============================================
-- Stores temporary queue items (scripts waiting to be pushed)
CREATE TABLE IF NOT EXISTS user_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Queue Item Data (complete QueuedScript object)
  queue_item JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_queue_user_id ON user_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_user_queue_created_at ON user_queue(created_at DESC);

-- ============================================
-- 4. USER COUNTER TABLE
-- ============================================
-- Stores script counter for each user
CREATE TABLE IF NOT EXISTS user_counter (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  counter INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_counter_user_id ON user_counter(user_id);

-- ============================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_history_updated_at
  BEFORE UPDATE ON user_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_counter_updated_at
  BEFORE UPDATE ON user_counter
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Initialize for existing admin user
-- ============================================
DO $$
DECLARE
  admin_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Initialize settings for admin user
  INSERT INTO user_settings (user_id)
  VALUES (admin_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Initialize counter for admin user
  INSERT INTO user_counter (user_id, counter)
  VALUES (admin_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Migration 015 completed: User data tables created successfully!' AS status;
