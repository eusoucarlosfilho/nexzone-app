-- ============================================================
-- SQL 34 — Registro do admin ("quem fez o quê") + atendimento dos novos lojistas
-- Rodar no projeto de TESTES primeiro, depois no de produção.
-- Pode rodar mais de uma vez sem problema.
-- Não apaga nada. Não mexe em pedidos, pagamentos, saldo nem comissão.
-- ------------------------------------------------------------
-- O que faz:
--   1) Cria a tabela admin_registro: cada aprovação, mensagem, mudança de status,
--      saque, reembolso etc. feita no admin fica gravada com QUEM fez e QUANDO.
--      Fechada (RLS ligada e sem política): só o servidor do site lê e grava.
--      Ninguém consegue editar ou apagar um registro pelo site.
--   2) Acrescenta em produtores_interessados quem está atendendo o lojista,
--      quantas mensagens da sequência já foram enviadas e quem mudou o status.
-- ============================================================

create table if not exists public.admin_registro (
  id         bigserial primary key,
  admin_id   uuid,                                  -- quem fez (profiles.id)
  admin_nome text,                                  -- nome na hora da ação (fica mesmo se o perfil mudar)
  acao       text not null check (char_length(acao) between 2 and 40),
  alvo_tipo  text check (alvo_tipo is null or char_length(alvo_tipo) <= 20),   -- produto, produtor, usuario, pedido, saque…
  alvo_id    text check (alvo_id is null or char_length(alvo_id) <= 80),
  alvo_nome  text check (alvo_nome is null or char_length(alvo_nome) <= 160),
  detalhes   jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);
create index if not exists admin_registro_criado_idx on public.admin_registro (criado_em desc);
create index if not exists admin_registro_admin_idx  on public.admin_registro (admin_id, criado_em desc);
create index if not exists admin_registro_alvo_idx   on public.admin_registro (alvo_tipo, alvo_id, criado_em desc);
create index if not exists admin_registro_acao_idx   on public.admin_registro (acao, criado_em desc);

alter table public.admin_registro enable row level security;
revoke all on public.admin_registro from anon, authenticated;

-- Histórico não se edita: bloqueia UPDATE e DELETE até para o servidor.
create or replace function public.admin_registro_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'O registro do admin não pode ser alterado nem apagado.';
end $$;
drop trigger if exists admin_registro_imutavel on public.admin_registro;
create trigger admin_registro_imutavel before update or delete on public.admin_registro
  for each row execute function public.admin_registro_imutavel();

-- ------------------------------------------------------------
-- Atendimento dos novos lojistas (tabela do SQL 20)
-- ------------------------------------------------------------
alter table public.produtores_interessados add column if not exists responsavel_id    uuid;
alter table public.produtores_interessados add column if not exists responsavel_nome  text;
alter table public.produtores_interessados add column if not exists responsavel_em    timestamptz;
alter table public.produtores_interessados add column if not exists contato_msgs      smallint not null default 0;
alter table public.produtores_interessados add column if not exists contato_ultimo_em timestamptz;
alter table public.produtores_interessados add column if not exists contato_ultimo_por text;
alter table public.produtores_interessados add column if not exists status_por        text;
alter table public.produtores_interessados add column if not exists status_em         timestamptz;
create index if not exists produtores_interessados_resp_idx on public.produtores_interessados (responsavel_id);

-- Conferência (deve mostrar admin_registro com relrowsecurity = true e as 8 colunas novas):
-- select relname, relrowsecurity from pg_class where relname = 'admin_registro';
-- select column_name from information_schema.columns where table_name = 'produtores_interessados' and column_name in
--   ('responsavel_id','responsavel_nome','responsavel_em','contato_msgs','contato_ultimo_em','contato_ultimo_por','status_por','status_em');
