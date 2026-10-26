-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 02 — Localização DECLARADA, origem do cadastro e marco "vendedor desde"
-- ============================================================
-- Finalidade (LGPD — minimização):
--   uf/cidade/pais: estado e cidade que o PRÓPRIO usuário informou (opcional), para estatísticas agregadas
--     de onde vêm os clientes. Nada de endereço, GPS ou coordenadas.
--   localizacao_fonte: sempre 'declarada' (a aproximada por rede fica só em site_sessions, nunca aqui).
--   origem: UTM (source/medium/campaign/content), domínio de origem e página de entrada da 1ª visita.
--     Sem URL completa, sem parâmetros livres.
--   vendedor_desde: data em que o perfil virou vendedor (marco 2 da jornada). Só para mudanças futuras.
-- Nenhum cadastro antigo recebe dados inventados. O único preenchimento é copiar o que o próprio usuário
-- já declarou no cadastro V3 (metadados do Auth).
--
-- Depende de: nada. Recomendado aplicar depois do 01 (C1).
-- Pode rodar mais de uma vez.

alter table public.profiles add column if not exists uf text null;
alter table public.profiles add column if not exists cidade text null;
alter table public.profiles add column if not exists pais text null;
alter table public.profiles add column if not exists localizacao_fonte text null;
alter table public.profiles add column if not exists localizacao_em timestamptz null;
alter table public.profiles add column if not exists origem jsonb null;
alter table public.profiles add column if not exists vendedor_desde timestamptz null;

alter table public.profiles drop constraint if exists profiles_uf_check;
alter table public.profiles add constraint profiles_uf_check check (uf is null or uf ~ '^[A-Z]{2}$');
alter table public.profiles drop constraint if exists profiles_cidade_check;
alter table public.profiles add constraint profiles_cidade_check check (cidade is null or char_length(cidade) between 2 and 60);
alter table public.profiles drop constraint if exists profiles_pais_check;
alter table public.profiles add constraint profiles_pais_check check (pais is null or pais ~ '^[A-Z]{2}$');
alter table public.profiles drop constraint if exists profiles_localizacao_fonte_check;
alter table public.profiles add constraint profiles_localizacao_fonte_check check (localizacao_fonte is null or localizacao_fonte = 'declarada');
alter table public.profiles drop constraint if exists profiles_origem_check;
alter table public.profiles add constraint profiles_origem_check check (origem is null or (jsonb_typeof(origem) = 'object' and pg_column_size(origem) < 1200));

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_uf_idx on public.profiles (uf) where uf is not null;

-- Cadastro novo: copia nome (como antes) + localização declarada e origem dos metadados do cadastro.
-- Mantém tudo de 0004: papel fixo 'comprador', security definer, search_path, on conflict.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_uf text := upper(nullif(m->>'uf', ''));
  v_cidade text := nullif(btrim(m->>'cidade'), '');
  v_origem jsonb := case when jsonb_typeof(m->'origem') = 'object' and pg_column_size(m->'origem') < 1200 then m->'origem' else null end;
begin
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then v_uf := null; end if;
  if v_uf is null or v_cidade is null or char_length(v_cidade) not between 2 and 60 then v_cidade := null; end if;
  insert into public.profiles (id, nome, role, uf, cidade, pais, localizacao_fonte, localizacao_em, origem)
  values (
    new.id,
    coalesce(nullif(m->>'nome', ''), nullif(m->>'full_name', ''), nullif(m->>'name', ''), ''),
    'comprador',
    v_uf, v_cidade,
    case when v_uf is not null then 'BR' end,
    case when v_uf is not null then 'declarada' end,
    case when v_uf is not null then now() end,
    v_origem
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- Marco "vendedor desde": registra a primeira vez que o papel vira vendedor/ambos.
create or replace function public.registrar_vendedor_desde()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.vendedor_desde is null and new.role in ('vendedor', 'ambos') and old.role is distinct from new.role then
    new.vendedor_desde := now();
  end if;
  if old.vendedor_desde is not null then
    new.vendedor_desde := old.vendedor_desde; -- não pode ser alterado depois de registrado
  end if;
  return new;
end; $$;
drop trigger if exists registrar_vendedor_desde on public.profiles;
create trigger registrar_vendedor_desde
  before update on public.profiles
  for each row execute function public.registrar_vendedor_desde();

-- Copia o que o PRÓPRIO usuário já declarou no cadastro V3 (metadados do Auth). Não inventa nada.
update public.profiles p set
  uf = upper(u.raw_user_meta_data->>'uf'),
  cidade = case when char_length(btrim(coalesce(u.raw_user_meta_data->>'cidade', ''))) between 2 and 60 then btrim(u.raw_user_meta_data->>'cidade') end,
  pais = 'BR', localizacao_fonte = 'declarada', localizacao_em = coalesce(p.localizacao_em, now())
from auth.users u
where u.id = p.id and p.uf is null
  and upper(coalesce(u.raw_user_meta_data->>'uf', '')) ~ '^[A-Z]{2}$';

update public.profiles p set origem = u.raw_user_meta_data->'origem'
from auth.users u
where u.id = p.id and p.origem is null
  and jsonb_typeof(u.raw_user_meta_data->'origem') = 'object'
  and pg_column_size(u.raw_user_meta_data->'origem') < 1200;

-- Conferência (somente leitura)
select count(*) filter (where uf is not null) as com_uf, count(*) filter (where origem is not null) as com_origem, count(*) as total from public.profiles;

-- Reverter (perde os dados das colunas novas):
-- drop trigger if exists registrar_vendedor_desde on public.profiles;
-- drop function if exists public.registrar_vendedor_desde();
-- (e reaplicar supabase/migrations/0004_google_nome.sql para voltar o handle_new_user anterior)
-- alter table public.profiles drop column if exists uf, drop column if exists cidade, drop column if exists pais,
--   drop column if exists localizacao_fonte, drop column if exists localizacao_em, drop column if exists origem, drop column if exists vendedor_desde;
