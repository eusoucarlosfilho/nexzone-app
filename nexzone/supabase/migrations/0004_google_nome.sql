-- =====================================================================
-- 0004 — Nome do usuário que entra pelo Google
-- O Google envia o nome em raw_user_meta_data->>'full_name' / 'name';
-- o cadastro por e-mail continua enviando 'nome'.
--
-- Só substitui a FUNÇÃO (create or replace). O trigger on_auth_user_created
-- não é recriado e continua apontando para ela.
-- Todo o resto é idêntico a 0001_init.sql: mesmas colunas, papel fixo
-- 'comprador', security definer, search_path = public e on conflict.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nome', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      ''
    ),
    'comprador'
  )
  on conflict (id) do nothing;
  return new;
end; $$;
