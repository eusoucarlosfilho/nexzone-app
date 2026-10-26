-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 14 · Moderação de anúncios pelo admin
-- ============================================================
-- 1) Estado de moderação no anúncio: correção pedida / pausado pela equipe / cancelado,
--    com os itens a corrigir e a observação (o vendedor vê em Meus produtos).
-- 1b) Leitura das colunas novas pelo vendedor (o SQL 12 libera colunas uma a uma;
--     colunas criadas depois dele precisam ser liberadas aqui, senão o quadro "O que corrigir" não aparece)
--     (o grant fica logo depois da criação das colunas, no passo 1)

-- 2) Histórico de moderação (quem fez, quando, o quê).
-- 3) Trava: anúncio PAUSADO PELA EQUIPE ou CANCELADO não pode ter status nem conteúdo
--    mudados pelo vendedor (nem pelo site, nem direto pela API do banco).
--    O vendedor também não mexe nos campos de moderação.
--    Complementa o 13 (que já impede o vendedor de se aprovar).
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- O admin (perfil admin) e o servidor (service_role) continuam podendo tudo.

-- 1) Colunas no anúncio
alter table public.products add column if not exists moderacao text null;
alter table public.products add column if not exists moderacao_itens text[] not null default '{}';
alter table public.products add column if not exists moderacao_texto text null;
alter table public.products add column if not exists moderacao_em timestamptz null;

-- 1b) Leitura das colunas novas pelo vendedor
grant select (moderacao, moderacao_itens, moderacao_texto, moderacao_em) on public.products to anon, authenticated;

alter table public.products drop constraint if exists products_moderacao_valida;
alter table public.products add constraint products_moderacao_valida
  check (moderacao is null or moderacao in ('correcao', 'pausado_admin', 'cancelado'));

-- 2) Histórico
create table if not exists public.product_moderacao (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  admin_id uuid null,
  acao text not null,              -- correcao | pausar | cancelar | reativar | aprovar | reprovar
  itens text[] not null default '{}',
  texto text null,
  status_antes text null,
  status_depois text null,
  created_at timestamptz not null default now()
);
create index if not exists product_moderacao_produto_idx on public.product_moderacao(product_id, created_at desc);
alter table public.product_moderacao enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava

-- 3) Trava do vendedor
--    (o nome começa com "b_" para rodar logo depois do a_proteger_campos_produto do SQL 13)
create or replace function public.travar_moderacao_produto()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  c text;
  admin_ok boolean := false;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;   -- servidor (service_role)
  end if;
  begin
    admin_ok := public.is_admin();
  exception when others then
    admin_ok := false;
  end;
  if admin_ok then
    return new;
  end if;

  -- campos de moderação: só a equipe
  foreach c in array array['moderacao', 'moderacao_itens', 'moderacao_texto', 'moderacao_em'] loop
    if (n -> c) is distinct from (o -> c) then
      raise exception 'A moderação do anúncio só pode ser alterada pela equipe do Comprei Barato.' using errcode = '42501';
    end if;
  end loop;

  -- anúncio travado pela equipe: nada de status nem conteúdo
  if old.moderacao in ('pausado_admin', 'cancelado') then
    if new.status is distinct from old.status then
      raise exception 'Este anúncio foi % pela equipe do Comprei Barato. Fale com o suporte.',
        case when old.moderacao = 'cancelado' then 'cancelado' else 'pausado' end using errcode = '42501';
    end if;
    foreach c in array array['titulo','descricao','categoria','preco','preco_promo','tipo_entrega',
                             'conteudo_entrega','garantia_dias','arquivo_path','arquivo_nome','imagens','capa_url'] loop
      if (n ? c) and (n -> c) is distinct from (o -> c) then
        raise exception 'Este anúncio está travado pela equipe do Comprei Barato. Fale com o suporte.' using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists b_travar_moderacao_produto on public.products;
create trigger b_travar_moderacao_produto
  before update on public.products
  for each row execute function public.travar_moderacao_produto();

-- 3b) Anúncio travado também não pode ser excluído pelo vendedor (apagaria o histórico)
create or replace function public.travar_exclusao_moderada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admin_ok boolean := false;
begin
  if current_user not in ('authenticated', 'anon') then
    return old;
  end if;
  begin
    admin_ok := public.is_admin();
  exception when others then
    admin_ok := false;
  end;
  if not admin_ok and old.moderacao in ('pausado_admin', 'cancelado') then
    raise exception 'Este anúncio está travado pela equipe do Comprei Barato e não pode ser excluído.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists b_travar_exclusao_moderada on public.products;
create trigger b_travar_exclusao_moderada
  before delete on public.products
  for each row execute function public.travar_exclusao_moderada();

-- 4) Conferência (só leitura): deve listar o gatilho e as 4 colunas
select tgname from pg_trigger where tgname in ('b_travar_moderacao_produto', 'b_travar_exclusao_moderada');
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'products' and column_name like 'moderacao%' order by 1;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists b_travar_moderacao_produto on public.products;
-- drop trigger if exists b_travar_exclusao_moderada on public.products;
-- drop function if exists public.travar_exclusao_moderada();
-- drop function if exists public.travar_moderacao_produto();
-- drop table if exists public.product_moderacao;
-- alter table public.products drop constraint if exists products_moderacao_valida;
-- alter table public.products drop column if exists moderacao_em;
-- alter table public.products drop column if exists moderacao_texto;
-- alter table public.products drop column if exists moderacao_itens;
-- alter table public.products drop column if exists moderacao;
-- ============================================================
