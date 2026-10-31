-- ============================================================
-- SQL 35 — Análise automática dos anúncios (e aprovação automática de baixo risco)
-- Rodar no projeto de TESTES primeiro, depois no de produção.
-- Só ACRESCENTA duas colunas em products. Não altera nem apaga nada que já existe.
-- Quem grava é só o servidor do site (service_role).
-- O gatilho abaixo descarta qualquer mudança nessas colunas feita por quem não é o servidor.
-- ============================================================
alter table public.products add column if not exists analise jsonb;
alter table public.products add column if not exists analise_em timestamptz;
create index if not exists products_analise_em_idx on public.products (analise_em desc) where analise is not null;

-- O vendedor edita o próprio anúncio pelo site; aqui garantimos que ele não mexe na análise (nem a apaga).
create or replace function public.protege_analise_produto() returns trigger
language plpgsql set search_path = public as $$
begin
  -- service_role = servidor do site; postgres/supabase_admin = editor de SQL do Supabase
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.analise := old.analise;
    new.analise_em := old.analise_em;
  end if;
  return new;
end $$;
drop trigger if exists protege_analise_produto on public.products;
create trigger protege_analise_produto before update on public.products
  for each row execute function public.protege_analise_produto();

-- Conferência:
-- select column_name from information_schema.columns where table_name = 'products' and column_name like 'analise%';
