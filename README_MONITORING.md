# 🚀 Auto-Monitoring System - Setup Guide

Complete guide for setting up 24/7 automatic YouTube video monitoring and processing.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup Steps](#setup-steps)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Cost Breakdown](#cost-breakdown)

---

## 🎯 Overview

The Auto-Monitoring System automatically:
- Checks your source channels every 2 hours for new videos
- Filters videos based on duration, views, keywords
- Fetches transcripts automatically
- Processes with AI (DeepSeek/Gemini/OpenRouter)
- Sends to Telegram automatically
- Tracks all activity in database
- Provides analytics dashboard

**100% FREE** using free tiers of Supabase and Vercel!

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Vercel - Frontend]                                        │
│  ├─ React App (current app)                                 │
│  ├─ User Interface                                          │
│  └─ Manual Processing                                       │
│                                                              │
│  [Supabase - Backend + DB]                                  │
│  ├─ Edge Functions (monitoring service)                     │
│  ├─ PostgreSQL Database (track videos)                      │
│  ├─ Cron Jobs (every 2 hours)                              │
│  └─ Auto-processing pipeline                                │
│                                                              │
│  [Telegram Bot]                                             │
│  └─ Receive processed scripts                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Prerequisites

Before setup, you need:

1. ✅ **Supabase Account** (free) - [supabase.com](https://supabase.com)
2. ✅ **YouTube API Key** (free) - [console.cloud.google.com](https://console.cloud.google.com)
3. ✅ **AI API Keys** (at least one):
   - DeepSeek (recommended, cheapest)
   - Google Gemini
   - OpenRouter
4. ✅ **Telegram Bot** (free) - Already have it
5. ✅ **Vercel Account** (free) - For deployment

---

## 🔧 Setup Steps

### Step 1: Create Supabase Project (5 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new project:
   - **Name**: `youtube-auto-monitor`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to you
   - Click "Create new project"
4. Wait 2-3 minutes for project to be ready

### Step 2: Run Database Migration (2 minutes)

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Open file: `supabase/migrations/001_initial_schema.sql`
4. Copy ENTIRE contents and paste into SQL Editor
5. Click **Run** button
6. Wait for success message: "Success. No rows returned"

### Step 3: Deploy Edge Functions (10 minutes)

**Option A: Using Supabase CLI** (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy check-new-videos
supabase functions deploy process-video
supabase functions deploy sync-settings
```

**Option B: Manual Upload via Dashboard**

1. Go to **Edge Functions** in Supabase dashboard
2. Click **Create a new function**
3. Upload each function folder from `supabase/functions/`

### Step 4: Setup Cron Job (2 minutes)

1. In Supabase dashboard, go to **Database** → **Cron Jobs**
2. Click **Create a new cron job**
3. Paste this SQL:

```sql
SELECT cron.schedule(
  'youtube-auto-monitor',
  '0 */2 * * *',  -- Every 2 hours
  $$
  SELECT net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/check-new-videos',
    headers := '{"Authorization": "Bearer YOUR-SERVICE-ROLE-KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

4. Replace `YOUR-PROJECT-REF` and `YOUR-SERVICE-ROLE-KEY` with your values
5. Click **Create**

### Step 5: Get Supabase Credentials (1 minute)

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://abcdef.supabase.co`)
   - **anon public** key (starts with `eyJhbGc...`)
   - **service_role** key (for cron job only)

### Step 6: Configure Environment Variables (3 minutes)

**For Local Development:**

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**For Vercel Deployment:**

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Add these variables:
   - `VITE_SUPABASE_URL` = Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Your anon key
3. Click **Save**

### Step 7: Update Frontend Code (5 minutes)

**Remaining tasks (complete these):**

1. **Update NavigationBar** (`src/components/NavigationBar.tsx`):
   - Add "Monitoring" tab between "Title" and "Settings"
   - Add `onNavigateMonitoring` prop

2. **Update SettingsPage** (`src/components/SettingsPage.tsx`):
   - Add Auto-Monitoring section with:
     - Enable/Disable toggle
     - Interval selector (1h, 2h, 4h, 6h)
     - AI Model selector
     - Sync button

3. **Update App.tsx** (`src/App.tsx`):
   - Import MonitoringDashboard
   - Add `showMonitoringPage` state
   - Add routing for Monitoring page

4. **Build and deploy**:
   ```bash
   npm run build
   git add .
   git commit -m "Add auto-monitoring system"
   git push
   ```

---

## 🧪 Testing

### Test 1: Manual Sync Settings

1. Go to Settings page
2. Enable "Auto-Monitoring"
3. Select AI model (DeepSeek recommended)
4. Click "Sync Settings" button
5. Should see success message

### Test 2: Manual Check

1. Go to Monitoring Dashboard
2. Click "Manual Check Now" button
3. Should find new videos (if any)
4. Check database: `processed_videos` table should have entries

### Test 3: Verify Cron Job

1. Wait 2 hours
2. Check `monitoring_logs` table in Supabase
3. Should see new entries every 2 hours

### Test 4: End-to-End Flow

1. Upload a new video to your source channel
2. Wait for next cron check (max 2 hours)
3. Video should be:
   - ✅ Detected by cron job
   - ✅ Transcript fetched
   - ✅ Processed with AI
   - ✅ Sent to Telegram
   - ✅ Recorded in database

---

## 🐛 Troubleshooting

### Issue: "Supabase not configured"

**Solution**: Check `.env.local` file exists and has correct values.

```bash
# Verify environment variables are loaded
npm run dev
# Check browser console for Supabase configuration status
```

### Issue: Cron job not running

**Solution**:
1. Check cron job is created: Database → Cron Jobs
2. Verify service_role key is correct
3. Check Edge Function logs in Supabase dashboard

### Issue: Videos not being processed

**Solution**:
1. Check `monitoring_logs` table for errors
2. Verify API keys are correct in settings
3. Check `error_logs` table for detailed errors

### Issue: "Failed to sync settings"

**Solution**:
1. Verify all required API keys are entered
2. Check Supabase Edge Function logs
3. Ensure YouTube API key has quota remaining

---

## 💰 Cost Breakdown (Monthly)

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| **Vercel** | 100GB bandwidth | ~2-5GB | **$0** ✅ |
| **Supabase** | 500MB DB, 2GB bandwidth | ~100MB DB, 500MB bandwidth | **$0** ✅ |
| **YouTube API** | 10,000 units/day | ~100-500 units/day | **$0** ✅ |
| **DeepSeek API** | Pay-as-you-go | ~$0.001/video × 100 videos | **~$0.10** |
| **Telegram Bot** | Unlimited | Unlimited | **$0** ✅ |

**Total Monthly Cost**: **$0.10 - $2** (depending on volume)

---

## 📊 Database Schema

### `processed_videos`
Tracks all videos that have been processed.

### `monitoring_logs`
Logs each monitoring check with statistics.

### `auto_monitor_settings`
Configuration for the auto-monitoring system (synced from frontend).

### `processing_queue`
Queue of videos waiting to be processed.

### `error_logs`
Centralized error logging for debugging.

---

## 🎉 Features Included

✅ 24/7 automatic monitoring
✅ Smart filtering (duration, views, keywords)
✅ Retry logic for failed videos
✅ Real-time dashboard
✅ Error tracking & notifications
✅ Analytics & statistics
✅ Manual trigger option
✅ Multi-channel support
✅ Fully customizable

---

## 🔐 Security Notes

1. ✅ **anon key** is safe to expose in frontend (read-only)
2. ❌ **service_role key** should ONLY be used in backend/cron jobs
3. ✅ Row Level Security (RLS) enabled on all tables
4. ✅ API keys encrypted in database

---

## 📞 Support

If you face issues:
1. Check Supabase Edge Function logs
2. Check browser console for errors
3. Check `error_logs` table in database
4. Review this README carefully

---

## 🚀 Next Steps

After setup is complete:
1. Add your source YouTube channels in Settings
2. Enable auto-monitoring
3. Sync settings to Supabase
4. Monitor the Dashboard
5. Relax and let it run 24/7! 🎉

---

**Happy Monitoring! 🚀**
