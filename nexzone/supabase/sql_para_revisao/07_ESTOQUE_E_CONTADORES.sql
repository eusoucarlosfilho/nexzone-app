-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Estoque do produto + exibição dos contadores
-- ============================================================
-- 07 · Estoque informado pelo vendedor, baixa automática a cada venda paga,
--      pausa automática quando zera e opção do admin de ocultar avaliações/vendas na página.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- Produtos já cadastrados ficam com estoque VAZIO (= não controla estoque, nada muda para eles).
-- Rode ANTES de subir o código novo.
--
-- Não altera checkout, webhooks nem fulfill.ts. A baixa é feita por um gatilho no banco
-- que roda quando o pedido muda para "pago"/"entregue". Esse gatilho NUNCA bloqueia o pedido:
-- qualquer erro dentro dele é ignorado e o pagamento segue normalmente.

-- 1) Colunas novas em products
alter table public.products add column if not exists estoque int null;
alter table public.products add column if not exists pausado_sem_estoque boolean not null default false;
alter table public.products add column if not exists ocultar_contadores boolean not null default false;

alter table public.products drop constraint if exists products_estoque_valido;
alter table public.products add constraint products_estoque_valido
  check (estoque is null or (estoque >= 0 and estoque <= 1000000));

-- 2) Baixa/devolução de estoque quando o status do pedido muda
create or replace function public.estoque_por_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  antes_pago boolean := false;
  agora_pago boolean := new.status in ('pago', 'entregue');
  ids uuid[];
  bump text;
begin
  if tg_op = 'UPDATE' then
    antes_pago := old.status in ('pago', 'entregue');
  end if;

  -- produto principal + order bump (se a coluna existir neste banco)
  bump := to_jsonb(new) ->> 'bump_product_id';
  ids := array[new.product_id];
  if bump is not null and bump <> '' then
    ids := ids || bump::uuid;
  end if;

  begin
    if agora_pago and not antes_pago then
      -- venda confirmada: tira 1; se zerar, pausa e marca "esgotado"
      update public.products
         set estoque = greatest(estoque - 1, 0),
             status = case when estoque - 1 <= 0 and status = 'ativo' then 'pausado' else status end,
             pausado_sem_estoque = case when estoque - 1 <= 0 and status = 'ativo' then true else pausado_sem_estoque end
       where id = any(ids) and estoque is not null;
    elsif antes_pago and new.status in ('reembolsado', 'cancelado') then
      -- reembolso/cancelamento: devolve 1
      update public.products
         set estoque = estoque + 1
       where id = any(ids) and estoque is not null;
    end if;
  exception when others then
    raise warning 'estoque_por_pedido ignorado: %', sqlerrm;  -- nunca trava o pedido
  end;
  return new;
end;
$$;

drop trigger if exists orders_estoque on public.orders;
create trigger orders_estoque
  after insert or update of status on public.orders
  for each row execute function public.estoque_por_pedido();

-- 3) Reposição: quando um produto "esgotado" recebe estoque de novo, volta ao ar sozinho
--    (só os que foram pausados pelo estoque; pausa manual continua pausada).
create or replace function public.estoque_reativa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.pausado_sem_estoque and coalesce(new.estoque, 1) > 0 and new.status = 'pausado' then
    new.status := 'ativo';
    new.pausado_sem_estoque := false;
  elsif new.status <> 'pausado' then
    new.pausado_sem_estoque := false;
  end if;
  return new;
end;
$$;

drop trigger if exists products_estoque_reativa on public.products;
create trigger products_estoque_reativa
  before update on public.products
  for each row execute function public.estoque_reativa();

-- 4) Conferência (só leitura)
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products'
   and column_name in ('estoque', 'pausado_sem_estoque', 'ocultar_contadores')
 order by column_name;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists orders_estoque on public.orders;
-- drop trigger if exists products_estoque_reativa on public.products;
-- drop function if exists public.estoque_por_pedido();
-- drop function if exists public.estoque_reativa();
-- alter table public.products drop constraint if exists products_estoque_valido;
-- alter table public.products drop column if exists ocultar_contadores;
-- alter table public.products drop column if exists pausado_sem_estoque;
-- alter table public.products drop column if exists estoque;
-- ============================================================
