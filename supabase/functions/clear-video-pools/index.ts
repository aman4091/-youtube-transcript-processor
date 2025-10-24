// Supabase Edge Function: clear-video-pools
// Clears video pools for a specific user (useful for re-sync)

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
    console.log('🗑️ Clearing video pools...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request
    const body = await req.json();
    const user_id = body.user_id;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`👤 Clearing pools for user: ${user_id}`);

    // Delete from video_pool_old (both with user_id and NULL user_id for cleanup)
    const { error: oldError1, count: oldCount1 } = await supabase
      .from('video_pool_old')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);

    const { error: oldError2, count: oldCount2 } = await supabase
      .from('video_pool_old')
      .delete({ count: 'exact' })
      .is('user_id', null);

    const oldCount = (oldCount1 || 0) + (oldCount2 || 0);

    if (oldError1 || oldError2) {
      console.error('❌ Failed to clear video_pool_old:', oldError1 || oldError2);
    } else {
      console.log(`✓ Deleted ${oldCount} videos from video_pool_old (${oldCount1 || 0} with user_id, ${oldCount2 || 0} NULL)`);
    }

    // Delete from video_pool_new (both with user_id and NULL user_id for cleanup)
    const { error: newError1, count: newCount1 } = await supabase
      .from('video_pool_new')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);

    const { error: newError2, count: newCount2 } = await supabase
      .from('video_pool_new')
      .delete({ count: 'exact' })
      .is('user_id', null);

    const newCount = (newCount1 || 0) + (newCount2 || 0);

    if (newError1 || newError2) {
      console.error('❌ Failed to clear video_pool_new:', newError1 || newError2);
    } else {
      console.log(`✓ Deleted ${newCount} videos from video_pool_new (${newCount1 || 0} with user_id, ${newCount2 || 0} NULL)`);
    }

    console.log('✅ Video pools cleared successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Video pools cleared',
        deleted_old: oldCount || 0,
        deleted_new: newCount || 0,
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
