-- ============================================================
-- Comprei Barato · 11 · Até 4 order bumps por produto + trava de segurança nos pedidos
-- ============================================================
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Rode ANTES de subir o código da fase 2 no GitHub (o código novo usa estas colunas).
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
--
-- 1) products.bumps: lista dos order bumps do produto, na ordem do checkout.
--    Formato: [{ "product_id": "<uuid>", "valor": 9.90 }, ...] — no máximo 4.
--    O bump antigo (bump_product_id / bump_valor) é copiado como o 1º da lista.
-- 2) orders.bumps: itens extras comprados em cada pedido (título e valor na compra;
--    o conteúdo de entrega só é gravado depois do pagamento confirmado).
-- 3) Trava: pedido criado direto pela API do banco (fora do site) nasce sempre "pendente"
--    e sem nenhum conteúdo de entrega. Fecha a brecha de alguém criar um pedido já
--    "entregue" e baixar o arquivo de qualquer produto sem pagar.
--    O site cria os pedidos pelo servidor (service_role), que não é afetado.

-- 1) Lista de bumps no produto
alter table public.products add column if not exists bumps jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_bumps_max4;
alter table public.products add constraint products_bumps_max4
  check (jsonb_typeof(bumps) = 'array' and jsonb_array_length(bumps) <= 4);

-- copia o bump antigo para a lista (só onde a lista ainda está vazia)
update public.products
   set bumps = jsonb_build_array(jsonb_build_object('product_id', bump_product_id, 'valor', bump_valor))
 where bump_product_id is not null and bump_valor is not null
   and jsonb_array_length(bumps) = 0;

-- 2) Itens extras no pedido
alter table public.orders add column if not exists bumps jsonb not null default '[]'::jsonb;

-- 3) Trava nos pedidos criados por usuário logado (API direta)
create or replace function public.pedido_insert_seguro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.status := 'pendente';
    new.conteudo_liberado := null;
    new.entregue_em := null;
    new.bump_conteudo := null;
    new.bump_arquivo_path := null;
    new.bump_arquivo_nome := null;
    new.bumps := '[]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_insert_seguro on public.orders;
create trigger orders_insert_seguro
  before insert on public.orders
  for each row execute function public.pedido_insert_seguro();

-- Conferência (só leitura): devem aparecer 2 colunas e 1 gatilho
select table_name, column_name from information_schema.columns
 where table_schema = 'public' and column_name = 'bumps' and table_name in ('products', 'orders');
select tgname from pg_trigger where tgname = 'orders_insert_seguro';

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists orders_insert_seguro on public.orders;
-- drop function if exists public.pedido_insert_seguro();
-- alter table public.orders drop column if exists bumps;
-- alter table public.products drop constraint if exists products_bumps_max4;
-- alter table public.products drop column if exists bumps;
-- ============================================================
