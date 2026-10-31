-- ============================================================
-- SQL 33 — Caixa de e-mail dentro do admin (@compreibarato.com.br)
-- Rodar no projeto de TESTES primeiro, depois no de produção.
-- Só cria uma tabela nova. Não altera nem apaga nada que já existe.
-- Fechada (RLS ligada e sem política): só o servidor do site (service_role) lê e grava.
-- Os anexos NÃO ficam no banco: ficam no Resend e são baixados na hora, por um link temporário.
-- ============================================================
create table if not exists public.email_caixa (
  id bigserial primary key,
  pasta text not null default 'entrada' check (pasta in ('entrada', 'enviados', 'arquivo', 'lixeira', 'spam')),
  sentido text not null check (sentido in ('recebido', 'enviado')),
  resend_id text unique,                 -- id do e-mail no Resend (recebido ou enviado)
  message_id text,                       -- cabeçalho Message-ID
  in_reply_to text,                      -- cabeçalho In-Reply-To
  conversa text not null,                -- agrupa a conversa (Message-ID da 1ª mensagem)
  de text not null,                      -- endereço de quem enviou
  de_nome text,
  para text[] not null default '{}',
  cc text[] not null default '{}',
  assunto text not null default '',
  texto text,
  html text,
  previa text,                           -- primeiras linhas do texto, para a lista
  anexos jsonb not null default '[]'::jsonb,   -- [{ id, nome, tipo, tamanho }]
  lido boolean not null default false,
  estrela boolean not null default false,
  autenticacao jsonb,                    -- SPF/DKIM/DMARC do e-mail recebido
  enviado_por uuid,                      -- admin que enviou (só nos enviados)
  criado_em timestamptz not null default now()
);
create index if not exists email_caixa_pasta_idx on public.email_caixa (pasta, criado_em desc);
create index if not exists email_caixa_conversa_idx on public.email_caixa (conversa, criado_em);
create index if not exists email_caixa_nao_lidos_idx on public.email_caixa (lido) where lido = false and pasta = 'entrada';
create index if not exists email_caixa_message_id_idx on public.email_caixa (message_id);
alter table public.email_caixa enable row level security;

-- Conferência (deve mostrar relrowsecurity = true):
-- select relname, relrowsecurity from pg_class where relname = 'email_caixa';
