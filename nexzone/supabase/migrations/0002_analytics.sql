-- ============================================================
-- Comprei Barato — Audiência ao vivo (analytics próprio)
-- Idempotente: pode rodar mais de uma vez no SQL Editor do Supabase.
--
-- LGPD: NÃO armazenamos endereço IP nem qualquer dado pessoal direto.
-- A localização é aproximada (cidade/estado/país) e vem dos headers de
-- geolocalização da Vercel; visitor_id é um UUID anônimo gerado no navegador.
-- ============================================================

create table if not exists public.site_sessions (
  id            uuid primary key,              -- id de sessão gerado no cliente
  visitor_id    uuid not null,                 -- id anônimo persistente (localStorage)
  started_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  country       text,
  region        text,                          -- ex.: 'SP' (código da subdivisão)
  city          text,
  lat           double precision,
  lon           double precision,
  device        text check (device in ('mobile','desktop','tablet')),
  referrer      text,
  landing_path  text,
  current_path  text,
  pageviews     int not null default 1,
  user_id       uuid null
);

create table if not exists public.site_pageviews (
  id          bigserial primary key,
  session_id  uuid not null,
  path        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists site_sessions_last_seen_idx  on public.site_sessions (last_seen desc);
create index if not exists site_sessions_started_at_idx on public.site_sessions (started_at desc);
create index if not exists site_sessions_visitor_idx    on public.site_sessions (visitor_id);
create index if not exists site_pageviews_created_idx   on public.site_pageviews (created_at desc);
create index if not exists site_pageviews_session_idx   on public.site_pageviews (session_id);

-- RLS ligado e SEM policies: anon/authenticated não leem nem escrevem.
-- Só o service role (rotas /api/track e /api/admin/audience) acessa.
alter table public.site_sessions  enable row level security;
alter table public.site_pageviews enable row level security;
