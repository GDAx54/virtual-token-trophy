CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('tokenbet-sync-matches');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('tokenbet-resolve-bets');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'tokenbet-sync-matches',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e4c4b29c-5a40-4029-8611-bf0c8ce516ce-dev.lovable.app/api/public/cron/sync-matches',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_uGk9ye4JCfXWFL2-6d3-RA_B5BKKqpB"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'tokenbet-resolve-bets',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e4c4b29c-5a40-4029-8611-bf0c8ce516ce-dev.lovable.app/api/public/cron/resolve-bets',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_uGk9ye4JCfXWFL2-6d3-RA_B5BKKqpB"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);