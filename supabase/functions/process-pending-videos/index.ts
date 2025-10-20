// Supabase Edge Function: process-pending-videos
// Purpose: Background worker that processes pending videos from queue
// Should run every 1-2 minutes via cron job

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  // Handle CORS preflight
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
    console.log('🔄 Starting process-pending-videos worker...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending videos (oldest first, limit to 5 at a time)
    const { data: pendingVideos, error: fetchError } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      throw new Error(`Failed to fetch pending videos: ${fetchError.message}`);
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('✓ No pending videos to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending videos',
          processed: 0
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`📦 Found ${pendingVideos.length} pending videos`);

    let processed = 0;
    let failed = 0;

    // Process each pending video
    for (const video of pendingVideos) {
      try {
        console.log(`🎬 Triggering processing for: ${video.video_id}`);

        // Call process-video function
        const response = await fetch(`${supabaseUrl}/functions/v1/process-video`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ video_id: video.video_id }),
        });

        if (response.ok) {
          console.log(`✅ Successfully triggered: ${video.video_id}`);
          processed++;
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to trigger ${video.video_id}:`, errorText);
          failed++;
        }

        // Small delay between videos to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`❌ Error triggering ${video.video_id}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ Worker completed: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        pending_found: pendingVideos.length,
        processed,
        failed,
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
    console.error('❌ Worker error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
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
