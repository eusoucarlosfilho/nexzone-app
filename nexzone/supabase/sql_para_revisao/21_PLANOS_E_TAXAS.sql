-- ============================================================
-- SQL 21 — Novo modelo do marketplace: planos por anúncio, taxa de serviço do comprador,
--          tipo de anúncio/jogo, liberação por tipo e taxa de saque extra.
-- ------------------------------------------------------------
-- RODE ESTE SQL ANTES de subir o código desta entrega (o site novo lê estas colunas).
-- Pode rodar mais de uma vez. Não altera valores de pedidos já feitos.
--
-- O que faz:
--   1) products: tipo_anuncio (conta, item, moeda, giftcard, servico, digital), jogo e plano (basico, destaque, topo)
--   2) orders: plano e % do vendedor usados na venda + taxa de serviço do comprador (Pix e cartão)
--   3) payouts: taxa_saque (R$ 0,99 nos saques além do grátis da semana)
--   4) settings: os números do modelo (o admin muda depois em Configurações)
--   5) trava de vagas do plano Topo por categoria
--   6) o gatilho de revisão passa a considerar tipo e jogo (mudar o PLANO não volta para revisão)
--   7) libera a leitura pública das colunas novas de products (mesma regra do SQL 12)
-- ============================================================

-- 1) Anúncios
alter table public.products add column if not exists tipo_anuncio text not null default 'digital';
alter table public.products add column if not exists jogo text;
alter table public.products add column if not exists plano text not null default 'basico';
do $$ begin
  alter table public.products add constraint products_tipo_anuncio_ck check (tipo_anuncio in ('conta','item','moeda','giftcard','servico','digital')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_plano_ck check (plano in ('basico','destaque','topo')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_jogo_ck check (jogo is null or char_length(jogo) <= 60) not valid;
exception when duplicate_object then null; end $$;
create index if not exists products_vitrine_plano_idx on public.products (status, plano, vendas desc);
create index if not exists products_jogo_idx on public.products (jogo) where jogo is not null;

-- 2) Pedidos
alter table public.orders add column if not exists plano text;
alter table public.orders add column if not exists pct_vendedor numeric(5,2);
alter table public.orders add column if not exists taxa_comprador_pix numeric(10,2) not null default 0;
alter table public.orders add column if not exists taxa_comprador_cartao numeric(10,2) not null default 0;

-- 3) Saques
alter table public.payouts add column if not exists taxa_saque numeric(10,2) not null default 0;
do $$ begin
  alter table public.payouts add constraint payouts_taxa_saque_ck check (taxa_saque >= 0 and taxa_saque <= 20) not valid;
exception when duplicate_object then null; end $$;

-- 4) Números do modelo (só cria se ainda não existirem)
do $$
declare
  jsonb_col boolean := (select data_type = 'jsonb' from information_schema.columns
                          where table_schema = 'public' and table_name = 'settings' and column_name = 'value');
  par record;
begin
  for par in select * from (values
      ('plano_basico_pct', '5'), ('plano_destaque_pct', '8'), ('plano_topo_pct', '11'),
      ('planos_pagos_ativos', 'false'), ('topo_vagas_categoria', '3'),
      ('taxa_comprador_pix', '0.5'), ('taxa_comprador_cartao_pct', '5.99'), ('taxa_comprador_cartao_fixo', '0.49'),
      ('liberacao_conta_dias', '7'), ('liberacao_padrao_dias', '3'), ('liberacao_cartao_dias', '14'),
      ('saque_extra_taxa', '0.99')
    ) as t(k, v)
  loop
    if jsonb_col then
      execute format('insert into public.settings(key, value) values (%L, %L::jsonb) on conflict (key) do nothing', par.k, par.v);
    else
      execute format('insert into public.settings(key, value) values (%L, %L) on conflict (key) do nothing', par.k, par.v);
    end if;
  end loop;
end $$;

-- 5) Vagas do Topo: no máximo N anúncios ATIVOS em Topo por categoria (N em settings; padrão 3)
create or replace function public.travar_vagas_topo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vagas int := 3;
  ocupadas int;
begin
  if new.plano is distinct from 'topo' or (tg_op = 'UPDATE' and old.plano = 'topo' and old.categoria is not distinct from new.categoria) then
    return new;
  end if;
  begin
    select coalesce(nullif(regexp_replace(value::text, '[^0-9]', '', 'g'), '')::int, 3) into vagas
      from public.settings where key = 'topo_vagas_categoria';
  exception when others then vagas := 3;
  end;
  select count(*) into ocupadas from public.products
   where plano = 'topo' and status = 'ativo' and categoria is not distinct from new.categoria and id <> new.id;
  if ocupadas >= coalesce(vagas, 3) then
    raise exception 'topo_sem_vaga' using hint = 'As vagas do plano Topo desta categoria estão ocupadas.';
  end if;
  return new;
end;
$$;
revoke all on function public.travar_vagas_topo() from public, anon, authenticated;
drop trigger if exists products_travar_vagas_topo on public.products;
create trigger products_travar_vagas_topo
  before insert or update of plano, categoria on public.products
  for each row execute function public.travar_vagas_topo();

-- 6) Revisão do anúncio: tipo e jogo também contam como edição (o plano NÃO conta)
create or replace function public.registrar_edicao_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campos text[] := array['titulo','descricao','categoria','preco','preco_promo','tipo_entrega',
                         'conteudo_entrega','garantia_dias','arquivo_path','arquivo_nome','imagens','capa_url','emoji',
                         'tipo_anuncio','jogo'];
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
    raise warning 'registrar_edicao_produto ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 7) Leitura pública das colunas novas (repete a regra do SQL 12: tudo menos o conteúdo de entrega)
do $$
declare
  colunas text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into colunas
    from information_schema.columns
   where table_schema = 'public' and table_name = 'products'
     and column_name not in ('conteudo_entrega', 'arquivo_path', 'arquivo_nome');
  execute 'revoke select on public.products from anon, authenticated';
  execute format('grant select (%s) on public.products to anon, authenticated', colunas);
end $$;

-- ------------------------------------------------------------
-- Conferência (rode depois; tudo deve vir "true")
-- ------------------------------------------------------------
-- select
--   exists (select 1 from information_schema.columns where table_name='products' and column_name='plano') as plano,
--   exists (select 1 from information_schema.columns where table_name='orders' and column_name='taxa_comprador_pix') as taxa_comprador,
--   exists (select 1 from information_schema.columns where table_name='payouts' and column_name='taxa_saque') as taxa_saque,
--   (select count(*) = 12 from public.settings where key in ('plano_basico_pct','plano_destaque_pct','plano_topo_pct','planos_pagos_ativos','topo_vagas_categoria','taxa_comprador_pix','taxa_comprador_cartao_pct','taxa_comprador_cartao_fixo','liberacao_conta_dias','liberacao_padrao_dias','liberacao_cartao_dias','saque_extra_taxa')) as numeros,
--   has_column_privilege('anon', 'public.products', 'plano', 'select') as leitura_publica;

-- ------------------------------------------------------------
-- Para desfazer (só se precisar; as colunas podem ficar, o código antigo ignora):
-- drop trigger if exists products_travar_vagas_topo on public.products;
-- drop function if exists public.travar_vagas_topo();
-- ------------------------------------------------------------
