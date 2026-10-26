-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 16 · Sprint 2: compra pelo servidor (Meta/TikTok), postback e recuperação de Pix
-- ============================================================
-- 1) eventos_pedido: fila de eventos de venda (Pix gerado, compra aprovada, reembolso).
--    Um gatilho em orders só ANOTA o evento (não chama internet, não muda nada no pedido).
--    Quem envia é o servidor (rotina /api/cron/eventos + a página do pedido).
-- 2) produto_integracoes: tokens da API de Conversões (Meta/TikTok) e postback de cada produto.
--    Tokens e segredo ficam CRIPTOGRAFADOS e só o servidor lê.
-- 3) entregas_integracao: histórico de envios (o vendedor vê os últimos no construtor do checkout).
-- 4) lembretes_pix: trava para não mandar o mesmo lembrete de Pix duas vezes.
--
-- Não altera checkout, webhooks, fulfill.ts nem valores.
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA.

-- 1) Fila de eventos
create table if not exists public.eventos_pedido (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  evento text not null check (evento in ('pix_gerado', 'compra', 'reembolso')),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'feito', 'erro')),
  tentativas int not null default 0,
  proxima_em timestamptz not null default now(),
  detalhes jsonb not null default '{}'::jsonb,   -- { meta: 'ok' | 'ignorado' | 'erro: …', tiktok: …, postback: … }
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (order_id, evento)
);
create index if not exists eventos_pedido_fila_idx on public.eventos_pedido(proxima_em) where status in ('pendente', 'processando');
alter table public.eventos_pedido enable row level security;

create or replace function public.anotar_evento_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  antes_pago boolean := false;
  agora_pago boolean := new.status in ('pago', 'entregue');
begin
  if tg_op = 'UPDATE' then antes_pago := old.status in ('pago', 'entregue'); end if;
  begin
    -- Pix gerado: o código Pix acabou de ser gravado num pedido pendente
    if new.status = 'pendente' and new.pix_code is not null
       and (tg_op = 'INSERT' or old.pix_code is null) then
      insert into public.eventos_pedido(order_id, evento) values (new.id, 'pix_gerado') on conflict do nothing;
    end if;
    if agora_pago and not antes_pago then
      insert into public.eventos_pedido(order_id, evento) values (new.id, 'compra') on conflict do nothing;
    end if;
    if antes_pago and new.status = 'reembolsado' then
      insert into public.eventos_pedido(order_id, evento) values (new.id, 'reembolso') on conflict do nothing;
    end if;
  exception when others then
    raise warning 'anotar_evento_pedido ignorado: %', sqlerrm;  -- nunca trava o pedido
  end;
  return new;
end;
$$;

drop trigger if exists orders_anotar_evento on public.orders;
create trigger orders_anotar_evento
  after insert or update of status, pix_code on public.orders
  for each row execute function public.anotar_evento_pedido();

-- 2) Integrações por produto (só servidor)
create table if not exists public.produto_integracoes (
  product_id uuid primary key references public.products(id) on delete cascade,
  meta_token text null,            -- criptografado (enc:v1:…)
  meta_teste text null,            -- código de evento de teste do Meta (opcional, para homologar)
  tiktok_token text null,          -- criptografado
  postback_url text null,
  postback_segredo text null,      -- criptografado
  postback_eventos text[] not null default '{venda_aprovada}',
  atualizado_em timestamptz not null default now()
);
alter table public.produto_integracoes enable row level security;

-- 3) Histórico de envios
create table if not exists public.entregas_integracao (
  id bigserial primary key,
  order_id uuid null references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete cascade,
  evento text not null,
  destino text not null,           -- meta | tiktok | postback | postback_teste
  ok boolean not null,
  http_status int null,
  resposta text null,
  created_at timestamptz not null default now()
);
create index if not exists entregas_integracao_produto_idx on public.entregas_integracao(product_id, created_at desc);
alter table public.entregas_integracao enable row level security;

-- 4) Lembretes de Pix
create table if not exists public.lembretes_pix (
  order_id uuid not null references public.orders(id) on delete cascade,
  etapa text not null check (etapa in ('15min', '24h')),
  canais text[] not null default '{}',
  enviado_em timestamptz not null default now(),
  primary key (order_id, etapa)
);
alter table public.lembretes_pix enable row level security;
-- sem políticas nas 4 tabelas: só o servidor (service_role) lê e grava

-- Conferência (só leitura)
select to_regclass('public.eventos_pedido') as fila, to_regclass('public.produto_integracoes') as integracoes,
       to_regclass('public.entregas_integracao') as entregas, to_regclass('public.lembretes_pix') as lembretes;
select tgname from pg_trigger where tgname = 'orders_anotar_evento';

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists orders_anotar_evento on public.orders;
-- drop function if exists public.anotar_evento_pedido();
-- drop table if exists public.lembretes_pix;
-- drop table if exists public.entregas_integracao;
-- drop table if exists public.produto_integracoes;
-- drop table if exists public.eventos_pedido;
-- ============================================================
