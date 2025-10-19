// Types for Auto-Monitoring System

export interface AutoMonitorSettings {
  enabled: boolean;
  check_interval_hours: number;
  source_channels: string[];
  ai_model: 'deepseek' | 'gemini-flash' | 'gemini-pro' | 'openrouter';
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

export interface ProcessedVideo {
  id: string;
  video_id: string;
  video_title: string | null;
  video_url: string | null;
  channel_id: string;
  channel_title: string | null;
  channel_url: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  published_at: string | null;
  processed_at: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  ai_model: string | null;
  transcript_length: number | null;
  output_length: number | null;
  error_message: string | null;
  telegram_sent: boolean;
  telegram_message_id: string | null;
  retry_count: number;
  last_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitoringLog {
  id: string;
  check_time: string;
  channels_checked: number;
  new_videos_found: number;
  videos_processed: number;
  videos_failed: number;
  errors: number;
  status: 'success' | 'partial_success' | 'failed';
  error_details: any | null;
  duration_ms: number | null;
  api_calls_made: number;
  created_at: string;
}

export interface ProcessingQueue {
  id: string;
  video_id: string;
  video_url: string;
  video_title: string | null;
  channel_id: string | null;
  channel_title: string | null;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface ErrorLog {
  id: string;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  context: any | null;
  video_id: string | null;
  function_name: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  created_at: string;
}

export interface MonitoringStats {
  total_videos_processed: number;
  successful_videos: number;
  failed_videos: number;
  videos_today: number;
  last_check: string | null;
  monitoring_enabled: boolean;
  total_channels: number;
}

export interface DailyStats {
  date: string;
  total_videos: number;
  successful: number;
  failed: number;
  unique_channels: number;
  avg_transcript_length: number | null;
  avg_output_length: number | null;
}

export interface ChannelStats {
  channel_id: string;
  channel_title: string | null;
  videos_processed: number;
  successful: number;
  failed: number;
  last_processed: string | null;
  avg_views: number | null;
}

export interface SyncSettingsResponse {
  success: boolean;
  message?: string;
  enabled?: boolean;
  synced_at?: string;
  error?: string;
}

export interface CheckVideosResponse {
  success: boolean;
  channels_checked: number;
  videos_found: number;
  videos_filtered: number;
  new_videos: number;
  videos_queued: number;
  errors: string[];
  duration_ms: number;
}

export interface ProcessVideoResponse {
  success: boolean;
  video_id: string;
  video_title: string;
  transcript_length: number;
  output_length: number;
  telegram_message_id: string;
  duration_ms: number;
}
