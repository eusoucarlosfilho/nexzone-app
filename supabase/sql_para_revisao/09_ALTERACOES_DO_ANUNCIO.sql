-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Registro automático das alterações do anúncio
-- ============================================================
-- 09 · Toda vez que um anúncio muda (título, descrição, preço, fotos, entrega, arquivo…),
--      o banco guarda o ANTES e o DEPOIS de cada campo. A Fila de Aprovação mostra a lista.
--
--      Também fecha uma brecha: se o VENDEDOR alterar um anúncio por fora do site
--      (direto pela API do banco), o anúncio volta para revisão do mesmo jeito.
--      Admin e o servidor (service_role) não são afetados.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- Não depende do 07 nem do 08. Nunca bloqueia a edição: se o registro falhar, a edição segue.

-- 1) Tabela do histórico
create table if not exists public.product_edicoes (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  autor uuid null,                       -- quem editou (null = servidor)
  tipo text not null default 'edicao',   -- 'edicao' | 'reativacao'
  alteracoes jsonb not null default '{}'::jsonb,  -- { campo: { "antes": ..., "depois": ... } }
  status_antes text null,
  created_at timestamptz not null default now(),
  revisado_em timestamptz null,
  revisado_por uuid null,
  decisao text null                      -- 'aprovado' | 'reprovado'
);
create index if not exists product_edicoes_pendentes_idx
  on public.product_edicoes(product_id, created_at) where revisado_em is null;
alter table public.product_edicoes enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava

-- 2) Gatilho: compara o antes e o depois dos campos do anúncio
create or replace function public.registrar_edicao_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campos text[] := array['titulo','descricao','categoria','preco','preco_promo','tipo_entrega',
                         'conteudo_entrega','garantia_dias','arquivo_path','arquivo_nome','imagens','capa_url','emoji'];
  c text;
  a jsonb := to_jsonb(old);
  d jsonb := to_jsonb(new);
  mudou jsonb := '{}'::jsonb;
  quem uuid := auth.uid();
  eh_admin boolean := false;
begin
  foreach c in array campos loop
    if (a -> c) is distinct from (d -> c) then
      mudou := mudou || jsonb_build_object(c, jsonb_build_object('antes', a -> c, 'depois', d -> c));
    end if;
  end loop;

  -- Vendedor (usuário logado, não admin) mexeu no anúncio: volta para revisão, venha de onde vier
  if mudou <> '{}'::jsonb and quem is not null then
    begin
      eh_admin := public.is_admin();
    exception when others then
      eh_admin := false;
    end;
    if not eh_admin and new.status in ('ativo', 'pausado', 'reprovado') then
      new.status := 'em_revisao';
    end if;
  end if;

  begin
    if mudou <> '{}'::jsonb then
      insert into public.product_edicoes(product_id, autor, tipo, alteracoes, status_antes)
      values (new.id, quem, 'edicao', mudou, old.status);
    elsif old.status in ('pausado', 'reprovado') and new.status = 'em_revisao' then
      insert into public.product_edicoes(product_id, autor, tipo, alteracoes, status_antes)
      values (new.id, quem, 'reativacao', '{}'::jsonb, old.status);
    end if;
  exception when others then
    raise warning 'registrar_edicao_produto ignorado: %', sqlerrm;  -- nunca trava a edição
  end;
  return new;
end;
$$;

drop trigger if exists products_registrar_edicao on public.products;
create trigger products_registrar_edicao
  before update on public.products
  for each row execute function public.registrar_edicao_produto();

-- 3) Conferência (só leitura)
select tgname, tgenabled from pg_trigger where tgname = 'products_registrar_edicao';

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists products_registrar_edicao on public.products;
-- drop function if exists public.registrar_edicao_produto();
-- drop table if exists public.product_edicoes;
-- ============================================================
