-- ============================================================
-- SQL 32 — Vendedor avalia o cliente (por venda)
-- Rodar no projeto de TESTES primeiro, depois no de produção.
-- Só cria uma tabela nova. Não altera nem apaga nada que já existe.
-- Fechada (RLS ligada e sem política): só o servidor do site (service_role) lê e grava.
-- ============================================================
create table if not exists public.avaliacoes_cliente (
  id bigserial primary key,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  comprador uuid not null,
  avaliador uuid not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists avaliacoes_cliente_comprador_idx on public.avaliacoes_cliente (comprador);
create index if not exists avaliacoes_cliente_loja_idx on public.avaliacoes_cliente (store_id);
alter table public.avaliacoes_cliente enable row level security;

-- Conferência (deve mostrar relrowsecurity = true):
-- select relname, relrowsecurity from pg_class where relname = 'avaliacoes_cliente';
