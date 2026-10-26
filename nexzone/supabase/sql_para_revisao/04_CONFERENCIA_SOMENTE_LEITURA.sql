-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Ofertas Parceiras · pacote V3 (candidato)
-- Nenhum destes scripts foi executado em nenhum banco.
-- ============================================================
-- 04 · Conferência depois de aplicar 01 e 02 (SOMENTE LEITURA)

-- As tabelas existem e estão com RLS ligado?
select relname as tabela, relrowsecurity as rls_ligado
from pg_class
where relnamespace = 'public'::regnamespace and relname in ('partner_offers', 'partner_offer_clicks');

-- Políticas criadas
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('partner_offers', 'partner_offer_clicks');

-- Colunas que o público (anon) pode ler: NÃO deve aparecer affiliate_url, external_product_url,
-- authorization_note nem created_by
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'partner_offers' and grantee = 'anon' and privilege_type = 'SELECT'
order by column_name;

-- Quantidade por situação
select status, count(*) from public.partner_offers group by status order by status;
