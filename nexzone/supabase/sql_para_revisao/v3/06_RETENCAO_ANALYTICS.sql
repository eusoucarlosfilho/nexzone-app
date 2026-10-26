-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 06 — Política de retenção dos dados de audiência (proposta)
-- ============================================================
-- Proposta:
--   site_pageviews: 180 dias · site_events: 180 dias · partner_offer_clicks: 180 dias
--   site_sessions: 400 dias (permite comparar com o mesmo período do ano anterior)
-- Cria uma função que apaga o que passou do prazo. NÃO agenda nada sozinha.
-- Para rodar automaticamente, use o agendamento comentado no fim (pg_cron) depois de aprovado.

create or replace function public.limpar_analytics_antigos()
returns table(tabela text, apagados bigint) language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  delete from public.site_pageviews where created_at < now() - interval '180 days';
  get diagnostics n = row_count; tabela := 'site_pageviews'; apagados := n; return next;

  if to_regclass('public.site_events') is not null then
    execute 'delete from public.site_events where created_at < now() - interval ''180 days''';
    get diagnostics n = row_count; tabela := 'site_events'; apagados := n; return next;
  end if;

  if to_regclass('public.partner_offer_clicks') is not null then
    execute 'delete from public.partner_offer_clicks where created_at < now() - interval ''180 days''';
    get diagnostics n = row_count; tabela := 'partner_offer_clicks'; apagados := n; return next;
  end if;

  delete from public.site_sessions where started_at < now() - interval '400 days';
  get diagnostics n = row_count; tabela := 'site_sessions'; apagados := n; return next;
end; $$;

revoke all on function public.limpar_analytics_antigos() from public, anon, authenticated;

-- Execução manual (quando aprovado):
-- select * from public.limpar_analytics_antigos();

-- Agendamento diário às 04:17 (exige a extensão pg_cron habilitada no Supabase):
-- select cron.schedule('limpar-analytics', '17 7 * * *', $$select public.limpar_analytics_antigos()$$);
