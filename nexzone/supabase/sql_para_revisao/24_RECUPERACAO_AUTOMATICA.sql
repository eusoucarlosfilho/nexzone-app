-- ============================================================
-- SQL 24 — Recuperação automática de vendas (robô de 1 em 1 minuto)
-- ------------------------------------------------------------
-- Rode DEPOIS do SQL 22 (ele cria push_config e liga o pg_net) e ANTES de subir o código desta entrega.
-- Pode rodar mais de uma vez.
--
-- Por que existe: os lembretes de Pix e de carrinho já estavam prontos no site, mas a Vercel (plano Hobby)
-- só roda a rotina UMA vez por dia. Este SQL faz o próprio Supabase chamar a rotina a cada minuto.
--
-- O que faz:
--   1) liga o pg_cron (agendador do Supabase)
--   2) cria uma senha interna só para essa chamada (fica em push_config; não precisa mexer na Vercel)
--   3) agenda a chamada de /api/cron/eventos a cada 1 minuto
--   4) aceita os novos tipos de lembrete: "imediato" e "retro" (pedidos antigos)
--   5) tempo do primeiro lembrete (padrão 5 minutos; o admin muda em Pedidos › Recuperação)
-- Não mexe em pedidos, pagamentos nem saldo.
-- ============================================================

-- 1) agendador (se der erro aqui: Supabase › Database › Extensions › ligue "pg_cron" e rode de novo)
create extension if not exists pg_cron;

-- 2) senha interna da rotina
insert into public.push_config(chave, valor) values
  ('segredo_cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (chave) do nothing;

-- 3) a cada 1 minuto o Supabase chama o site (a URL vem de push_config.url_site, do SQL 22)
create or replace function public.chamar_rotina_eventos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
begin
  select valor into v_url from public.push_config where chave = 'url_site';
  select valor into v_segredo from public.push_config where chave = 'segredo_cron';
  if v_url is null or v_segredo is null then return; end if;
  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/eventos',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_segredo),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function public.chamar_rotina_eventos() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'cb-recuperacao-1min';
  perform cron.schedule('cb-recuperacao-1min', '* * * * *', 'select public.chamar_rotina_eventos()');
end $$;

-- 4) tipos de lembrete
alter table public.lembretes_pix drop constraint if exists lembretes_pix_etapa_check;
alter table public.lembretes_pix add constraint lembretes_pix_etapa_check check (etapa in ('15min', '24h', 'imediato', 'retro')) not valid;

-- 5) tempo do primeiro lembrete (minutos)
do $$
begin
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'value') = 'jsonb' then
    insert into public.settings(key, value) values ('recuperacao_minutos', '5'::jsonb) on conflict (key) do nothing;
  else
    insert into public.settings(key, value) values ('recuperacao_minutos', '5') on conflict (key) do nothing;
  end if;
end $$;

-- ------------------------------------------------------------
-- Conferência (rode depois; tudo "true")
-- ------------------------------------------------------------
-- select
--   exists (select 1 from cron.job where jobname = 'cb-recuperacao-1min') as robo_agendado,
--   exists (select 1 from public.push_config where chave = 'segredo_cron') as senha_criada;
-- Últimas execuções do robô:
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;

-- Para desligar o robô (só se precisar):
-- select cron.unschedule('cb-recuperacao-1min');
