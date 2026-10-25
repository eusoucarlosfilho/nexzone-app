-- =====================================================================
-- 0006 — Galeria de fotos do produto
-- Rodar no SQL Editor do Supabase, o script inteiro de uma vez, ANTES do deploy
-- do código (o cadastro de produto passa a gravar a coluna imagens).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- imagens: lista de URLs (em ordem). capa_url continua existindo e é SEMPRE
-- a 1ª foto da galeria — cards, SEO e checkout seguem lendo capa_url.
-- Produtos antigos ficam com imagens = [] e o site usa [capa_url] no lugar.
-- =====================================================================
begin;
set local lock_timeout = '5s';

alter table public.products
  add column if not exists imagens jsonb not null default '[]'::jsonb;

-- só lista, no máximo 8 itens, todos texto
alter table public.products drop constraint if exists products_imagens_check;
alter table public.products add constraint products_imagens_check check (
  jsonb_typeof(imagens) = 'array'
  and jsonb_array_length(imagens) <= 8
  and not jsonb_path_exists(imagens, '$[*] ? (@.type() != "string")')
);

-- Garante no banco que a capa é sempre a 1ª foto (mesmo se algum código esquecer).
-- Galeria vazia: não mexe em capa_url (produtos antigos continuam com a capa que têm).
create or replace function public.products_capa_da_galeria()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(new.imagens) = 'array' and jsonb_array_length(new.imagens) > 0 then
    new.capa_url := new.imagens ->> 0;
  end if;
  return new;
end;
$$;

drop trigger if exists products_capa_da_galeria on public.products;
create trigger products_capa_da_galeria
  before insert or update of imagens, capa_url on public.products
  for each row
  execute function public.products_capa_da_galeria();

commit;
