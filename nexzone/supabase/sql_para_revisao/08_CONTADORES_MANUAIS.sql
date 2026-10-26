-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Vendas, avaliações e estrelas digitadas pelo admin
-- ============================================================
-- 08 · Modo manual por produto. Ligado: o site mostra os números que o admin digitou,
--      e as vendas/avaliações novas NÃO mexem neles. Desligado: volta ao automático.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- Todos os produtos começam no automático (nada muda até você ligar o manual em um produto).
-- Rode ANTES de subir o código novo. Não depende do 07.

-- 1) Colunas novas em products
alter table public.products add column if not exists contadores_manuais boolean not null default false;
alter table public.products add column if not exists vendas_manual int null;
alter table public.products add column if not exists avaliacoes_manual int null;
alter table public.products add column if not exists nota_manual numeric(2,1) null;

alter table public.products drop constraint if exists products_contadores_manuais_validos;
alter table public.products add constraint products_contadores_manuais_validos check (
  (vendas_manual is null or vendas_manual between 0 and 10000000)
  and (avaliacoes_manual is null or avaliacoes_manual between 0 and 10000000)
  and (nota_manual is null or nota_manual between 1 and 5)
);

-- 2) Com o modo manual ligado, os contadores do produto ficam presos ao que o admin digitou.
--    Assim cards, ordenação e "Mais vendido" usam o número manual, e a soma automática
--    (venda paga / nova avaliação) não altera o valor digitado.
create or replace function public.contadores_manuais_aplicar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contadores_manuais then
    if new.vendas_manual is not null then new.vendas := new.vendas_manual; end if;
    if new.nota_manual is not null then new.nota := new.nota_manual; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_contadores_manuais on public.products;
create trigger products_contadores_manuais
  before insert or update on public.products
  for each row execute function public.contadores_manuais_aplicar();

-- 3) Histórico: quem mudou, quando, de quanto para quanto
create table if not exists public.product_contadores_log (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  admin_id uuid not null,
  antes jsonb not null,
  depois jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists product_contadores_log_produto_idx on public.product_contadores_log(product_id, created_at desc);
alter table public.product_contadores_log enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava

-- 4) Conferência (só leitura)
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products'
   and column_name in ('contadores_manuais', 'vendas_manual', 'avaliacoes_manual', 'nota_manual')
 order by column_name;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists products_contadores_manuais on public.products;
-- drop function if exists public.contadores_manuais_aplicar();
-- drop table if exists public.product_contadores_log;
-- alter table public.products drop constraint if exists products_contadores_manuais_validos;
-- alter table public.products drop column if exists nota_manual;
-- alter table public.products drop column if exists avaliacoes_manual;
-- alter table public.products drop column if exists vendas_manual;
-- alter table public.products drop column if exists contadores_manuais;
-- ============================================================
