-- Setup 10-minute cron for chunk processing
-- Run this in Supabase SQL Editor

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old cron job if exists
SELECT cron.unschedule('process-chunks-every-10-min');

-- Schedule Edge Function to run every 10 minutes
SELECT cron.schedule(
  'process-chunks-every-10-min',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://oonugywfdtzrcrydmazk.supabase.co/functions/v1/process-chunks-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Check scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'process-chunks-every-10-min';
