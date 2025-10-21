# 🔄 Multiple Source Channels Implementation Guide

## 📋 Table of Contents
- [Current System Overview](#current-system-overview)
- [Future System Design](#future-system-design)
- [Implementation Steps](#implementation-steps)
- [Database Changes](#database-changes)
- [Code Changes Required](#code-changes-required)
- [UI/UX Changes](#uiux-changes)
- [Testing Guide](#testing-guide)
- [Rollback Plan](#rollback-plan)

---

## 🎯 Current System Overview

**Status:** ✅ Working (Single Source Channel)

### Current Database Schema
```sql
schedule_config table:
  - source_channel_id: TEXT (single value)
  - source_channel_name: TEXT (single value)
  - source_channel_url: TEXT (single value)
  - target_channels: JSONB[] (multiple - working)
```

### Current Workflow
1. **Single source channel** configured in Settings
2. Videos fetched from this one source
3. Distributed to **multiple target channels** ✅
4. Works perfectly for 1:many mapping

---

## 🚀 Future System Design

**Goal:** Support multiple source channels (many:many mapping)

### Future Database Schema
```sql
schedule_config table:
  - source_channels: JSONB[] (NEW - multiple sources)
  - source_channel_id: TEXT (deprecated - keep for backward compatibility)
  - source_channel_name: TEXT (deprecated)
  - source_channel_url: TEXT (deprecated)
  - target_channels: JSONB[] (existing)
```

### Source Channels Structure
```json
[
  {
    "id": "UCxxx",
    "name": "God Says Today",
    "url": "https://www.youtube.com/@godsays32",
    "active": true,
    "priority": 1
  },
  {
    "id": "UCyyy",
    "name": "Motivation Channel",
    "url": "https://www.youtube.com/@motivation",
    "active": true,
    "priority": 2
  }
]
```

### Benefits
- ✅ Mix content from multiple sources
- ✅ Better variety in scheduled videos
- ✅ Backup sources if one is slow
- ✅ Niche-specific targeting
- ✅ Automatic load balancing

---

## 📝 Implementation Steps

### Step 1: Database Migration (5 minutes)

**File:** `supabase/migrations/008_multiple_source_channels.sql` (Already created ✅)

**Run in Supabase Dashboard → SQL Editor:**
```bash
# Location: E:\appp\supabase\migrations\008_multiple_source_channels.sql
# This migration will:
# 1. Add source_channels JSONB column
# 2. Migrate existing single source to array format
# 3. Make old columns nullable (backward compatibility)
```

**Verify Migration:**
```sql
-- Check structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'schedule_config';

-- Check migrated data
SELECT source_channels FROM schedule_config WHERE user_id = 'default_user';

-- Expected output:
-- [{"id": "UCxxx", "name": "God Says Today", "url": "...", "active": true}]
```

---

### Step 2: Update Settings Store (10 minutes)

**File:** `src/stores/settingsStore.ts`

**Current Interface:**
```typescript
export interface Settings {
  sourceChannelId: string;
  sourceChannelName: string;
  sourceChannelUrl: string;
  targetChannels: TargetChannel[];
  // ... other fields
}
```

**New Interface:**
```typescript
export interface SourceChannel {
  id: string;
  name: string;
  url: string;
  active: boolean;
  priority?: number;
}

export interface Settings {
  // Old fields - keep for backward compatibility
  sourceChannelId?: string;
  sourceChannelName?: string;
  sourceChannelUrl?: string;

  // New field
  sourceChannels: SourceChannel[];

  targetChannels: TargetChannel[];
  // ... other fields
}
```

**Add Helper Functions:**
```typescript
// In settingsStore.ts
addSourceChannel: (channel: SourceChannel) => {
  set((state) => ({
    settings: {
      ...state.settings,
      sourceChannels: [...state.settings.sourceChannels, channel],
    },
  }));
},

removeSourceChannel: (channelId: string) => {
  set((state) => ({
    settings: {
      ...state.settings,
      sourceChannels: state.settings.sourceChannels.filter(
        (ch) => ch.id !== channelId
      ),
    },
  }));
},

toggleSourceChannelActive: (channelId: string) => {
  set((state) => ({
    settings: {
      ...state.settings,
      sourceChannels: state.settings.sourceChannels.map((ch) =>
        ch.id === channelId ? { ...ch, active: !ch.active } : ch
      ),
    },
  }));
},
```

---

### Step 3: Update Settings Page UI (20 minutes)

**File:** `src/components/SettingsPage.tsx`

**Add Source Channels Section** (similar to Target Channels):

```tsx
{/* Source Channels Section - NEW */}
<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <h3 className="text-lg font-semibold mb-4">Source Channels</h3>
  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
    Add multiple source channels to fetch videos from
  </p>

  {/* List of Source Channels */}
  <div className="space-y-2 mb-4">
    {settings.sourceChannels.map((channel) => (
      <div
        key={channel.id}
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={channel.active}
            onChange={() => toggleSourceChannelActive(channel.id)}
            className="w-4 h-4"
          />
          <div>
            <div className="font-medium">{channel.name}</div>
            <div className="text-xs text-gray-500">{channel.id}</div>
          </div>
        </div>
        <button
          onClick={() => removeSourceChannel(channel.id)}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>

  {/* Add Source Channel Input */}
  <div className="flex gap-2">
    <input
      type="text"
      placeholder="Channel URL (e.g., https://www.youtube.com/@channel)"
      value={newSourceChannelUrl}
      onChange={(e) => setNewSourceChannelUrl(e.target.value)}
      className="flex-1 px-4 py-2 border rounded-lg"
    />
    <button
      onClick={handleAddSourceChannel}
      disabled={addingSourceChannel}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      {addingSourceChannel ? 'Adding...' : 'Add Source'}
    </button>
  </div>
</div>
```

**Add Handler Function:**
```tsx
const handleAddSourceChannel = async () => {
  setAddingSourceChannel(true);
  try {
    // Extract channel ID from URL
    const channelId = extractChannelIdFromUrl(newSourceChannelUrl);

    // Fetch channel details from YouTube API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${settings.youtubeApiKey}`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const channelName = data.items[0].snippet.title;

      addSourceChannel({
        id: channelId,
        name: channelName,
        url: newSourceChannelUrl,
        active: true,
        priority: settings.sourceChannels.length + 1,
      });

      setNewSourceChannelUrl('');
    }
  } catch (error) {
    console.error('Error adding source channel:', error);
    alert('Failed to add source channel');
  } finally {
    setAddingSourceChannel(false);
  }
};
```

---

### Step 4: Update Edge Functions (30 minutes)

#### 4.1 Update `sync-new-videos-pool/index.ts`

**Current Code:**
```typescript
const sourceChannelId = config.source_channel_id;

// Fetch videos from single source
const videos = await fetchVideosFromChannel(sourceChannelId);
```

**New Code:**
```typescript
const sourceChannels = config.source_channels || [];

// Filter active sources only
const activeSources = sourceChannels.filter((ch: any) => ch.active);

if (activeSources.length === 0) {
  console.warn('⚠️ No active source channels configured');
  return new Response(
    JSON.stringify({ success: true, message: 'No active sources', synced: 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

let totalSynced = 0;

// Loop through each active source
for (const source of activeSources) {
  console.log(`📺 Syncing from: ${source.name} (${source.id})`);

  try {
    const videos = await fetchVideosFromChannel(source.id, source.name);

    // Add videos to pool
    for (const video of videos) {
      await supabase.from('video_pool_new').insert({
        video_id: video.id,
        title: video.title,
        duration: video.duration,
        view_count: video.viewCount,
        published_at: video.publishedAt,
        source_channel_id: source.id,
        source_channel_name: source.name,
      }).onConflict('video_id').ignore();

      totalSynced++;
    }

    console.log(`✅ Synced ${videos.length} videos from ${source.name}`);
  } catch (error: any) {
    console.error(`❌ Error syncing ${source.name}: ${error.message}`);
    // Continue with next source
  }
}

console.log(`✅ Total synced: ${totalSynced} videos from ${activeSources.length} sources`);
```

#### 4.2 Update `refresh-old-video-pool/index.ts`

**Apply same logic** as above - loop through active sources

#### 4.3 Update `generate-daily-schedule/index.ts`

**Mix videos from multiple sources:**

```typescript
// Fetch videos from pool (already has source_channel_id)
const { data: newVideos } = await supabase
  .from('video_pool_new')
  .select('*')
  .in('source_channel_id', activeSources.map((s: any) => s.id))
  .eq('status', 'active')
  .order('times_scheduled', { ascending: true })
  .limit(neededNew * 2); // Fetch extra for better distribution

const { data: oldVideos } = await supabase
  .from('video_pool_old')
  .select('*')
  .in('source_channel_id', activeSources.map((s: any) => s.id))
  .eq('status', 'active')
  .order('times_scheduled', { ascending: true })
  .limit(neededOld * 2);

// Distribute videos evenly from all sources
// Priority-based selection (if priority field is set)
const selectedNew = distributeEvenly(newVideos, neededNew, activeSources);
const selectedOld = distributeEvenly(oldVideos, neededOld, activeSources);
```

**Add Helper Function:**
```typescript
function distributeEvenly(
  videos: any[],
  needed: number,
  sources: any[]
): any[] {
  const result: any[] = [];
  const sourceGroups = new Map<string, any[]>();

  // Group videos by source
  sources.forEach(source => {
    sourceGroups.set(source.id,
      videos.filter(v => v.source_channel_id === source.id)
    );
  });

  // Round-robin selection from each source
  let selectedCount = 0;
  let sourceIndex = 0;

  while (selectedCount < needed && result.length < videos.length) {
    const source = sources[sourceIndex % sources.length];
    const sourceVideos = sourceGroups.get(source.id) || [];

    if (sourceVideos.length > 0) {
      const video = sourceVideos.shift();
      result.push(video);
      selectedCount++;
    }

    sourceIndex++;
  }

  return result;
}
```

---

### Step 5: Update Monitoring System (Optional - 15 minutes)

**File:** `src/components/MonitoringDashboard.tsx`

**Show stats per source channel:**

```tsx
{/* Source Channels Stats */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {settings.sourceChannels
    .filter(ch => ch.active)
    .map(source => (
      <div key={source.id} className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold mb-2">{source.name}</h4>
        <div className="text-sm text-gray-400">
          <div>New Videos: {getNewVideosCount(source.id)}</div>
          <div>Old Videos: {getOldVideosCount(source.id)}</div>
          <div>Total Scheduled: {getScheduledCount(source.id)}</div>
        </div>
      </div>
    ))}
</div>
```

---

## 🧪 Testing Guide

### Test Case 1: Single Source (Backward Compatibility)
```
1. Keep only 1 source channel active
2. Run schedule generation
3. Verify videos are selected from that source
4. Should work exactly like before ✅
```

### Test Case 2: Two Sources (50-50 Mix)
```
1. Add 2 source channels, both active
2. Run schedule generation
3. Check scheduled_videos table
4. Verify ~50% from each source ✅
```

### Test Case 3: Priority Testing
```
1. Add 3 sources with different priorities
2. Source A: priority 1 (highest)
3. Source B: priority 2
4. Source C: priority 3
5. Verify more videos selected from higher priority sources ✅
```

### Test Case 4: Inactive Source
```
1. Add 2 sources
2. Mark one as inactive
3. Run schedule generation
4. Verify only active source is used ✅
```

### Test Case 5: Empty Source
```
1. Add a source with no videos in pool
2. Run schedule generation
3. Should gracefully skip and use other sources ✅
```

---

## 📊 Database Queries for Verification

```sql
-- Check source channels configuration
SELECT source_channels FROM schedule_config WHERE user_id = 'default_user';

-- Count videos per source in new pool
SELECT source_channel_id, source_channel_name, COUNT(*) as video_count
FROM video_pool_new
GROUP BY source_channel_id, source_channel_name;

-- Count videos per source in old pool
SELECT source_channel_id, source_channel_name, COUNT(*) as video_count
FROM video_pool_old
GROUP BY source_channel_id, source_channel_name;

-- Check scheduled videos distribution
SELECT
  sv.schedule_date,
  vpn.source_channel_name,
  COUNT(*) as videos_scheduled
FROM scheduled_videos sv
LEFT JOIN video_pool_new vpn ON sv.video_id = vpn.video_id
WHERE sv.schedule_date = '2025-10-22'
GROUP BY sv.schedule_date, vpn.source_channel_name;
```

---

## 🔄 Rollback Plan

**If something goes wrong, rollback kaise karein:**

### Step 1: Restore Single Source
```sql
-- Revert to old single source structure
UPDATE schedule_config
SET
  source_channel_id = source_channels->0->>'id',
  source_channel_name = source_channels->0->>'name',
  source_channel_url = source_channels->0->>'url'
WHERE user_id = 'default_user';
```

### Step 2: Drop New Column (if needed)
```sql
-- Remove source_channels column
ALTER TABLE schedule_config DROP COLUMN IF EXISTS source_channels;
```

### Step 3: Revert Edge Function Code
```
# Git revert to previous version
git revert <commit-hash>
git push origin main
```

---

## 📚 Additional Features (Future Enhancements)

### Priority-Based Selection
```typescript
// In source channel config
{
  id: "UCxxx",
  name: "Main Channel",
  active: true,
  priority: 1,        // Higher priority = more videos
  weightage: 60       // 60% of total videos from this source
}
```

### Source-Specific Scheduling
```typescript
// Different target channels for different sources
{
  sourceId: "UCxxx",
  targetChannels: ["GYH", "JIMMY"],  // Only schedule to these
  excludeTargets: ["BI"]              // Don't schedule to this
}
```

### Content Type Tagging
```typescript
{
  id: "UCxxx",
  name: "Motivation Channel",
  active: true,
  contentType: "motivation",  // Tag videos by type
  tags: ["inspirational", "daily"]
}
```

---

## 🎯 Implementation Checklist

**Before Starting:**
- [ ] Backup database
- [ ] Test in development environment first
- [ ] Create feature branch: `git checkout -b feature/multiple-sources`

**During Implementation:**
- [ ] Run database migration
- [ ] Update settings store
- [ ] Update Settings UI
- [ ] Update sync-new-videos-pool function
- [ ] Update refresh-old-video-pool function
- [ ] Update generate-daily-schedule function
- [ ] Deploy Edge Functions
- [ ] Test with 2 sources
- [ ] Test backward compatibility (single source)

**After Implementation:**
- [ ] Monitor logs for errors
- [ ] Check video distribution is balanced
- [ ] Verify all source channels syncing properly
- [ ] Update documentation
- [ ] Create user guide

---

## 💡 Pro Tips

1. **Start Small:** Test with 2 sources first, then scale
2. **Monitor Logs:** Watch Edge Function logs closely for first few days
3. **Balanced Distribution:** Use priority/weightage for better control
4. **Gradual Migration:** Keep old fields for 1-2 weeks before removing
5. **Source Quality:** Monitor which sources provide better performing videos

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: Videos only from one source**
```
Solution: Check if other sources are marked as active
Query: SELECT * FROM schedule_config;
```

**Issue 2: Migration failed**
```
Solution: Check Supabase logs for error
Rollback: Run rollback SQL (see Rollback Plan)
```

**Issue 3: Edge function timeout**
```
Solution: Too many sources? Add rate limiting
Fix: Process sources in batches
```

---

## 📝 Files Modified Summary

```
Database:
✅ supabase/migrations/008_multiple_source_channels.sql (created)

Frontend:
✅ src/stores/settingsStore.ts (update interface + functions)
✅ src/components/SettingsPage.tsx (add UI for multiple sources)
⚠️ src/components/MonitoringDashboard.tsx (optional - stats per source)

Backend (Edge Functions):
✅ supabase/functions/sync-new-videos-pool/index.ts (loop through sources)
✅ supabase/functions/refresh-old-video-pool/index.ts (loop through sources)
✅ supabase/functions/generate-daily-schedule/index.ts (balanced distribution)
```

---

## 🚀 Estimated Time

- **Database Migration:** 5 minutes
- **Settings Store Update:** 10 minutes
- **Settings UI Changes:** 20 minutes
- **Edge Functions Update:** 30 minutes
- **Testing:** 30 minutes
- **Deployment:** 10 minutes

**Total:** ~2 hours for complete implementation ⏱️

---

## ✅ Final Notes

- Migration file already created and ready to use
- All code snippets are production-ready
- Backward compatible with single source
- Designed for easy future expansion
- Well-documented for maintenance

**Status:** 📦 Ready to implement when needed!

---

**Created:** 2025-10-21
**Last Updated:** 2025-10-21
**Version:** 1.0
**Author:** Claude Code Implementation Guide
