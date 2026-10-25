-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Produtos externos no catálogo (amplia as Ofertas Parceiras)
-- ============================================================
-- 05 · Novas plataformas (Mercado Livre, Shopee, Amazon, Magalu, AliExpress) + preço "de"
--
-- Requer o script 01 (tabela public.partner_offers) já aplicado.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera ofertas existentes.
-- Rode ANTES de subir o código novo: o código novo lê a coluna price_from.

-- 1) Preço "de" (opcional, para mostrar desconto)
alter table public.partner_offers
  add column if not exists price_from numeric(12,2) null;

alter table public.partner_offers drop constraint if exists partner_offers_price_from_check;
alter table public.partner_offers add constraint partner_offers_price_from_check
  check (price_from is null or (price_from > 0 and price_from <= 1000000 and (price_reference is null or price_from > price_reference)));

-- 2) Lista de plataformas aceitas
alter table public.partner_offers drop constraint if exists partner_offers_external_platform_check;
alter table public.partner_offers add constraint partner_offers_external_platform_check
  check (external_platform in (
    'mercadolivre','shopee','amazon','magalu','aliexpress',
    'hotmart','kiwify','monetizze','eduzz','braip','direto','outra'
  ));

-- 3) O público (visitantes) pode ler o preço "de", como as demais colunas da vitrine
grant select (price_from) on public.partner_offers to anon, authenticated;

-- Conferência (somente leitura): deve listar price_from
select column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'partner_offers' and grantee = 'anon' and column_name = 'price_from';

-- Reverter (só se nenhuma oferta usar as plataformas novas):
-- alter table public.partner_offers drop constraint if exists partner_offers_price_from_check;
-- alter table public.partner_offers drop column if exists price_from;
