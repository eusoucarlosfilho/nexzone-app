-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 05 — Origem do tráfego (UTM) nas sessões + limpeza de privacidade
-- ============================================================
-- 1) Colunas para as 4 chaves UTM e o canal calculado no servidor. O código V3 já tenta gravar;
--    sem estas colunas ele grava no formato antigo (sem UTM).
-- 2) Privacidade (minimização):
--    - Apaga latitude/longitude já gravadas (o código V3 não grava mais coordenadas).
--    - Reduz o "referrer" antigo ao domínio (https://site/), removendo caminhos e parâmetros que
--      poderiam conter dados pessoais. O código V3 já grava só o domínio.
-- Pode rodar mais de uma vez. As linhas 2) alteram dados existentes de analytics (não de usuários).

alter table public.site_sessions add column if not exists utm_source text null;
alter table public.site_sessions add column if not exists utm_medium text null;
alter table public.site_sessions add column if not exists utm_campaign text null;
alter table public.site_sessions add column if not exists utm_content text null;
alter table public.site_sessions add column if not exists canal text null;

alter table public.site_sessions drop constraint if exists site_sessions_utm_len_check;
alter table public.site_sessions add constraint site_sessions_utm_len_check check (
  coalesce(char_length(utm_source), 0) <= 80 and coalesce(char_length(utm_medium), 0) <= 80
  and coalesce(char_length(utm_campaign), 0) <= 80 and coalesce(char_length(utm_content), 0) <= 80
  and coalesce(char_length(canal), 0) <= 40
);

create index if not exists site_sessions_user_idx on public.site_sessions (user_id) where user_id is not null;
create index if not exists site_sessions_campaign_idx on public.site_sessions (utm_campaign, started_at desc) where utm_campaign is not null;

-- Privacidade: sem coordenadas e sem URL completa de origem
update public.site_sessions set lat = null, lon = null where lat is not null or lon is not null;
update public.site_sessions
   set referrer = regexp_replace(referrer, '^(https?://[^/?#]+).*$', '\1/')
 where referrer ~ '^https?://[^/?#]+[/?#].+';

-- Conferência (somente leitura)
select count(*) filter (where lat is not null) as com_coordenadas,
       count(*) filter (where utm_campaign is not null) as com_campanha,
       count(*) as sessoes
  from public.site_sessions;

-- Reverter as colunas (os dados apagados em 2 não voltam):
-- alter table public.site_sessions drop column if exists utm_source, drop column if exists utm_medium,
--   drop column if exists utm_campaign, drop column if exists utm_content, drop column if exists canal;
