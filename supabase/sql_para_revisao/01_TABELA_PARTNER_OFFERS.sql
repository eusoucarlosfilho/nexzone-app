-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Ofertas Parceiras · pacote V3 (candidato)
-- Nenhum destes scripts foi executado em nenhum banco.
-- ============================================================
-- 01 · Tabela de ofertas parceiras (OBRIGATÓRIO para a vitrine híbrida funcionar)
-- Tabela SEPARADA de products: nenhuma ligação com pedidos, saldo, comissões ou CB Points.
-- Leitura pública só das ofertas ativas e só das colunas de vitrine (links e notas internas ficam no servidor).
-- Escrita: só o servidor (service role), depois da checagem adminSeguro no código.

create table if not exists public.partner_offers (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 140),
  slug                  text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  description           text null check (char_length(description) <= 5000),
  short_description     text null check (char_length(short_description) <= 200),
  image_url             text null check (image_url is null or (image_url like 'https://%' and char_length(image_url) <= 2048)),
  category              text not null check (char_length(category) <= 80),
  tags                  text[] not null default '{}' check (cardinality(tags) <= 10),
  external_platform     text not null check (external_platform in ('hotmart','kiwify','monetizze','eduzz','braip','direto','outra')),
  external_product_url  text not null check (external_product_url like 'https://%' and char_length(external_product_url) <= 2048),
  affiliate_url         text null check (affiliate_url is null or (affiliate_url like 'https://%' and char_length(affiliate_url) <= 2048)),
  price_reference       numeric(12,2) null check (price_reference is null or (price_reference >= 0 and price_reference <= 1000000)),
  currency              text not null default 'BRL' check (currency in ('BRL','USD','EUR')),
  producer_name         text null check (char_length(producer_name) <= 120),
  authorization_note    text null check (char_length(authorization_note) <= 500),   -- interno: origem/autorização
  status                text not null default 'rascunho' check (status in ('rascunho','ativo','pausado','arquivado')),
  featured              boolean not null default false,
  priority              int not null default 0 check (priority between 0 and 1000),
  last_verified_at      timestamptz null,
  created_by            uuid null references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- Cliques NÃO ficam numa coluna editável: são eventos na tabela do script 02.

create index if not exists partner_offers_vitrine_idx
  on public.partner_offers (status, featured desc, priority desc, created_at desc);
create index if not exists partner_offers_categoria_idx
  on public.partner_offers (status, category);
create index if not exists partner_offers_produto_url_idx
  on public.partner_offers (external_product_url);

-- updated_at automático
create or replace function public.partner_offers_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists partner_offers_touch on public.partner_offers;
create trigger partner_offers_touch before update on public.partner_offers
  for each row execute function public.partner_offers_touch();

-- Segurança
alter table public.partner_offers enable row level security;

drop policy if exists "ofertas parceiras: público vê só as ativas" on public.partner_offers;
create policy "ofertas parceiras: público vê só as ativas" on public.partner_offers
  for select to anon, authenticated using (status = 'ativo');
-- Sem políticas de insert/update/delete: anon e authenticated não gravam.

-- Colunas visíveis ao público (o resto só pelo servidor)
revoke all on public.partner_offers from anon, authenticated;
grant select (id, title, slug, description, short_description, image_url, category, tags, external_platform,
              price_reference, currency, producer_name, featured, priority, last_verified_at, created_at, status)
  on public.partner_offers to anon, authenticated;

-- Reverter:
-- drop table if exists public.partner_offers;
-- drop function if exists public.partner_offers_touch();
