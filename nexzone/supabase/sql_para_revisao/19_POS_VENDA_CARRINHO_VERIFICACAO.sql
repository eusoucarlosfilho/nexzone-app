-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 19 · Oferta pós-compra, carrinho abandonado e verificação do produtor
-- Rode DEPOIS do SQL 17 e do SQL 18.
-- ============================================================
-- 1) produto_pos_venda: o que o produtor configura por produto
--      • oferta logo depois da compra (upsell) e, se recusar, uma segunda oferta (downsell)
--      • recuperação de carrinho abandonado (ligada por padrão) com cupom opcional
-- 2) ofertas_respostas: o que o comprador respondeu (para não mostrar de novo)
-- 3) carrinhos_abandonados: quem preencheu os dados no checkout e não pagou → lembretes em 1 h e 24 h
--      Um gatilho em orders marca o carrinho como "recuperado" quando a compra é paga.
-- 4) verificacoes_vendedor: identidade do produtor (CPF/CNPJ + documentos). O SAQUE só é aceito
--      depois de aprovado (regra no site E no banco). Vender continua liberado (opção 1).
--      O número do documento fica CRIPTOGRAFADO; as fotos ficam no armazenamento privado.
--      O admin pode desligar a exigência em settings: verificacao_saque = false.
--
-- Não altera valores, comissão, checkout, webhooks nem fulfill.ts.
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run. Pode rodar mais de uma vez. Só ACRESCENTA.

-- ------------------------------------------------------------
-- 1) Configuração de pós-venda por produto
-- ------------------------------------------------------------
create table if not exists public.produto_pos_venda (
  product_id uuid primary key references public.products(id) on delete cascade,
  upsell_ativo boolean not null default false,
  upsell_product_id uuid null references public.products(id) on delete set null,
  upsell_preco numeric(10,2) null check (upsell_preco is null or upsell_preco >= 1),
  upsell_titulo text null check (upsell_titulo is null or char_length(upsell_titulo) <= 120),
  upsell_texto text null check (upsell_texto is null or char_length(upsell_texto) <= 2000),
  upsell_botao text null check (upsell_botao is null or char_length(upsell_botao) <= 60),
  upsell_minutos int not null default 15 check (upsell_minutos between 0 and 120),
  downsell_ativo boolean not null default false,
  downsell_product_id uuid null references public.products(id) on delete set null,
  downsell_preco numeric(10,2) null check (downsell_preco is null or downsell_preco >= 1),
  downsell_titulo text null check (downsell_titulo is null or char_length(downsell_titulo) <= 120),
  downsell_texto text null check (downsell_texto is null or char_length(downsell_texto) <= 2000),
  recuperacao_ativa boolean not null default true,
  recuperacao_cupom text null check (recuperacao_cupom is null or recuperacao_cupom ~ '^[A-Z0-9_-]{2,40}$'),
  atualizado_em timestamptz not null default now()
);
alter table public.produto_pos_venda enable row level security;

create table if not exists public.ofertas_respostas (
  order_id uuid not null references public.orders(id) on delete cascade,
  etapa text not null check (etapa in ('upsell', 'downsell')),
  resposta text not null check (resposta in ('aceitou', 'recusou')),
  novo_pedido uuid null references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (order_id, etapa)
);
alter table public.ofertas_respostas enable row level security;

-- ------------------------------------------------------------
-- 2) Carrinho abandonado
-- ------------------------------------------------------------
create table if not exists public.carrinhos_abandonados (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete cascade,
  email text not null check (char_length(email) between 5 and 160),
  nome text null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  lembrete_1h timestamptz null,
  lembrete_24h timestamptz null,
  convertido_em timestamptz null,
  recuperado boolean not null default false,       -- pagou DEPOIS de receber lembrete
  valor_recuperado numeric(10,2) null,
  unique (product_id, email)
);
create index if not exists carrinhos_fila_idx on public.carrinhos_abandonados(atualizado_em) where convertido_em is null;
create index if not exists carrinhos_produto_idx on public.carrinhos_abandonados(product_id, criado_em desc);
alter table public.carrinhos_abandonados enable row level security;

-- Compra paga → carrinho convertido (e "recuperado" se já tinha recebido lembrete)
create or replace function public.carrinho_converter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  begin
    if new.status in ('pago', 'entregue') and (tg_op = 'INSERT' or old.status not in ('pago', 'entregue')) then
      v_email := lower(coalesce(new.comprador_email, (select email from auth.users where id = new.comprador)));
      update public.carrinhos_abandonados c
         set convertido_em = now(),
             recuperado = (c.lembrete_1h is not null or c.lembrete_24h is not null),
             valor_recuperado = case when (c.lembrete_1h is not null or c.lembrete_24h is not null) then new.total else null end
       where c.product_id = new.product_id and c.convertido_em is null
         and (c.user_id = new.comprador or (v_email is not null and c.email = v_email));
    end if;
  exception when others then
    raise warning 'carrinho_converter ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists orders_carrinho_converter on public.orders;
