-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 04 — Tabela de eventos de funil (anônimos)
-- ============================================================
-- Guarda só os eventos da lista fechada de src/lib/eventos.ts (cadastro aberto/iniciado/etapa/erro/concluído,
-- clique em produto, clique em Comprar, busca, clique para vender). Sem IP, sem nome, sem e-mail,
-- sem texto digitado em campos pessoais, sem gravação de tela.
-- props: só as chaves permitidas por evento, validadas no servidor (/api/track), até ~1 KB.
--
-- A GRAVAÇÃO SÓ ACONTECE com a chave settings.analytics_funil = true, que este script cria DESLIGADA.
-- Ligar pelo Admin > Audiência depois da revisão de privacidade.
--
-- RLS ligado e SEM políticas: visitantes e usuários não leem nem gravam. Só as rotas de servidor
-- (service role) acessam.
-- Pode rodar mais de uma vez.

create table if not exists public.site_events (
  id          bigserial primary key,
  session_id  uuid not null,
  visitor_id  uuid null,
  nome        text not null,
  props       jsonb not null default '{}'::jsonb,
  path        text null,
  device      text null,
  created_at  timestamptz not null default now()
);

alter table public.site_events drop constraint if exists site_events_nome_check;
alter table public.site_events add constraint site_events_nome_check check (nome in (
  'cadastro_aberto','cadastro_iniciado','cadastro_etapa','cadastro_erro','cadastro_concluido',
  'produto_clique','compra_clique','busca','vendedor_cta'
));
alter table public.site_events drop constraint if exists site_events_props_check;
alter table public.site_events add constraint site_events_props_check check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 1000);
alter table public.site_events drop constraint if exists site_events_path_check;
alter table public.site_events add constraint site_events_path_check check (path is null or char_length(path) <= 200);
alter table public.site_events drop constraint if exists site_events_device_check;
alter table public.site_events add constraint site_events_device_check check (device is null or device in ('mobile','desktop','tablet'));

create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_nome_created_idx on public.site_events (nome, created_at desc);
create index if not exists site_events_session_idx on public.site_events (session_id);

alter table public.site_events enable row level security;

-- Chave de ativação: DESLIGADA por padrão.
insert into public.settings (key, value) values ('analytics_funil', 'false'::jsonb)
on conflict (key) do nothing;

-- Conferência (somente leitura)
select (select count(*) from public.site_events) as eventos, (select value from public.settings where key = 'analytics_funil') as funil_ligado;

-- Reverter:
-- drop table if exists public.site_events;
-- delete from public.settings where key = 'analytics_funil';
