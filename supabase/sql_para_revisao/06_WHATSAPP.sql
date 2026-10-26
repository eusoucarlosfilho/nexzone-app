-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Avisos e promoções por WhatsApp
-- ============================================================
-- 06 · WhatsApp: número e consentimento no perfil + registro de envios + campanhas
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode rodar mais de uma vez. Só ACRESCENTA: não apaga nem altera dados existentes.
-- Rode ANTES de subir o código novo (sem isto o WhatsApp simplesmente não envia; o site segue normal).

-- 1) Perfil: número (55 + DDD + número) e preferências
alter table public.profiles add column if not exists whatsapp text null;
alter table public.profiles add column if not exists whatsapp_avisos boolean not null default true;
alter table public.profiles add column if not exists whatsapp_promocoes boolean not null default true;
alter table public.profiles add column if not exists whatsapp_atualizado_em timestamptz null;

alter table public.profiles drop constraint if exists profiles_whatsapp_formato;
alter table public.profiles add constraint profiles_whatsapp_formato
  check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$');

-- 2) Número informado no CADASTRO (vem nos metadados da conta) → copia para o perfil quando o perfil é criado.
--    Não mexe no gatilho de criação de perfil que já existe; só completa a linha.
create or replace function public.whatsapp_do_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  md jsonb;
begin
  if new.whatsapp is null then
    select raw_user_meta_data into md from auth.users where id = new.id;
    if md is not null and (md->>'whatsapp') ~ '^55[0-9]{10,11}$' then
      new.whatsapp := md->>'whatsapp';
      if (md->>'whatsapp_avisos') in ('true', 'false') then new.whatsapp_avisos := (md->>'whatsapp_avisos')::boolean; end if;
      if (md->>'whatsapp_promocoes') in ('true', 'false') then new.whatsapp_promocoes := (md->>'whatsapp_promocoes')::boolean; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists whatsapp_do_cadastro on public.profiles;
create trigger whatsapp_do_cadastro before insert on public.profiles
  for each row execute function public.whatsapp_do_cadastro();

-- Contas já criadas que tenham o número nos metadados (normalmente nenhuma)
update public.profiles p
   set whatsapp = u.raw_user_meta_data->>'whatsapp'
  from auth.users u
 where p.id = u.id and p.whatsapp is null
   and (u.raw_user_meta_data->>'whatsapp') ~ '^55[0-9]{10,11}$';

-- 3) Registro de envios (aba Torpedos enviados). Só o servidor lê e grava.
create table if not exists public.whatsapp_log (
  id          bigserial primary key,
  evento      text not null check (char_length(evento) <= 60),
  chave       text not null unique check (char_length(chave) <= 200),   -- trava de duplicidade
  user_id     uuid null references auth.users(id) on delete set null,
  destino     text not null check (destino ~ '^55[0-9]{10,11}$'),
  texto       text not null check (char_length(texto) <= 1200),
  status      text not null check (status in ('enviando','enviado','falhou','adiado')),
  erro        text null check (char_length(erro) <= 400),
  tentativas  int not null default 0,
  created_at  timestamptz not null default now(),
  enviado_em  timestamptz null
);
create index if not exists whatsapp_log_created_idx on public.whatsapp_log (created_at desc);
create index if not exists whatsapp_log_status_idx on public.whatsapp_log (status, created_at desc);
create index if not exists whatsapp_log_evento_idx on public.whatsapp_log (evento, created_at desc);
alter table public.whatsapp_log enable row level security;
revoke all on public.whatsapp_log from anon, authenticated;

-- 4) Campanhas de promoção e fila escalonada. Só o servidor lê e grava.
create table if not exists public.whatsapp_campanhas (
  id            bigserial primary key,
  titulo        text not null check (char_length(titulo) <= 80),
  mensagem      text not null check (char_length(mensagem) <= 900),
  publico       text not null check (publico in ('compradores','vendedores','todos','lista')),
  status        text not null default 'pausada' check (status in ('pausada','enviando','concluida','cancelada')),
  total         int not null default 0,
  criado_por    uuid null references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  concluida_em  timestamptz null
);
alter table public.whatsapp_campanhas enable row level security;
revoke all on public.whatsapp_campanhas from anon, authenticated;

create table if not exists public.whatsapp_fila (
  id           bigserial primary key,
  campanha_id  bigint not null references public.whatsapp_campanhas(id) on delete cascade,
  user_id      uuid null references auth.users(id) on delete set null,
  telefone     text not null check (telefone ~ '^55[0-9]{10,11}$'),
  status       text not null default 'pendente' check (status in ('pendente','enviando','enviado','falhou','pulado')),
  erro         text null check (char_length(erro) <= 400),
  enviado_em   timestamptz null,
  unique (campanha_id, telefone)
);
create index if not exists whatsapp_fila_pendentes_idx on public.whatsapp_fila (campanha_id, status, id);
alter table public.whatsapp_fila enable row level security;
revoke all on public.whatsapp_fila from anon, authenticated;

-- Conferência (somente leitura): deve listar as 4 colunas novas
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name like 'whatsapp%' order by column_name;

-- Reverter (apaga o histórico de WhatsApp; os perfis perdem só as colunas novas):
-- drop trigger if exists whatsapp_do_cadastro on public.profiles;
-- drop function if exists public.whatsapp_do_cadastro();
-- drop table if exists public.whatsapp_fila; drop table if exists public.whatsapp_campanhas; drop table if exists public.whatsapp_log;
-- alter table public.profiles drop constraint if exists profiles_whatsapp_formato;
-- alter table public.profiles drop column if exists whatsapp, drop column if exists whatsapp_avisos,
--   drop column if exists whatsapp_promocoes, drop column if exists whatsapp_atualizado_em;
