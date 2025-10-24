// Supabase Edge Function: generate-schedule-for-all-users
// Called by GitHub workflow to generate schedules for ALL active users

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
    console.log('🤖 Auto-generating schedules for all active users...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users with active schedule configs
    const { data: configs, error: configError } = await supabase
      .from('schedule_config')
      .select('user_id, system_status')
      .eq('system_status', 'active');

    if (configError) {
      console.error('❌ Error fetching configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('⚠️ No active users found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active users to generate schedules for',
          users_processed: 0,
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

    console.log(`📋 Found ${configs.length} active user(s)`);

    const results = [];

    // Generate schedule for each active user
    for (const config of configs) {
      console.log(`\n👤 Processing user: ${config.user_id}`);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-daily-schedule`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: config.user_id }),
        });

        const result = await response.json();

        if (result.success || result.skipped) {
          console.log(`✅ Success for user ${config.user_id}`);
          results.push({
            user_id: config.user_id,
            success: true,
            ...result,
          });
        } else {
          console.error(`❌ Failed for user ${config.user_id}:`, result.error);
          results.push({
            user_id: config.user_id,
            success: false,
            error: result.error,
          });
        }
      } catch (error: any) {
        console.error(`❌ Exception for user ${config.user_id}:`, error.message);
        results.push({
          user_id: config.user_id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n✅ Completed: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: configs.length,
        success_count: successCount,
        fail_count: failCount,
        results,
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
