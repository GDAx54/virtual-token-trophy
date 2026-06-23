create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpia jobs antiguos por idempotencia
do $$ begin
  perform cron.unschedule('tokenbet-sync-matches');
exception when others then null; end $$;
do $$ begin
  perform cron.unschedule('tokenbet-resolve-bets');
exception when others then null; end $$;

select cron.schedule(
  'tokenbet-sync-matches',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://project--e4c4b29c-5a40-4029-8611-bf0c8ce516ce.lovable.app/api/public/cron/sync-matches',
       headers := '{"Content-Type":"application/json","apikey":"sb_publishable_uGk9ye4JCfXWFL2-6d3-RA_B5BKKqpB"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

select cron.schedule(
  'tokenbet-resolve-bets',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://project--e4c4b29c-5a40-4029-8611-bf0c8ce516ce.lovable.app/api/public/cron/resolve-bets',
       headers := '{"Content-Type":"application/json","apikey":"sb_publishable_uGk9ye4JCfXWFL2-6d3-RA_B5BKKqpB"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);