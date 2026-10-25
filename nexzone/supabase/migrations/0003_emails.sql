-- =====================================================================
-- 0003 — E-mails transacionais e promoções (LGPD)
-- Rodar no SQL Editor do Supabase, o script inteiro de uma vez.
-- Idempotente: pode rodar de novo sem duplicar nada.
-- =====================================================================
begin;
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1) Consentimento de marketing em profiles
--    email_marketing: false por padrão (opt-in explícito, exigência da LGPD)
--    marketing_token: identificador secreto do link "Não quero mais receber"
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists email_marketing boolean not null default false,
  add column if not exists email_marketing_em timestamptz,
  add column if not exists marketing_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_marketing_token_key on public.profiles (marketing_token);
create index if not exists profiles_email_marketing_idx on public.profiles (email_marketing) where email_marketing;

-- O próprio usuário pode ligar/desligar email_marketing (política de UPDATE já existente),
-- mas NUNCA trocar o marketing_token pelo navegador.
create or replace function public.profiles_protege_marketing_token()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.marketing_token is distinct from old.marketing_token then
      raise exception 'marketing_token não pode ser alterado' using errcode = '42501';
    end if;
    -- registra quando o consentimento mudou (prova de opt-in/opt-out)
    if new.email_marketing is distinct from old.email_marketing then
      new.email_marketing_em := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protege_marketing_token on public.profiles;
create trigger profiles_protege_marketing_token
  before update on public.profiles
  for each row
  execute function public.profiles_protege_marketing_token();

-- ---------------------------------------------------------------------
-- 2) Registro de envios (conta a cota do Resend: 100/dia, 3.000/mês no grátis)
--    Só o servidor (service_role) lê e grava: RLS ligado e nenhuma política.
-- ---------------------------------------------------------------------
create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  tipo        text not null,                 -- compra_aprovada, nova_venda, nova_mensagem, escalonamento, promocao, promocao_teste
  qtd         integer not null default 1 check (qtd >= 0),
  status      text not null check (status in ('enviado', 'falha', 'sem_config')),
  assunto     text,
  detalhe     text,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- Soma da cota usada no dia e no mês (calendário UTC, como o Resend conta)
create or replace function public.email_cota_usada()
returns table (hoje bigint, mes bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(sum(qtd) filter (where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0)::bigint,
    coalesce(sum(qtd), 0)::bigint
  from public.email_log
  where status in ('enviado', 'falha')
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;
revoke all on function public.email_cota_usada() from public, anon, authenticated;
grant execute on function public.email_cota_usada() to service_role;

-- ---------------------------------------------------------------------
-- 3) Anti-spam do chat: no máximo 1 e-mail a cada 15 min por pedido + destinatário
-- ---------------------------------------------------------------------
create table if not exists public.email_throttle (
  order_id       uuid not null references public.orders(id) on delete cascade,
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  last_email_at  timestamptz not null default now(),
  primary key (order_id, recipient_id)
);
alter table public.email_throttle enable row level security;
revoke all on public.email_throttle from anon, authenticated;

-- Reserva atômica do envio: devolve true só para UMA chamada a cada 15 min.
-- Duas mensagens simultâneas não geram dois e-mails.
create or replace function public.email_throttle_reservar(p_order uuid, p_recipient uuid, p_minutos int default 15)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_ok boolean;
begin
  insert into public.email_throttle as t (order_id, recipient_id, last_email_at)
  values (p_order, p_recipient, now())
  on conflict (order_id, recipient_id) do update
     set last_email_at = now()
   where t.last_email_at < now() - make_interval(mins => p_minutos)
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function public.email_throttle_reservar(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.email_throttle_reservar(uuid, uuid, int) to service_role;

commit;
