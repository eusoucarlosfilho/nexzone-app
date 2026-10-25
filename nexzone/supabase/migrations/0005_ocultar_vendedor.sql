-- =====================================================================
-- 0005 — "Vender como Comprei Barato" (ocultar o vendedor no site público)
-- Rodar no SQL Editor do Supabase, o script inteiro de uma vez, ANTES do deploy
-- do código (o site passa a pedir a coluna stores.ocultar_vendedor).
-- Idempotente: pode rodar de novo sem duplicar nada.
--
-- Só o servidor (service_role, usado pela rota /api/admin/store-visibility)
-- liga/desliga. O vendedor não consegue mudar nem pelo painel nem chamando
-- o Supabase direto com a chave pública.
-- =====================================================================
begin;
set local lock_timeout = '5s';

alter table public.stores
  add column if not exists ocultar_vendedor boolean not null default false;

create or replace function public.stores_protege_ocultar_vendedor()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Bloqueia qualquer requisição da API pública (chave anon / usuário logado).
  -- service_role (rota do admin) e o SQL Editor do Supabase continuam podendo.
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     or current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' and new.ocultar_vendedor is distinct from old.ocultar_vendedor then
      raise exception 'ocultar_vendedor só pode ser alterado pelo admin' using errcode = '42501';
    end if;
    -- Ao criar a loja, o vendedor também não pode já nascer "como Comprei Barato".
    if tg_op = 'INSERT' and new.ocultar_vendedor then
      raise exception 'ocultar_vendedor só pode ser alterado pelo admin' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_protege_ocultar_vendedor on public.stores;
create trigger stores_protege_ocultar_vendedor
  before insert or update on public.stores
  for each row
  execute function public.stores_protege_ocultar_vendedor();

commit;
