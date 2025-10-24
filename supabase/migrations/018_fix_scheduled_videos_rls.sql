-- Fix RLS policies for scheduled_videos table
-- Ensure users can read/write their own scheduled videos

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can insert own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can update own scheduled_videos" ON scheduled_videos;
DROP POLICY IF EXISTS "Users can delete own scheduled_videos" ON scheduled_videos;

-- Enable RLS
ALTER TABLE scheduled_videos ENABLE ROW LEVEL SECURITY;

-- Recreate policies
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
