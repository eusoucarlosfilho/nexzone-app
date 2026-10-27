-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 18 · Área de membros (cursos) + garantia com reembolso pelo site
-- Rode DEPOIS do SQL 17.
-- ============================================================
-- 1) Área de membros: o produtor monta o curso (módulos e aulas) dentro do Comprei Barato.
--    cursos            → configuração do curso de cada produto (ligado/desligado, boas-vindas, certificado)
--    curso_modulos     → módulos, em ordem, com liberação gradual (X dias depois da compra)
--    curso_aulas       → aulas: vídeo (YouTube, Vimeo, Panda, Bunny, Loom, Drive ou link .mp4), texto, materiais
--    curso_progresso   → aulas concluídas por aluno
--    curso_certificados→ certificados emitidos (com código de verificação público)
--    Ninguém lê essas tabelas direto: o site confere no servidor se a pessoa comprou (ou é o dono) antes de mostrar.
-- 2) Garantia: o comprador pede o reembolso pelo site dentro do prazo de garantia do produto (mínimo 7 dias, CDC art. 49).
--    reembolso_pedidos → pedidos de reembolso (aberto → aprovado / recusado / cancelado)
--    Enquanto o pedido está aberto, o saldo daquela venda fica retido (igual reclamação).
--    Notificações (SQL 17): comprador, vendedor e admins são avisados no sino.
--
-- Não altera valores, comissão, checkout, webhooks nem fulfill.ts. O dinheiro do reembolso continua sendo
-- devolvido pelo admin no painel do gateway (MisticPay / Stripe); o site registra e libera/retém o saldo.
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run. Pode rodar mais de uma vez. Só ACRESCENTA.

-- ------------------------------------------------------------
-- 1) Área de membros
-- ------------------------------------------------------------
create table if not exists public.cursos (
  product_id uuid primary key references public.products(id) on delete cascade,
  ativo boolean not null default false,
  boas_vindas text null,                       -- mensagem no topo da área do aluno
  certificado boolean not null default false,  -- emite certificado ao concluir
  carga_horaria int null check (carga_horaria is null or carga_horaria between 1 and 2000), -- horas no certificado
  cor text null,                               -- cor de destaque da área (#RRGGBB)
  atualizado_em timestamptz not null default now()
);

create table if not exists public.curso_modulos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 140),
  ordem int not null default 0,
  liberar_apos_dias int not null default 0 check (liberar_apos_dias between 0 and 730),
  created_at timestamptz not null default now()
);
create index if not exists curso_modulos_produto_idx on public.curso_modulos(product_id, ordem);

create table if not exists public.curso_aulas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  modulo_id uuid not null references public.curso_modulos(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 160),
  video_url text null check (video_url is null or char_length(video_url) <= 600),
  conteudo text null check (conteudo is null or char_length(conteudo) <= 20000),  -- texto da aula (formatado)
  materiais jsonb not null default '[]'::jsonb,   -- [{ titulo, url } | { titulo, path, nome }]
  duracao_min int null check (duracao_min is null or duracao_min between 0 and 1440),
  ordem int not null default 0,
  liberar_apos_dias int not null default 0 check (liberar_apos_dias between 0 and 730),
  previa boolean not null default false,           -- aula grátis (aparece na página do produto)
  publicada boolean not null default true,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists curso_aulas_modulo_idx on public.curso_aulas(modulo_id, ordem);
create index if not exists curso_aulas_produto_idx on public.curso_aulas(product_id);

