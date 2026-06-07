-- ============================================================
-- NexZone — schema inicial (MVP) + RLS
-- Rode no SQL Editor do Supabase (ou via CLI: supabase db push)
-- ============================================================

-- PERFIS (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  role text not null default 'comprador'
    check (role in ('comprador','vendedor','ambos','admin')),
  created_at timestamptz not null default now()
);

-- LOJAS (um vendedor pode ter uma loja)
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  slug text unique not null,
  descricao text,
  categoria text,
  status text not null default 'pendente'
    check (status in ('pendente','verificado','suspenso')),
  nivel text not null default 'novo'
    check (nivel in ('novo','verificado','top')),
  recipient_id text,        -- id da subconta/recipient no gateway
  pix_key text,
  created_at timestamptz not null default now()
);

-- CATEGORIAS
create table if not exists public.categories (
  id serial primary key,
  nome text not null,
  slug text unique not null,
  emoji text
);

-- PRODUTOS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  titulo text not null,
  slug text not null,
  descricao text,
  categoria text,
  preco numeric(10,2) not null check (preco > 0),
  preco_promo numeric(10,2),
  tipo_entrega text not null default 'arquivo'
    check (tipo_entrega in ('arquivo','chave','link','acesso')),
  -- conteudo_entrega: caminho no Storage, link ou texto liberado pós-pagamento
  conteudo_entrega text,
  garantia_dias int not null default 7,
  status text not null default 'em_revisao'
    check (status in ('rascunho','em_revisao','ativo','pausado','reprovado')),
  emoji text default '📦',
  vendas int not null default 0,
  nota numeric(2,1) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_store_idx on public.products(store_id);

-- PEDIDOS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  comprador uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  store_id uuid not null references public.stores(id),
  total numeric(10,2) not null,
  taxa numeric(10,2) not null,            -- parte da plataforma (3%)
  valor_vendedor numeric(10,2) not null,  -- parte do vendedor
  status text not null default 'pendente'
    check (status in ('pendente','pago','entregue','reembolsado','cancelado')),
  gateway_ref text,                       -- id da transação no gateway
  conteudo_liberado text,                 -- snapshot do entregável após pagar
  entregue_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_comprador_idx on public.orders(comprador);
create index if not exists orders_store_idx on public.orders(store_id);

-- AVALIAÇÕES
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  comprador uuid not null references public.profiles(id),
  nota int not null check (nota between 1 and 5),
  comentario text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGER: cria profile automaticamente ao registrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), 'comprador')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: é admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.stores    enable row level security;
alter table public.products  enable row level security;
alter table public.orders    enable row level security;
alter table public.reviews   enable row level security;
alter table public.categories enable row level security;

-- PROFILES
create policy "perfil: leitura própria ou admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "perfil: atualiza o próprio" on public.profiles
  for update using (id = auth.uid());

-- CATEGORIES (públicas para leitura)
create policy "categorias: leitura pública" on public.categories
  for select using (true);

-- STORES
create policy "loja: leitura pública das verificadas" on public.stores
  for select using (status = 'verificado' or owner = auth.uid() or public.is_admin());
create policy "loja: dono cria a própria" on public.stores
  for insert with check (owner = auth.uid());
create policy "loja: dono edita / admin edita" on public.stores
  for update using (owner = auth.uid() or public.is_admin());

-- PRODUCTS
create policy "produto: público vê ativos; dono e admin veem tudo" on public.products
  for select using (
    status = 'ativo'
    or public.is_admin()
    or store_id in (select id from public.stores where owner = auth.uid())
  );
create policy "produto: dono insere na própria loja" on public.products
  for insert with check (
    store_id in (select id from public.stores where owner = auth.uid())
  );
create policy "produto: dono edita / admin edita" on public.products
  for update using (
    public.is_admin()
    or store_id in (select id from public.stores where owner = auth.uid())
  );

-- ORDERS
create policy "pedido: comprador vê os seus; vendedor vê os da loja; admin tudo" on public.orders
  for select using (
    comprador = auth.uid()
    or public.is_admin()
    or store_id in (select id from public.stores where owner = auth.uid())
  );
create policy "pedido: comprador autenticado cria" on public.orders
  for insert with check (comprador = auth.uid());
-- atualização de pedido (pago/entregue) é feita pelo webhook com service_role,
-- que ignora RLS por padrão.

-- REVIEWS
create policy "review: leitura pública" on public.reviews
  for select using (true);
create policy "review: comprador do pedido cria" on public.reviews
  for insert with check (
    comprador = auth.uid()
    and order_id in (select id from public.orders where comprador = auth.uid() and status in ('pago','entregue'))
  );
