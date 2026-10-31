-- ============================================================
-- SQL 36 — Campanhas do site (faixa no topo e banner da home)
-- Rodar no projeto de TESTES primeiro, depois no de produção.
-- Só cria uma tabela nova. Não altera nem apaga nada que já existe.
-- Fechada (RLS ligada e sem política): só o servidor do site (service_role) lê e grava.
-- As imagens ficam no bucket público "capas", na pasta campanhas/ (o mesmo das capas dos anúncios).
-- ============================================================
create table if not exists public.campanhas_site (
  id bigserial primary key,
  formato text not null check (formato in ('faixa', 'banner')),
  titulo text not null check (char_length(titulo) between 3 and 90),
  mensagem text check (mensagem is null or char_length(mensagem) <= 220),
  botao text check (botao is null or char_length(botao) <= 30),
  link text check (link is null or char_length(link) <= 500),
  imagem_url text,            -- banner no computador (1920 x 600)
  imagem_mobile_url text,     -- banner no celular (1080 x 1080)
  tema text not null default 'laranja',
  intencao text check (intencao is null or char_length(intencao) <= 500),  -- anotação interna: o objetivo da campanha
  inicio timestamptz not null,
  fim timestamptz not null,
  ativa boolean not null default true,
  prioridade int not null default 0,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim > inicio)
);
create index if not exists campanhas_site_no_ar_idx on public.campanhas_site (formato, ativa, inicio, fim);
alter table public.campanhas_site enable row level security;

-- Conferência (deve mostrar relrowsecurity = true):
-- select relname, relrowsecurity from pg_class where relname = 'campanhas_site';
