-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Mensagem pós-compra padrão da loja
-- ============================================================
-- 10 · Guarda a MENSAGEM PADRÃO de cada loja e marca quais anúncios usam essa mensagem.
--      A mensagem (padrão ou personalizada) continua indo no campo de entrega do anúncio,
--      então checkout, webhooks e fulfill.ts não mudam.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- Todos os anúncios atuais ficam como "personalizada" (nada muda até o vendedor escolher a padrão).

alter table public.stores add column if not exists mensagem_pos_compra text null;
alter table public.stores drop constraint if exists stores_mensagem_pos_compra_tam;
alter table public.stores add constraint stores_mensagem_pos_compra_tam
  check (mensagem_pos_compra is null or length(mensagem_pos_compra) <= 4000);

alter table public.products add column if not exists usa_mensagem_padrao boolean not null default false;

-- Conferência (só leitura)
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'stores' and column_name = 'mensagem_pos_compra')
     or (table_name = 'products' and column_name = 'usa_mensagem_padrao'));

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- alter table public.products drop column if exists usa_mensagem_padrao;
-- alter table public.stores drop constraint if exists stores_mensagem_pos_compra_tam;
-- alter table public.stores drop column if exists mensagem_pos_compra;
-- ============================================================
