// Apply RLS policies to scheduled_videos table
const { createClient } = require('@supabase/supabase-js');

async function applyRLS() {
  console.log('🔧 Applying RLS policies...');

  // Get credentials from Supabase CLI status
  const { execSync } = require('child_process');

  try {
    const statusOutput = execSync('supabase status --output json', { encoding: 'utf8' });
    const status = JSON.parse(statusOutput);

    // Use remote project credentials
    const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';

    // We need the service role key - it should be in the Supabase project settings
    // For now, let's get it from environment or use the anon key to call the fix-rls-policies function

    console.log('⚠️ Service role key required');
    console.log('Please run this in Supabase SQL Editor or use the fix-rls-policies edge function');
    console.log('');
    console.log('SQL to execute:');
    console.log('');

    const sql = `
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
`;

    console.log(sql);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyRLS();
