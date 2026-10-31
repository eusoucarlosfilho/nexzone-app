-- ============================================================
-- SQL 37 — Programa de indicação de compradores
-- Rodar no projeto de TESTES primeiro, depois no de produção. NÃO rodar sem aprovação.
-- Só cria duas tabelas novas. Não altera nem apaga nada que já existe.
-- Fechadas (RLS ligada e sem política): só o servidor do site (service_role) lê e grava.
--   O comprador vê os próprios números pela rota /api/indicacao, que filtra pelo usuário da sessão.
-- O programa nasce DESLIGADO e com 0 pontos (settings.indicacao_cfg). Nada é pago até o admin configurar.
-- Rollback: drop table public.indicacoes; drop table public.indicacao_codigos; (não mexe em pontos já dados)
-- ============================================================

-- 1) Código pessoal de cada usuário (criado na 1ª vez que ele abre "Minhas indicações")
create table if not exists public.indicacao_codigos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  codigo text not null unique check (codigo ~ '^[A-Z2-9]{8}$'),
  bloqueado boolean not null default false,          -- admin bloqueia o código (links param de valer)
  criado_em timestamptz not null default now()
);
alter table public.indicacao_codigos enable row level security;

-- 2) Cada indicação: UMA por pessoa indicada (unique), com o estado da recompensa
--    cadastrado → pendente (1ª compra paga, aguardando o prazo) → liberada (pontos creditados)
--    ou bloqueada (admin/antifraude) · cancelada (fora das regras) · estornada (reembolso)
create table if not exists public.indicacoes (
  id bigserial primary key,
  indicador_id uuid not null references auth.users(id) on delete cascade,
  indicado_id uuid not null unique references auth.users(id) on delete cascade,
  codigo text not null,
  status text not null default 'cadastrado'
    check (status in ('cadastrado', 'pendente', 'liberada', 'bloqueada', 'cancelada', 'estornada')),
  order_id uuid references public.orders(id) on delete set null,
  pontos int check (pontos is null or pontos between 0 and 100000),
  libera_em timestamptz,
  liberada_em timestamptz,
  motivo text check (motivo is null or char_length(motivo) <= 300),
  sinais jsonb not null default '{}'::jsonb,          -- alertas de fraude (sem dado pessoal)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (indicador_id <> indicado_id)
);
create index if not exists indicacoes_indicador_idx on public.indicacoes (indicador_id, status);
create index if not exists indicacoes_liberar_idx on public.indicacoes (status, libera_em) where status = 'pendente';
create index if not exists indicacoes_order_idx on public.indicacoes (order_id) where order_id is not null;
alter table public.indicacoes enable row level security;

-- Conferência (as duas devem mostrar relrowsecurity = true e nenhuma política):
-- select relname, relrowsecurity from pg_class where relname in ('indicacao_codigos', 'indicacoes');
-- select * from pg_policies where tablename in ('indicacao_codigos', 'indicacoes');