create trigger orders_carrinho_converter
  after insert or update of status on public.orders
  for each row execute function public.carrinho_converter();

-- ------------------------------------------------------------
-- 3) Verificação do produtor
-- ------------------------------------------------------------
create table if not exists public.verificacoes_vendedor (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('pf', 'pj')),
  nome text not null check (char_length(nome) between 5 and 160),          -- nome completo ou razão social
  documento_cifrado text not null,                                           -- CPF/CNPJ criptografado (enc:v1:…)
  documento_final text not null check (documento_final ~ '^[0-9]{2,4}$'),    -- só os últimos dígitos, para exibir
  nascimento date null,
  responsavel text null,                                                     -- PJ: nome do responsável
  doc_frente text not null,                                                  -- caminhos no armazenamento privado
  doc_verso text null,
  selfie text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'reprovado')),
  motivo text null check (motivo is null or char_length(motivo) <= 1000),
  enviado_em timestamptz not null default now(),
  decidido_em timestamptz null,
  decidido_por uuid null
);
create index if not exists verificacoes_status_idx on public.verificacoes_vendedor(status, enviado_em);
alter table public.verificacoes_vendedor enable row level security;
-- sem políticas: só o servidor lê e grava (o site confere o dono)

-- Avisos no sino (SQL 17): nova verificação → admins; decisão → produtor
create or replace function public.notif_verificacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  begin
    if new.status = 'pendente' and (tg_op = 'INSERT' or old.status is distinct from 'pendente') then
      for a in select id from public.profiles where role = 'admin' loop
        perform public.notificar(a.id, 'aviso', 'Verificação de produtor para analisar', new.nome, '/admin?aba=verificacoes', 'verificacoes-admin');
      end loop;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'aprovado' then
        perform public.notificar(new.user_id, 'aviso', 'Identidade verificada ✅', 'Pronto! Seus saques estão liberados.', '/vender/recebimentos');
      elsif new.status = 'reprovado' then
        perform public.notificar(new.user_id, 'advertencia', 'Verificação não aprovada',
          coalesce(nullif(new.motivo, ''), 'Revise os dados e envie de novo.'), '/vender/verificacao');
      end if;
    end if;
  exception when others then
    raise warning 'notif_verificacao ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists verificacao_notificar on public.verificacoes_vendedor;
create trigger verificacao_notificar
  after insert or update of status on public.verificacoes_vendedor
  for each row execute function public.notif_verificacao();

-- Trava no banco: saque só para produtor verificado (ou admin), a menos que o admin desligue a exigência.
create or replace function public.exigir_verificacao_saque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_exige boolean := true;
begin
  select coalesce(lower(value::text) not in ('false', '"false"'), true) into v_exige from public.settings where key = 'verificacao_saque';
  if v_exige is false then return new; end if;
  select owner into v_owner from public.stores where id = new.store_id;
  if exists (select 1 from public.profiles where id = v_owner and role = 'admin') then return new; end if;
  if not exists (select 1 from public.verificacoes_vendedor where user_id = v_owner and status = 'aprovado') then
    raise exception 'verificacao_pendente: verifique sua identidade antes de sacar' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists payouts_exigir_verificacao on public.payouts;
create trigger payouts_exigir_verificacao
  before insert on public.payouts
  for each row execute function public.exigir_verificacao_saque();

-- Exigência ligada por padrão (o admin pode mudar em Configurações)
do $$ begin
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'value') = 'jsonb' then
    execute $q$insert into public.settings(key, value) values ('verificacao_saque', 'true'::jsonb) on conflict (key) do nothing$q$;
  else
    execute $q$insert into public.settings(key, value) values ('verificacao_saque', 'true') on conflict (key) do nothing$q$;
  end if;
end $$;

-- ------------------------------------------------------------
-- Conferência (só leitura)
-- ------------------------------------------------------------
select to_regclass('public.produto_pos_venda') as pos_venda, to_regclass('public.carrinhos_abandonados') as carrinhos,
       to_regclass('public.verificacoes_vendedor') as verificacoes,
       (select count(*) from pg_trigger where tgname in ('orders_carrinho_converter', 'verificacao_notificar', 'payouts_exigir_verificacao')) as gatilhos_3;

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists payouts_exigir_verificacao on public.payouts;
-- drop trigger if exists verificacao_notificar on public.verificacoes_vendedor;
-- drop trigger if exists orders_carrinho_converter on public.orders;
-- drop function if exists public.exigir_verificacao_saque(), public.notif_verificacao(), public.carrinho_converter();
-- drop table if exists public.verificacoes_vendedor;
-- drop table if exists public.carrinhos_abandonados;
-- drop table if exists public.ofertas_respostas;
-- drop table if exists public.produto_pos_venda;
-- delete from public.settings where key = 'verificacao_saque';
-- ============================================================
