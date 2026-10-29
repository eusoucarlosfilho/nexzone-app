-- ============================================================
-- SQL 22 — Notificação na tela do celular (Web Push), igual Hotmart quando cai uma venda
-- ------------------------------------------------------------
-- Pode rodar mais de uma vez. Rode ANTES de subir o código desta entrega.
--
-- O que faz:
--   1) push_inscricoes: cada celular/computador que ativou as notificações (só o servidor lê)
--   2) push_config: chaves do push (geradas sozinhas pelo site no 1º uso) e a senha interna do disparo
--   3) Quando entra uma notificação no sino (tabela notificacoes), o banco chama o site
--      (/api/push/disparar) e o site manda para a tela do celular de quem ativou.
--      Usa a extensão pg_net, que já vem no Supabase.
--   4) Avisos em massa (Admin › Avisos no sino) NÃO passam pelo gatilho: o próprio site manda em lote.
-- Não mexe em pedidos, pagamentos nem saldo.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- 1) Aparelhos inscritos
create table if not exists public.push_inscricoes (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  aparelho    text check (aparelho is null or char_length(aparelho) <= 200),
  criado_em   timestamptz not null default now(),
  ultimo_ok   timestamptz,
  falhas      int not null default 0
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes(user_id);
alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;
-- sem políticas: só o servidor (service_role) lê e grava

-- 2) Configuração privada
create table if not exists public.push_config (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

insert into public.push_config(chave, valor) values
  ('segredo_disparo', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('url_site', 'https://www.compreibarato.com.br')
on conflict (chave) do nothing;

-- 3) Gatilho: notificação nova (ou agrupada que voltou ao topo) → site manda o push
create or replace function public.push_ao_notificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
begin
  begin
    if new.envio_id is not null then return new; end if;            -- aviso em massa: o site manda em lote
    if new.lida_em is not null then return new; end if;
    if tg_op = 'UPDATE' and old.created_at is not distinct from new.created_at then return new; end if;
    if not exists (select 1 from public.push_inscricoes where user_id = new.user_id) then return new; end if;
    select valor into v_url from public.push_config where chave = 'url_site';
    select valor into v_segredo from public.push_config where chave = 'segredo_disparo';
    if v_url is null or v_segredo is null then return new; end if;
    perform net.http_post(
      url := rtrim(v_url, '/') || '/api/push/disparar',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-segredo', v_segredo),
      timeout_milliseconds := 8000
    );
  exception when others then
    raise warning 'push_ao_notificar ignorado: %', sqlerrm;   -- push nunca trava o sino
  end;
  return new;
end;
$$;
revoke all on function public.push_ao_notificar() from public, anon, authenticated;

drop trigger if exists notificacoes_push on public.notificacoes;
create trigger notificacoes_push
  after insert or update of created_at on public.notificacoes
  for each row execute function public.push_ao_notificar();

-- 4) Para os avisos em massa: só os aparelhos de quem recebeu aquele envio
create or replace function public.push_destinos_envio(p_envio bigint)
returns table (id bigint, user_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.user_id, i.endpoint, i.p256dh, i.auth
    from public.push_inscricoes i
   where exists (select 1 from public.notificacoes n where n.envio_id = p_envio and n.user_id = i.user_id)
$$;
revoke all on function public.push_destinos_envio(bigint) from public, anon, authenticated;
grant execute on function public.push_destinos_envio(bigint) to service_role;

-- 5) Aparelho que falha 5 vezes seguidas é removido (o site chama depois de cada envio)
create or replace function public.push_falha(p_ids bigint[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_inscricoes set falhas = falhas + 1 where id = any(p_ids);
  delete from public.push_inscricoes where id = any(p_ids) and falhas >= 5;
$$;
revoke all on function public.push_falha(bigint[]) from public, anon, authenticated;
grant execute on function public.push_falha(bigint[]) to service_role;

-- ------------------------------------------------------------
-- Conferência (rode depois; tudo "true")
-- ------------------------------------------------------------
-- select
--   to_regclass('public.push_inscricoes') is not null as inscricoes,
--   (select count(*) = 2 from public.push_config where chave in ('segredo_disparo', 'url_site')) as config,
--   exists (select 1 from pg_trigger where tgname = 'notificacoes_push') as gatilho,
--   exists (select 1 from pg_extension where extname = 'pg_net') as pg_net;

-- ------------------------------------------------------------
-- Para desfazer (só se precisar):
-- drop trigger if exists notificacoes_push on public.notificacoes;
-- drop function if exists public.push_ao_notificar();
-- drop function if exists public.push_destinos_envio(bigint);
-- drop function if exists public.push_falha(bigint[]);
-- drop table if exists public.push_inscricoes;
-- drop table if exists public.push_config;
-- ------------------------------------------------------------
