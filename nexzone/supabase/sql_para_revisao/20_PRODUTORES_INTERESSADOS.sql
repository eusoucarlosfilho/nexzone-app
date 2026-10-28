-- ============================================================
-- SQL 20 — Página de recrutamento de produtores (/produtores)
-- ------------------------------------------------------------
-- O que faz:
--   1) Cria a tabela produtores_interessados (o formulário da página grava aqui).
--      Só o servidor lê e grava (service_role). Ninguém de fora consegue listar os cadastros.
--   2) Avisa os admins no sino quando chega um produtor novo (agrupado: não vira spam).
-- Pode rodar mais de uma vez sem problema.
-- Não mexe em pedidos, pagamentos, comissão nem em nenhuma tabela existente.
-- ============================================================

create table if not exists public.produtores_interessados (
  id            uuid primary key default gen_random_uuid(),
  token         uuid not null unique,              -- gerado no navegador: liga a etapa 1 à etapa 2
  etapa         smallint not null default 1 check (etapa in (1, 2)),
  nome          text not null check (char_length(nome) between 2 and 120),
  whatsapp      text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  email         text check (email is null or char_length(email) <= 160),
  instagram     text check (instagram is null or char_length(instagram) <= 60),
  nicho         text check (nicho is null or char_length(nicho) <= 80),
  tipos         text[] not null default '{}',      -- ebook, curso, planilha, template, ferramenta, outro
  ja_vende      text check (ja_vende is null or ja_vende in ('sim', 'comecando', 'nao')),
  plataformas   text[] not null default '{}',      -- onde já vende hoje
  faturamento   text check (faturamento is null or char_length(faturamento) <= 40),
  link_produto  text check (link_produto is null or char_length(link_produto) <= 300),
  mensagem      text check (mensagem is null or char_length(mensagem) <= 1000),
  status        text not null default 'novo' check (status in ('novo', 'conversando', 'cadastrou', 'vendendo', 'descartado')),
  notas         text check (notas is null or char_length(notas) <= 3000),
  origem        jsonb not null default '{}'::jsonb, -- utm_source, utm_campaign, utm_content, ref, página de entrada
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists produtores_interessados_criado_idx on public.produtores_interessados (criado_em desc);
create index if not exists produtores_interessados_status_idx on public.produtores_interessados (status);
create index if not exists produtores_interessados_whats_idx on public.produtores_interessados (whatsapp);

alter table public.produtores_interessados enable row level security;
-- sem políticas: só o service_role (servidor) acessa
revoke all on public.produtores_interessados from anon, authenticated;

-- ------------------------------------------------------------
-- Aviso no sino dos admins
-- ------------------------------------------------------------
create or replace function public.notif_produtor_interessado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_novos int;
begin
  begin
    -- avisa quando o cadastro chega e quando ele completa a 2ª etapa
    if tg_op = 'UPDATE' and not (old.etapa = 1 and new.etapa = 2) then return new; end if;
    select count(*) into v_novos from public.produtores_interessados where status = 'novo';
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.notificar(
        v_admin, 'aviso',
        case when v_novos > 1 then v_novos || ' produtores interessados esperando contato' else 'Novo produtor interessado' end,
        coalesce(new.nome, 'Produtor') || coalesce(' · ' || nullif(new.nicho, ''), '') || case when new.etapa = 2 then ' · cadastro completo' else ' · só a 1ª etapa' end,
        '/admin?aba=produtores',
        'produtores_interessados'
      );
    end loop;
  exception when others then
    raise warning 'notif_produtor_interessado ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.notif_produtor_interessado() from public, anon, authenticated;

drop trigger if exists produtores_interessados_notificar on public.produtores_interessados;
create trigger produtores_interessados_notificar
  after insert or update of etapa on public.produtores_interessados
  for each row execute function public.notif_produtor_interessado();

-- ------------------------------------------------------------
-- Conferência (rode depois; deve trazer 1 linha com tudo "true")
-- ------------------------------------------------------------
-- select
--   to_regclass('public.produtores_interessados') is not null as tabela,
--   (select relrowsecurity from pg_class where oid = 'public.produtores_interessados'::regclass) as rls_ligado,
--   exists (select 1 from pg_trigger where tgname = 'produtores_interessados_notificar') as aviso_admin;

-- ------------------------------------------------------------
-- Para desfazer (só se precisar):
-- ------------------------------------------------------------
-- drop trigger if exists produtores_interessados_notificar on public.produtores_interessados;
-- drop function if exists public.notif_produtor_interessado();
-- drop table if exists public.produtores_interessados;
