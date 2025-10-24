// Delete all scheduled videos for user and regenerate

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const user_id = body.user_id;

    console.log(`🗑️ Deleting old schedule for user: ${user_id}`);

    // Delete all scheduled videos
    const { error: deleteError, count } = await supabase
      .from('scheduled_videos')
      .delete({ count: 'exact' })
      .eq('user_id', user_id);

    if (deleteError) throw deleteError;

    console.log(`✓ Deleted ${count} old videos`);

    // Call generate-daily-schedule
    console.log('📅 Generating fresh schedule...');

    const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-daily-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const genResult = await genResponse.json();

    console.log('📋 Generation result:', JSON.stringify(genResult));

    // Check if generation failed
    if (!genResponse.ok || genResult.success === false) {
      throw new Error(`Schedule generation failed: ${genResult.error || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: count,
        schedule: genResult,
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
