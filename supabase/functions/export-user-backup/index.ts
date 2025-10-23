// Supabase Edge Function: export-user-backup
// Exports complete user data as JSON backup
// Returns: downloadable JSON file with all user data

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
    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📦 Exporting backup for user ${user_id}`);

    // Fetch user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, display_name')
      .eq('id', user_id)
      .single();

    if (userError) {
      throw new Error(`User not found: ${userError.message}`);
    }

    // Fetch settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    // Fetch history
    const { data: history } = await supabase
      .from('user_history')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    // Fetch queue
    const { data: queue } = await supabase
      .from('user_queue')
      .select('queue_item')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true });

    // Fetch counter
    const { data: counter } = await supabase
      .from('user_counter')
      .select('counter')
      .eq('user_id', user_id)
      .single();

    // Build backup object
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      user: {
        id: user_id,
        username: user.username,
        display_name: user.display_name,
      },
      data: {
        settings: settings || null,
        history: (history || []).map((h) => ({
          video_url: h.video_url,
          video_id: h.video_id,
          video_title: h.video_title,
          video_thumbnail: h.video_thumbnail,
          channel_title: h.channel_title,
          target_processings: h.target_processings,
          created_at: h.created_at,
        })),
        queue: (queue || []).map((q) => q.queue_item),
        counter: counter?.counter || 0,
      },
      metadata: {
        total_history: history?.length || 0,
        total_queue: queue?.length || 0,
      },
    };

    console.log(`✅ Backup created: ${backup.metadata.total_history} history + ${backup.metadata.total_queue} queue items`);

    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="youtube-processor-backup-${user.username}-${new Date().toISOString().split('T')[0]}.json"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('❌ Export error:', error.message);
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
