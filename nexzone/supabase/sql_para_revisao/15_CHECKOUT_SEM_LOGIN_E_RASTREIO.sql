-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 15 · Checkout sem login + origem das vendas (Sprint 1)
-- ============================================================
-- 1) orders.origem: de onde veio cada venda (utm_source, utm_medium, utm_campaign, utm_content,
--    utm_term, src, sck e o site de referência). O vendedor vê no relatório "Vendas por origem".
-- 2) order_rastreio: identificadores de clique dos anúncios (fbp/fbc/fbclid/ttclid/gclid), IP e
--    navegador do comprador no momento da compra. Só o servidor lê (vai ser usado pela API de
--    Conversões do Meta/TikTok na Sprint 2). Apagado automaticamente pela rotina de privacidade
--    depois de 90 dias (ver a função abaixo).
--
-- Não muda valores, pagamento, webhook nem liberação do produto.
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA.

-- 1) Origem da venda
alter table public.orders add column if not exists origem jsonb null;
create index if not exists orders_origem_campanha_idx on public.orders ((origem->>'utm_campaign')) where origem is not null;

-- 2) Rastreio privado (só servidor)
create table if not exists public.order_rastreio (
  order_id uuid primary key references public.orders(id) on delete cascade,
  cliques jsonb null,          -- fbp, fbc, fbclid, ttclid, gclid, ttp
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);
alter table public.order_rastreio enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava

-- Limpeza (LGPD): remove IP/navegador/cliques com mais de 90 dias. Rode quando quiser ou agende.
create or replace function public.limpar_order_rastreio()
returns integer
language sql
security definer
set search_path = public
as $$
  with apagados as (
    delete from public.order_rastreio where created_at < now() - interval '90 days' returning 1
  ) select count(*)::int from apagados;
$$;
revoke execute on function public.limpar_order_rastreio() from public, anon, authenticated;

-- Conferência (só leitura)
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'origem';
select to_regclass('public.order_rastreio') as tabela_rastreio;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop function if exists public.limpar_order_rastreio();
-- drop table if exists public.order_rastreio;
-- drop index if exists public.orders_origem_campanha_idx;
-- alter table public.orders drop column if exists origem;
-- ============================================================
