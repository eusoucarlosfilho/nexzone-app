-- ============================================================
-- Comprei Barato · 12 · Protege o conteúdo de entrega dos produtos (achado K1)
-- ============================================================
-- O problema: a leitura pública de products liberava TODAS as colunas pela API do banco.
-- Com a chave pública do site (que está no navegador), qualquer pessoa conseguia ler
-- conteudo_entrega (links e textos de entrega), arquivo_path e arquivo_nome de qualquer
-- produto ativo, ou seja, pegar o produto sem pagar.
--
-- A correção: visitantes e usuários logados continuam lendo todas as outras colunas,
-- mas NÃO essas três. Quem precisa delas (entrega após o pagamento, download,
-- edição do vendedor, admin) já lê pelo servidor (service_role), que não é afetado.
-- Gravar continua igual: o vendedor segue cadastrando e editando a entrega normalmente.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Rode DEPOIS de subir o código desta entrega no GitHub (o código antigo ainda lia essas colunas).
-- Pode rodar mais de uma vez.
--
-- IMPORTANTE para o futuro: coluna NOVA em products só fica visível para o site depois de
-- rodar este arquivo de novo (ele libera sozinho todas as colunas, menos as três protegidas).

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

-- Conferência (só leitura): as três colunas devem aparecer com "pode_ler = false"
select column_name,
       has_column_privilege('authenticated', 'public.products', column_name, 'select') as pode_ler
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products'
   and column_name in ('conteudo_entrega', 'arquivo_path', 'arquivo_nome', 'titulo', 'preco')
 order by column_name;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- grant select on public.products to anon, authenticated;
-- ============================================================
