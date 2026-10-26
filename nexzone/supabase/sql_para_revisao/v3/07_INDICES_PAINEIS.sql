-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 07 — Índices para os painéis (desempenho)
-- ============================================================
-- Só cria índices (não muda dados). Ajuda as consultas de Admin > Usuários, Audiência e Crescimento
-- a continuarem rápidas quando a base crescer. Pode rodar mais de uma vez.

create index if not exists stores_owner_idx on public.stores (owner);
create index if not exists stores_created_at_idx on public.stores (created_at desc);
create index if not exists site_pageviews_session_created_idx on public.site_pageviews (session_id, created_at);
create index if not exists site_sessions_last_seen_started_idx on public.site_sessions (last_seen desc, started_at);
