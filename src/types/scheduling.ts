// =====================================================
// YouTube Scheduled Publishing System - TypeScript Types
// =====================================================

// ============= Database Tables =============

export interface VideoPoolOld {
  id: number;
  video_id: string;
  title: string;
  duration: number; // seconds
  view_count: number;
  published_at: string;
  source_channel_id: string;
  source_channel_name: string;
  times_scheduled: number;
  last_scheduled_date: string | null;
  added_at: string;
  status: 'active' | 'exhausted';
  created_at: string;
  updated_at: string;
}

export interface VideoPoolNew {
  id: number;
  video_id: string;
  title: string;
  duration: number;
  view_count: number;
  published_at: string;
  source_channel_id: string;
  processed_script_path: string | null; // Google Drive path
  times_scheduled: number;
  last_scheduled_date: string | null;
  added_at: string;
  status: 'active' | 'exhausted';
  created_at: string;
  updated_at: string;
}

export interface ScheduledVideo {
  id: number;
  schedule_date: string; // YYYY-MM-DD
  target_channel_id: string;
  target_channel_name: string;
  slot_number: number; // 1, 2, 3, or 4
  video_id: string;
  video_title: string;
  video_type: 'old' | 'new';
  status: 'pending' | 'processing' | 'ready' | 'published' | 'failed';
  processed_script_path: string | null;
  raw_transcript_path: string | null; // Path to raw transcript from SupaData (VideoN_raw.txt)
  google_drive_file_id: string | null;
  telegram_sent_at: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface VideoUsageTracker {
  id: number;
  video_id: string;
  used_date: string; // YYYY-MM-DD
  target_channel_id: string;
  target_channel_name: string;
  created_at: string;
}

export interface TargetChannel {
  id: string;
  name: string;
  url: string;
  active: boolean;
}

export interface ScheduleConfig {
  id: number;
  user_id: string;
  source_channel_id: string;
  source_channel_name: string;
  source_channel_url: string;
  target_channels: TargetChannel[];
  videos_per_channel: number;
  system_start_date: string | null;
  system_status: 'active' | 'paused';
  google_drive_folder_id: string | null;
  telegram_channel_id: string | null;
  last_schedule_generated_date: string | null;
  last_pool_refresh_date: string | null;
  created_at: string;
  updated_at: string;
}

// ============= API Request/Response Types =============

export interface GenerateScheduleRequest {
  date?: string; // Optional, defaults to tomorrow
}

export interface GenerateScheduleResponse {
  success: boolean;
  date: string;
  total_videos: number;
  by_channel: Record<string, number>;
  new_videos_count: number;
  old_videos_count: number;
  schedule: ScheduledVideo[];
  message?: string;
  error?: string;
}

export interface ProcessScheduledVideosResponse {
  success: boolean;
  processed: number;
  failed: number;
  skipped: number;
  details: {
    video_id: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }[];
  error?: string;
}

export interface SyncNewVideosPoolResponse {
  success: boolean;
  synced: number;
  existing: number;
  total_new_pool_size: number;
  message?: string;
  error?: string;
}

export interface RefreshOldVideoPoolRequest {
  max_videos?: number; // Default: 200
  force?: boolean; // Force refresh even if recently refreshed
}

export interface RefreshOldVideoPoolResponse {
  success: boolean;
  added: number;
  exhausted: number;
  total_pool_size: number;
  message?: string;
  error?: string;
}

export interface BulkPushToTelegramRequest {
  date: string; // YYYY-MM-DD
}

export interface BulkPushToTelegramResponse {
  success: boolean;
  sent: number;
  failed: number;
  filenames: string[];
  details: {
    filename: string;
    status: 'success' | 'failed';
    error?: string;
  }[];
  error?: string;
}

// ============= Service Types =============

export interface VideoSelectionCriteria {
  excludeVideoIds: string[];
  excludeFromChannels?: Record<string, string[]>; // channelId -> videoIds to exclude
  count: number;
  minDuration?: number; // seconds
  preferHighViews?: boolean;
}

export interface UniquenessCheckResult {
  eligible: boolean;
  reason?: string;
  lastUsedDate?: string;
  daysAgo?: number;
  channelId?: string;
}

export interface DailySchedulePlan {
  date: string;
  channelAssignments: Record<string, ChannelVideos>;
  totalVideos: number;
  newVideosCount: number;
  oldVideosCount: number;
}

export interface ChannelVideos {
  channelId: string;
  channelName: string;
  videos: ScheduledVideoItem[];
}

export interface ScheduledVideoItem {
  slotNumber: number;
  videoId: string;
  videoTitle: string;
  videoType: 'old' | 'new';
  source: 'pool_old' | 'pool_new';
}

// ============= Frontend Component Props =============

export interface ScheduleTodayPageProps {
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateShorts: () => void;
  onNavigateTitle: () => void;
  onNavigateMonitoring: () => void;
  onNavigateSettings: () => void;
  onPushToChat?: () => void;
}

export interface ScheduledVideoCardProps {
  video: ScheduledVideo;
  onPreview: (video: ScheduledVideo) => void;
  onReprocess?: (video: ScheduledVideo) => void;
}

export interface ScheduleSummary {
  date: string;
  total_videos: number;
  ready_count: number;
  processing_count: number;
  pending_count: number;
  published_count: number;
  failed_count: number;
  new_videos_count: number;
  old_videos_count: number;
  channels: string[];
}

export interface VideoPoolStats {
  pool_type: 'old' | 'new';
  total_videos: number;
  active_videos: number;
  exhausted_videos: number;
  avg_times_scheduled: number;
  max_views: number;
  min_views: number;
  avg_views: number;
}

// ============= Google Drive Types =============

export interface GoogleDriveUploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
  path: string; // Local path representation
}

export interface GoogleDriveFolderStructure {
  rootFolderId: string;
  dateFolderId: string;
  channelFolderId: string;
  path: string;
}

// ============= Telegram Types =============

export interface TelegramBulkSendOptions {
  date: string;
  channelId: string;
  delayBetweenSends?: number; // milliseconds
  retryOnFailure?: boolean;
}

export interface TelegramSendResult {
  filename: string;
  messageId: string | null;
  success: boolean;
  error?: string;
}

// ============= Error Types =============

export class SchedulingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}

export class VideoPoolError extends SchedulingError {
  constructor(message: string, details?: any) {
    super(message, 'VIDEO_POOL_ERROR', details);
    this.name = 'VideoPoolError';
  }
}

export class UniquenessViolationError extends SchedulingError {
  constructor(message: string, details?: any) {
    super(message, 'UNIQUENESS_VIOLATION', details);
    this.name = 'UniquenessViolationError';
  }
}

export class GoogleDriveError extends SchedulingError {
  constructor(message: string, details?: any) {
    super(message, 'GOOGLE_DRIVE_ERROR', details);
    this.name = 'GoogleDriveError';
  }
}

// ============= Utility Types =============

export type ScheduleStatus = 'pending' | 'processing' | 'ready' | 'published' | 'failed';
export type VideoType = 'old' | 'new';
export type VideoPoolStatus = 'active' | 'exhausted';
export type SystemStatus = 'active' | 'paused';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface ProcessingProgress {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  percentage: number;
}
