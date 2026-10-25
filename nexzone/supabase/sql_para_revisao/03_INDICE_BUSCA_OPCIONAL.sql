-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Ofertas Parceiras · pacote V3 (candidato)
-- Nenhum destes scripts foi executado em nenhum banco.
-- ============================================================
-- 03 · Busca por nome mais rápida (OPCIONAL; só com muitas ofertas, ex.: mais de 5 mil)
-- A busca usa ILIKE '%termo%', que não aproveita índice comum.
-- CONCURRENTLY: rode cada comando sozinho, fora de transação.

create extension if not exists pg_trgm;

create index concurrently if not exists partner_offers_title_trgm_idx
  on public.partner_offers using gin (title gin_trgm_ops);

-- Reverter:
-- drop index concurrently if exists public.partner_offers_title_trgm_idx;
