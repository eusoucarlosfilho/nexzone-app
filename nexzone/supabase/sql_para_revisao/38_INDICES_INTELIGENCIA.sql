-- ============================================================
-- SQL 38 — Índices para a Inteligência Comercial, Ofertas do dia e Divulgação do vendedor
-- Opcional, mas recomendado antes de abrir os painéis com períodos de 30 dias ou mais.
-- Só cria índices (não muda dado nenhum). "concurrently" não trava as tabelas durante a criação:
-- rode UMA linha por vez no SQL Editor (concurrently não funciona dentro de transação).
-- Rollback: drop index concurrently if exists <nome>;
-- ============================================================
create index concurrently if not exists site_sessions_utm_src_idx on public.site_sessions (utm_source, utm_content, started_at desc) where utm_source is not null;
create index concurrently if not exists site_pageviews_path_created_idx on public.site_pageviews (path, created_at desc);
create index concurrently if not exists orders_created_idx on public.orders (created_at desc);
create index concurrently if not exists orders_store_created_idx on public.orders (store_id, created_at desc);

-- Leitura (não altera nada) para conferir o volume antes e depois:
-- select relname, n_live_tup from pg_stat_user_tables where relname in ('site_sessions','site_pageviews','site_events','orders');
