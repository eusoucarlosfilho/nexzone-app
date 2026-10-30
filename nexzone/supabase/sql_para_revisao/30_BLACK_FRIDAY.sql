-- ============================================================
-- SQL 30 — Black Friday Gamer (lista de espera + inscrição dos vendedores)
-- ------------------------------------------------------------
-- O que faz:
--   1) Cria a tabela lista_espera: quem pede para ser avisado em /black-friday.
--   2) Cria a tabela campanha_produtos: os produtos que os vendedores inscreveram
--      com o preço da campanha (Minha loja › Black Friday).
--      A rotina de 1 em 1 minuto (/api/cron/eventos) coloca o preço no ar no início
--      e devolve a promoção anterior no fim.
-- Só o servidor lê e grava (service_role). Ninguém de fora consegue listar e-mails ou inscrições.
-- Pode rodar mais de uma vez sem problema.
-- Não mexe em pedidos, pagamentos, saldos nem em nenhuma tabela existente.
-- ============================================================

create table if not exists public.lista_espera (
  id              bigint generated always as identity primary key,
  campanha        text not null check (char_length(campanha) between 3 and 60),
  email           text not null check (char_length(email) between 5 and 200),
  nome            text check (nome is null or char_length(nome) <= 80),
  whatsapp        text check (whatsapp is null or whatsapp ~ '^[0-9]{1,13}$'),
  aceita_whatsapp boolean not null default false,
  origem          jsonb,                       -- utm_source, utm_campaign, página de entrada
  avisado_em      timestamptz,                 -- quando recebeu o e-mail "começou"
  created_at      timestamptz not null default now(),
  unique (campanha, email)
);
create index if not exists lista_espera_aviso_idx on public.lista_espera (campanha, avisado_em);

alter table public.lista_espera enable row level security;
-- sem políticas: só o service_role (servidor) acessa
revoke all on public.lista_espera from anon, authenticated;

create table if not exists public.campanha_produtos (
  id              bigint generated always as identity primary key,
  campanha        text not null check (char_length(campanha) between 3 and 60),
  product_id      uuid not null references public.products(id) on delete cascade,
  store_id        uuid not null references public.stores(id) on delete cascade,
  preco_campanha  numeric(12,2) not null check (preco_campanha >= 1),
  preco_ref       numeric(12,2) not null check (preco_ref > 0),   -- preço de hoje na 1ª inscrição (trava o desconto real)
  promo_anterior  numeric(12,2),                                   -- promoção que o produto tinha antes de a campanha entrar no ar
  aplicado_em     timestamptz,                                     -- quando o preço da campanha entrou no ar
  restaurado_em   timestamptz,                                     -- quando voltou ao preço anterior
  created_at      timestamptz not null default now(),
  unique (campanha, product_id),
  check (preco_campanha < preco_ref)
);
create index if not exists campanha_produtos_loja_idx on public.campanha_produtos (campanha, store_id);
create index if not exists campanha_produtos_aplicar_idx on public.campanha_produtos (campanha) where aplicado_em is null;
create index if not exists campanha_produtos_restaurar_idx on public.campanha_produtos (campanha) where aplicado_em is not null and restaurado_em is null;

alter table public.campanha_produtos enable row level security;
-- sem políticas: só o service_role (servidor) acessa
revoke all on public.campanha_produtos from anon, authenticated;

-- Conferência (só leitura): as duas tabelas devem aparecer com rls = true
select c.relname as tabela, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('lista_espera', 'campanha_produtos');
