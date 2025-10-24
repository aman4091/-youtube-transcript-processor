// Supabase Edge Function: sync-settings
// Purpose: Sync monitoring settings from frontend to backend database

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Types
interface SyncSettingsRequest {
  user_id: string;
  enabled: boolean;
  check_interval_hours: number;
  source_channels: string[];
  ai_model: string;
  custom_prompt: string;
  supabase_api_key: string;
  deepseek_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  openrouter_model?: string;
  youtube_api_key: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_chat_id_with_title?: string;
  min_video_duration_minutes?: number;
  max_video_duration_minutes?: number;
  min_view_count?: number;
  keywords_include?: string[];
  keywords_exclude?: string[];
  max_videos_per_check?: number;
  delay_between_videos_seconds?: number;
  notify_on_success?: boolean;
  notify_on_error?: boolean;
}

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
    console.log('🔄 Syncing settings from frontend...');

    // Parse request body
    const settings: SyncSettingsRequest = await req.json();

    // Validate required fields
    if (!settings.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!settings.youtube_api_key) {
      return new Response(
        JSON.stringify({ error: 'YouTube API key is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      return new Response(
        JSON.stringify({ error: 'Telegram credentials are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate AI model and corresponding API key
    switch (settings.ai_model) {
      case 'deepseek':
        if (!settings.deepseek_api_key) {
          return new Response(
            JSON.stringify({ error: 'DeepSeek API key required for selected model' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }
        break;
      case 'gemini-flash':
      case 'gemini-pro':
        if (!settings.gemini_api_key) {
          return new Response(
            JSON.stringify({ error: 'Gemini API key required for selected model' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }
        break;
      case 'openrouter':
        if (!settings.openrouter_api_key) {
          return new Response(
            JSON.stringify({ error: 'OpenRouter API key required for selected model' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }
        break;
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare settings object for database
    const dbSettings = {
      user_id: settings.user_id,
      enabled: settings.enabled,
      check_interval_hours: settings.check_interval_hours || 2,
      source_channels: settings.source_channels || [],
      ai_model: settings.ai_model,
      custom_prompt: settings.custom_prompt || '',
      supabase_api_key: settings.supabase_api_key,
      deepseek_api_key: settings.deepseek_api_key || null,
      gemini_api_key: settings.gemini_api_key || null,
      openrouter_api_key: settings.openrouter_api_key || null,
      openrouter_model: settings.openrouter_model || null,
      youtube_api_key: settings.youtube_api_key,
      telegram_bot_token: settings.telegram_bot_token,
      telegram_chat_id: settings.telegram_chat_id,
      telegram_chat_id_with_title: settings.telegram_chat_id_with_title || null,
      min_video_duration_minutes: settings.min_video_duration_minutes || 27,
      max_video_duration_minutes: settings.max_video_duration_minutes || 120,
      min_view_count: settings.min_view_count || 0,
      keywords_include: settings.keywords_include || [],
      keywords_exclude: settings.keywords_exclude || [],
      max_videos_per_check: settings.max_videos_per_check || 10,
      delay_between_videos_seconds: settings.delay_between_videos_seconds || 5,
      notify_on_success: settings.notify_on_success ?? false,
      notify_on_error: settings.notify_on_error ?? true,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert settings (insert or update)
    const { data, error } = await supabase
      .from('auto_monitor_settings')
      .upsert(dbSettings, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Settings synced successfully');

    // If monitoring is enabled, verify cron job is running
    if (settings.enabled) {
      console.log('✓ Monitoring is enabled');

      // Optional: Trigger a test check immediately
      // (Commented out to avoid unnecessary API calls)
      /*
      try {
        await fetch(`${supabaseUrl}/functions/v1/check-new-videos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('✓ Triggered initial check');
      } catch (err) {
        console.warn('⚠️ Could not trigger initial check:', err);
      }
      */
    } else {
      console.log('⏸️ Monitoring is disabled');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Settings synced successfully',
        enabled: settings.enabled,
        synced_at: dbSettings.last_sync_at,
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
    console.error('❌ Error syncing settings:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
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
