-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 03 — Data real da primeira publicação de cada produto
-- ============================================================
-- Hoje não existe essa data: o painel mostra "aproximado" (criação de um produto hoje ativo).
-- Este script cria products.publicado_em, preenchida AUTOMATICAMENTE na primeira vez que o produto
-- fica com status 'ativo'. O valor não pode ser definido nem alterado pelo vendedor.
-- Produtos já publicados ficam com publicado_em vazio (não inventamos a data); o painel continua
-- usando a aproximação só para eles.
--
-- Não lê nem toca em conteudo_entrega/arquivo_path. Não altera status de nenhum produto.
-- Pode rodar mais de uma vez.

alter table public.products add column if not exists publicado_em timestamptz null;

create or replace function public.registrar_publicacao_produto()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.publicado_em := case when new.status = 'ativo' then now() else null end;
  else
    new.publicado_em := coalesce(old.publicado_em, case when new.status = 'ativo' and old.status is distinct from 'ativo' then now() end);
  end if;
  return new;
end; $$;

drop trigger if exists registrar_publicacao_produto on public.products;
create trigger registrar_publicacao_produto
  before insert or update on public.products
  for each row execute function public.registrar_publicacao_produto();

create index if not exists products_publicado_em_idx on public.products (publicado_em desc) where publicado_em is not null;
create index if not exists products_store_status_idx on public.products (store_id, status);

-- Conferência (somente leitura)
select count(*) filter (where publicado_em is not null) as com_data, count(*) filter (where status = 'ativo') as ativos from public.products;

-- Reverter:
-- drop trigger if exists registrar_publicacao_produto on public.products;
-- drop function if exists public.registrar_publicacao_produto();
-- alter table public.products drop column if exists publicado_em;
