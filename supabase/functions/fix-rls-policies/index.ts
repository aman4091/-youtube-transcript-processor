// Supabase Edge Function: fix-rls-policies
// Fixes RLS policies for scheduled_videos table

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    console.log('🔧 Fixing RLS policies...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Drop existing policies
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Users can view own scheduled_videos" ON scheduled_videos;
        DROP POLICY IF EXISTS "Users can insert own scheduled_videos" ON scheduled_videos;
        DROP POLICY IF EXISTS "Users can update own scheduled_videos" ON scheduled_videos;
        DROP POLICY IF EXISTS "Users can delete own scheduled_videos" ON scheduled_videos;
      `
    });

    // Enable RLS
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE scheduled_videos ENABLE ROW LEVEL SECURITY;'
    });

    // Create policies
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    console.log('✅ RLS policies fixed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RLS policies fixed',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