create table if not exists public.curso_progresso (
  user_id uuid not null references public.profiles(id) on delete cascade,
  aula_id uuid not null references public.curso_aulas(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  concluida_em timestamptz not null default now(),
  primary key (user_id, aula_id)
);
create index if not exists curso_progresso_produto_idx on public.curso_progresso(product_id, user_id);

create table if not exists public.curso_certificados (
  codigo text primary key,                         -- código público de verificação
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  nome_aluno text not null,
  titulo_curso text not null,
  carga_horaria int null,
  emitido_em timestamptz not null default now(),
  unique (user_id, product_id)
);

-- Último acesso do aluno (para o produtor ver quem está ativo)
create table if not exists public.curso_acessos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  ultima_aula uuid null,
  ultimo_acesso timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.cursos enable row level security;
alter table public.curso_modulos enable row level security;
alter table public.curso_aulas enable row level security;
alter table public.curso_progresso enable row level security;
alter table public.curso_certificados enable row level security;
alter table public.curso_acessos enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava; o site confere compra/dono antes

-- ------------------------------------------------------------
-- 2) Garantia e reembolso
-- ------------------------------------------------------------
create table if not exists public.reembolso_pedidos (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  comprador uuid not null references public.profiles(id) on delete cascade,
  motivo text not null check (motivo in ('nao_recebi', 'nao_era_o_esperado', 'problema_tecnico', 'comprei_sem_querer', 'arrependimento', 'outro')),
  detalhe text null check (detalhe is null or char_length(detalhe) <= 2000),
  status text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado', 'cancelado')),
  resposta text null check (resposta is null or char_length(resposta) <= 2000),
  decidido_por uuid null,
  decidido_em timestamptz null,
  created_at timestamptz not null default now()
);
-- no máximo um pedido aberto por compra
create unique index if not exists reembolso_um_aberto on public.reembolso_pedidos(order_id) where status = 'aberto';
create index if not exists reembolso_status_idx on public.reembolso_pedidos(status, created_at desc);
alter table public.reembolso_pedidos enable row level security;

-- Notificações (SQL 17): pedido aberto → vendedor + admins; decisão → comprador (e vendedor)
create or replace function public.notif_reembolso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_dono uuid;
  v_total numeric;
  a record;
begin
  begin
    select p.titulo, s.owner, o.total into v_titulo, v_dono, v_total
      from public.orders o join public.products p on p.id = o.product_id join public.stores s on s.id = o.store_id
     where o.id = new.order_id;
    v_titulo := coalesce(v_titulo, 'um produto');
    if tg_op = 'INSERT' then
      perform public.notificar(new.comprador, 'reembolso', 'Pedido de reembolso recebido',
        'Vamos analisar o reembolso de "' || v_titulo || '" e te avisar por aqui.', '/pedido/' || new.order_id);
      if v_dono is not null and v_dono <> new.comprador then
        perform public.notificar(v_dono, 'reembolso', 'Cliente pediu reembolso',
          '"' || v_titulo || '" (' || public.brl(v_total) || '). O saldo desta venda fica retido até a decisão.', '/vender/conversas/' || new.order_id);
      end if;
      for a in select id from public.profiles where role = 'admin' loop
        perform public.notificar(a.id, 'reembolso', 'Novo pedido de reembolso',
          '"' || v_titulo || '" (' || public.brl(v_total) || ').', '/admin?aba=reembolsos', 'reembolsos-admin');
      end loop;
    elsif new.status is distinct from old.status and new.status in ('aprovado', 'recusado') then
      if new.status = 'aprovado' then
        perform public.notificar(new.comprador, 'reembolso', 'Reembolso aprovado',
          'O reembolso de "' || v_titulo || '" foi aprovado. O valor volta pela mesma forma de pagamento.', '/pedido/' || new.order_id);
      else
        perform public.notificar(new.comprador, 'reembolso', 'Reembolso não aprovado',
          coalesce(nullif(new.resposta, ''), 'Veja os detalhes na página do pedido.'), '/pedido/' || new.order_id);
        if v_dono is not null then
          perform public.notificar(v_dono, 'reembolso', 'Reembolso recusado pela equipe',
            '"' || v_titulo || '": a venda segue valendo e o saldo volta ao fluxo normal.', '/vender/vendas');
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'notif_reembolso ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists reembolso_notificar on public.reembolso_pedidos;
create trigger reembolso_notificar
  after insert or update of status on public.reembolso_pedidos
  for each row execute function public.notif_reembolso();

-- ------------------------------------------------------------
-- Conferência (só leitura)
-- ------------------------------------------------------------
select to_regclass('public.cursos') as cursos, to_regclass('public.curso_aulas') as aulas,
       to_regclass('public.curso_certificados') as certificados, to_regclass('public.reembolso_pedidos') as reembolsos;
select tgname from pg_trigger where tgname = 'reembolso_notificar';

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists reembolso_notificar on public.reembolso_pedidos;
-- drop function if exists public.notif_reembolso();
-- drop table if exists public.reembolso_pedidos;
-- drop table if exists public.curso_acessos;
-- drop table if exists public.curso_certificados;
-- drop table if exists public.curso_progresso;
-- drop table if exists public.curso_aulas;
-- drop table if exists public.curso_modulos;
-- drop table if exists public.cursos;
-- ============================================================
