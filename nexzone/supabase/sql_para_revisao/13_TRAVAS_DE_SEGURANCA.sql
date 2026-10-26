-- ============================================================
-- Comprei Barato · 13 · Travas de segurança (varredura de 26/10/2026)
-- ============================================================
-- Fecha o que a varredura encontrou no banco de produção:
--  1) Pedidos: usuário logado ainda podia CRIAR pedido pela API do banco, escolhendo o total
--     (e pagar R$ 0,50 no cartão por qualquer produto). Agora só o servidor cria pedidos.
--  2) Saques: o lojista podia criar saque com QUALQUER valor (até negativo, inflando o saldo).
--     Agora só o servidor cria, valor sempre positivo e no máximo 1 saque em aberto por loja.
--  3) Destaques: o lojista podia criar destaque com dias/valor livres. Agora só o servidor cria.
--  4) Produtos: o lojista podia se aprovar (status 'ativo' sem revisão), se destacar de graça
--     (destaque_ate) e inventar vendas/nota. Agora essas colunas só mudam pelo admin/servidor.
--  5) Lojas: o lojista podia se marcar como 'verificado' / mudar o nível. Agora só o admin.
--  6) Avaliações: tinham de ser do produto do pedido, e uma por pedido.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Rode DEPOIS de subir o código desta entrega (o código novo cria saques e destaques pelo servidor).
-- Pode rodar mais de uma vez. Não apaga nem altera dados existentes.
-- O admin (perfil admin) e o servidor (service_role) continuam podendo tudo.

-- 1) Pedidos: só o servidor cria
drop policy if exists "pedido: comprador autenticado cria" on public.orders;
revoke insert on public.orders from anon, authenticated;
create unique index if not exists orders_gateway_ref_unico on public.orders(gateway_ref) where gateway_ref is not null;

-- 2) Saques: só o servidor cria; valor positivo; 1 saque em aberto por loja
drop policy if exists "saque: dono solicita" on public.payouts;
revoke insert on public.payouts from anon, authenticated;
alter table public.payouts drop constraint if exists payouts_valor_positivo;
alter table public.payouts add constraint payouts_valor_positivo check (valor > 0) not valid;
create unique index if not exists payouts_um_aberto_por_loja on public.payouts(store_id) where status = 'solicitado';

-- 3) Destaques: só o servidor cria
drop policy if exists "boost: dono cria" on public.boosts;
revoke insert on public.boosts from anon, authenticated;

-- 4) Produtos: colunas que só o admin/servidor muda
--    (o nome começa com "a_" para rodar ANTES dos outros gatilhos de products)
create or replace function public.proteger_campos_produto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  o jsonb;
  n jsonb := to_jsonb(new);
  c text;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'em_revisao';
    new.destaque_ate := null;
    new.vendas := 0;
    new.nota := 0;
    return new;
  end if;

  o := to_jsonb(old);
  -- status: o lojista só pode pausar ou mandar para revisão
  if new.status is distinct from old.status and new.status not in ('pausado', 'em_revisao') then
    raise exception 'Só a equipe do Comprei Barato aprova anúncios.' using errcode = '42501';
  end if;
  foreach c in array array['destaque_ate', 'vendas', 'nota', 'publicado_em', 'contadores_manuais',
                           'vendas_manual', 'avaliacoes_manual', 'nota_manual'] loop
    if (n ? c) and (n -> c) is distinct from (o -> c) then
      raise exception 'Campo % só pode ser alterado pela equipe do Comprei Barato.', c using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists a_proteger_campos_produto on public.products;
create trigger a_proteger_campos_produto
  before insert or update on public.products
  for each row execute function public.proteger_campos_produto();

-- 5) Lojas: verificação e nível só pelo admin
create or replace function public.proteger_campos_loja()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.nivel := 'novo';
    new.recipient_id := null;
    return new;
  end if;
  if new.status is distinct from old.status or new.nivel is distinct from old.nivel
     or new.recipient_id is distinct from old.recipient_id then
    raise exception 'Verificação, nível e conta de repasse da loja só mudam pela equipe do Comprei Barato.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists a_proteger_campos_loja on public.stores;
create trigger a_proteger_campos_loja
  before insert or update on public.stores
  for each row execute function public.proteger_campos_loja();

-- 6) Avaliações: do produto comprado, uma por pedido
drop policy if exists "review: comprador do pedido cria" on public.reviews;
create policy "review: comprador do pedido cria" on public.reviews
  for insert with check (
    comprador = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = reviews.order_id and o.comprador = auth.uid()
         and o.product_id = reviews.product_id
         and o.status in ('pago', 'entregue')
    )
  );
create unique index if not exists reviews_um_por_pedido on public.reviews(order_id);

-- Conferência (só leitura): deve listar 2 gatilhos e 3 índices
select tgname from pg_trigger where tgname in ('a_proteger_campos_produto', 'a_proteger_campos_loja');
select indexname from pg_indexes where indexname in ('orders_gateway_ref_unico', 'payouts_um_aberto_por_loja', 'reviews_um_por_pedido');

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists a_proteger_campos_produto on public.products;
-- drop trigger if exists a_proteger_campos_loja on public.stores;
-- drop function if exists public.proteger_campos_produto();
-- drop function if exists public.proteger_campos_loja();
-- grant insert on public.orders, public.payouts, public.boosts to authenticated;
-- create policy "pedido: comprador autenticado cria" on public.orders for insert with check (comprador = auth.uid());
-- create policy "saque: dono solicita" on public.payouts for insert with check (store_id in (select id from public.stores where owner = auth.uid()));
-- create policy "boost: dono cria" on public.boosts for insert with check (store_id in (select id from public.stores where owner = auth.uid()));
-- ============================================================
