-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 08 — Conferência (somente leitura)
-- ============================================================
-- Não altera nada. Mostra o que já foi aplicado dos scripts V3.

select 'C1: gatilho proteger_campos_perfil' as item,
       exists(select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'proteger_campos_perfil') as aplicado
union all
select '02: colunas de localização/origem em profiles',
       exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='uf')
union all
select '02: gatilho registrar_vendedor_desde',
       exists(select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'registrar_vendedor_desde')
union all
select '03: products.publicado_em',
       exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='publicado_em')
union all
select '04: tabela site_events', to_regclass('public.site_events') is not null
union all
select '04: eventos de funil ligados', coalesce((select value = 'true'::jsonb from public.settings where key = 'analytics_funil'), false)
union all
select '05: UTM em site_sessions',
       exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_sessions' and column_name='utm_campaign')
union all
select '05: sem coordenadas gravadas', not exists(select 1 from public.site_sessions where lat is not null or lon is not null)
union all
select '06: função de retenção', exists(select 1 from pg_proc where proname = 'limpar_analytics_antigos');
