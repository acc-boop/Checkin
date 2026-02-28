-- ============================================================
-- checkin — Reminder Cron Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- AFTER deploying the send-reminders edge function.
-- ============================================================

-- 1. Enable required extensions (pg_cron is pre-installed on Supabase Pro+)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the edge function to run every 15 minutes.
--    Replace the two placeholders below with your actual values:
--      YOUR_PROJECT_REF  → e.g. abcdefghij (from your Supabase URL)
--      YOUR_SERVICE_ROLE_KEY → Settings → API → service_role key
SELECT cron.schedule(
  'send-checkin-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Seed a reminder config for your first company.
--    Replace YOUR_COMPANY_ID with the actual compId from your kv_store cfg.
--    You can find it by running:
--      SELECT value FROM kv_store WHERE key = 'acct-v9-cfg';
--    and looking at the companies object keys.
--
-- INSERT INTO kv_store (key, value) VALUES (
--   'acct-v9-reminder-cfg-YOUR_COMPANY_ID',
--   '{"enabled":true,"dailyEnabled":true,"weeklyEnabled":true,"pausedMembers":{}}'
-- ) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Verify the cron job is scheduled:
-- SELECT * FROM cron.job;

-- 5. Monitor execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 6. To disable reminders later:
-- SELECT cron.unschedule('send-checkin-reminders');
