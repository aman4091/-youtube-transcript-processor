// Supabase Edge Function: update-processed-script
// Updates processed script content in database and Google Drive
// Used for manual editing of AI-processed scripts

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
    const { video_id, new_script_content, user_id } = await req.json();

    if (!video_id || !new_script_content || !user_id) {
      throw new Error('video_id, new_script_content, and user_id are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update database with new content AND change status to ready
    // Filter by both video_id AND user_id for security
    const { error: updateError } = await supabase
      .from('scheduled_videos')
      .update({
        processed_script: new_script_content,
        status: 'ready'  // Change from pending to ready
      })
      .eq('id', video_id)
      .eq('user_id', user_id);

    if (updateError) {
      throw new Error(`Failed to update database: ${updateError.message}`);
    }

    console.log(`✅ Updated processed script and status to 'ready' for video ${video_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Script updated successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('Error updating processed script:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
