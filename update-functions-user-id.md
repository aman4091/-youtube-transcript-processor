# Backend Functions - user_id Update Plan

## Common Pattern for All Functions:

```typescript
// 1. Get user_id from request body
const { user_id } = await req.json();

if (!user_id) {
  throw new Error('user_id is required');
}

// 2. Filter all queries with .eq('user_id', user_id)
```

## Functions to Update:

### 1. generate-daily-schedule
- Add user_id parameter
- Filter: schedule_config, scheduled_videos, video_pool_old, video_pool_new, video_usage_tracker
- Add: cross_user_video_usage check (10-day gap)

### 2. process-scheduled-videos
- Add user_id parameter
- Filter: auto_monitor_settings, scheduled_videos

### 3. check-new-videos
- Add user_id parameter
- Filter: auto_monitor_settings, processed_videos, video_pool_new

### 4. refresh-old-video-pool
- Add user_id parameter
- Filter: auto_monitor_settings, video_pool_old

### 5. sync-new-videos-pool
- Add user_id parameter
- Filter: schedule_config, processed_videos, video_pool_new

### 6. bulk-push-to-telegram
- Add user_id parameter
- Filter: schedule_config, scheduled_videos

### 7. update-processed-script
- Add user_id parameter
- Filter: scheduled_videos

## Frontend Updates Needed:

All places that call Supabase functions need to pass user_id from useUserStore.

Example:
```typescript
const { user } = useUserStore();
await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-schedule`, {
  body: JSON.stringify({ user_id: user.id })
});
```
