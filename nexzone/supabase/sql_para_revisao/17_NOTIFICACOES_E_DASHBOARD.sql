-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · 17 · Central de notificações + forma de pagamento no pedido (dashboard)
-- ============================================================
-- 1) notificacoes: a "caixa de entrada" de cada usuário (sino no topo do site + página /notificacoes).
--    Cada um só vê e só marca como lida a PRÓPRIA notificação. Quem cria é o banco (gatilhos) e o servidor.
-- 2) Gatilhos que criam as notificações sozinhos:
--    • venda aprovada (vendedor) · compra aprovada (comprador) · Pix gerado aguardando pagamento (comprador)
--    • reembolso (os dois) · nova mensagem no chat do pedido (a outra parte; agrupa por conversa)
--    • nova pergunta (vendedor) · pergunta respondida (comprador)
--    • saque pago / recusado (vendedor) · anúncio aprovado / reprovado (vendedor)
--    • avisos e advertências do admin e pedidos de correção da moderação (copiados de user_notices)
-- 3) notificacoes_envios: histórico dos avisos que o admin manda para muita gente de uma vez.
-- 4) orders.forma_pagamento ('pix' | 'cartao'): gravado pelo webhook quando o pagamento é confirmado.
--    É o que separa "entrou no Pix" de "entrou no cartão" no Dashboard. Pedidos antigos ficam "não identificado".
--
-- Os gatilhos NUNCA travam pedido, mensagem, pergunta ou saque: qualquer erro vira só um aviso no log.
-- Não altera valores, comissão, checkout nem fulfill.ts.
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run. Pode rodar mais de uma vez. Só ACRESCENTA.

-- ------------------------------------------------------------
-- 1) Tabela
-- ------------------------------------------------------------
create table if not exists public.notificacoes (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('venda', 'compra', 'pagamento', 'reembolso', 'mensagem', 'pergunta', 'resposta',
                                     'saque', 'anuncio', 'aviso', 'advertencia', 'novidade')),
  titulo text not null,
  texto text null,
  link text null,
  grupo text null,                 -- agrupa avisos repetidos (ex.: várias mensagens da mesma conversa)
  envio_id bigint null,            -- aviso em massa que gerou esta notificação
  lida_em timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists notificacoes_user_idx on public.notificacoes(user_id, created_at desc);
create index if not exists notificacoes_nao_lidas_idx on public.notificacoes(user_id) where lida_em is null;
create index if not exists notificacoes_grupo_idx on public.notificacoes(user_id, grupo) where grupo is not null and lida_em is null;

alter table public.notificacoes enable row level security;
drop policy if exists "notificacao: dono le" on public.notificacoes;
create policy "notificacao: dono le" on public.notificacoes for select using (user_id = auth.uid());
drop policy if exists "notificacao: dono marca" on public.notificacoes;
create policy "notificacao: dono marca" on public.notificacoes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notificacao: dono apaga" on public.notificacoes;
create policy "notificacao: dono apaga" on public.notificacoes for delete using (user_id = auth.uid());
-- o usuário só consegue mudar a coluna "lida_em" (nada de trocar título, link ou dono)
revoke insert, update on public.notificacoes from anon, authenticated;
grant select, delete on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;

-- Histórico de avisos em massa (só servidor)
create table if not exists public.notificacoes_envios (
  id bigserial primary key,
  publico text not null check (publico in ('todos', 'vendedores', 'compradores', 'usuario')),
  titulo text not null,
  texto text null,
  link text null,
  total int not null default 0,
  autor uuid null,
  created_at timestamptz not null default now()
);
alter table public.notificacoes_envios enable row level security;
alter table public.notificacoes add column if not exists envio_id bigint null;

-- ------------------------------------------------------------
-- 2) Função única que grava (com agrupamento)
-- ------------------------------------------------------------
create or replace function public.notificar(p_user uuid, p_tipo text, p_titulo text, p_texto text, p_link text, p_grupo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  if p_grupo is not null then
    -- já existe uma não lida do mesmo grupo: só atualiza o texto e sobe para o topo
    update public.notificacoes set titulo = left(p_titulo, 140), texto = left(p_texto, 600), link = p_link, created_at = now()
     where user_id = p_user and grupo = p_grupo and lida_em is null;
    if found then return; end if;
  end if;
  insert into public.notificacoes(user_id, tipo, titulo, texto, link, grupo)
  values (p_user, p_tipo, left(p_titulo, 140), left(p_texto, 600), p_link, p_grupo);
exception when others then
  raise warning 'notificar ignorado: %', sqlerrm;
end;
$$;
revoke all on function public.notificar(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.brl(v numeric)
returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(v, 0), 'FM999G999G990D00'), '.', '#'), ',', '.'), '#', ',')
$$;

-- ------------------------------------------------------------
-- 3) Pedidos: venda/compra aprovada, Pix aguardando, reembolso
-- ------------------------------------------------------------
create or replace function public.notif_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_dono uuid;
  antes_pago boolean := false;
  agora_pago boolean := new.status in ('pago', 'entregue');
begin
  begin
    if tg_op = 'UPDATE' then antes_pago := old.status in ('pago', 'entregue'); end if;
    select p.titulo into v_titulo from public.products p where p.id = new.product_id;
    select s.owner into v_dono from public.stores s where s.id = new.store_id;
    v_titulo := coalesce(v_titulo, 'seu produto');

    -- Pix gerado, ainda não pago
    if new.status = 'pendente' and new.pix_code is not null and (tg_op = 'INSERT' or old.pix_code is null) then
      perform public.notificar(new.comprador, 'pagamento', 'Pix gerado: falta só pagar',
        'Pedido de "' || v_titulo || '" (' || public.brl(new.total) || '). Copie o código Pix na página do pedido.',
        '/pedido/' || new.id, 'pix:' || new.id);
    end if;

    if agora_pago and not antes_pago then
      update public.notificacoes set lida_em = now() where user_id = new.comprador and grupo = 'pix:' || new.id and lida_em is null;
      perform public.notificar(new.comprador, 'compra', 'Compra aprovada!',
        'Pagamento confirmado para "' || v_titulo || '". Seu acesso já está liberado.',
        '/pedido/' || new.id);
      if v_dono is not null and v_dono <> new.comprador then
        perform public.notificar(v_dono, 'venda', 'Você vendeu! ' || public.brl(new.total),
          '"' || v_titulo || '" · você recebe ' || public.brl(new.valor_vendedor) || '.',
          '/vender/vendas');
      end if;
    end if;

    if antes_pago and new.status = 'reembolsado' and old.status <> 'reembolsado' then
      perform public.notificar(new.comprador, 'reembolso', 'Reembolso registrado',
        'O pedido de "' || v_titulo || '" (' || public.brl(new.total) || ') foi reembolsado.', '/pedido/' || new.id);
      if v_dono is not null and v_dono <> new.comprador then
        perform public.notificar(v_dono, 'reembolso', 'Venda reembolsada',
          '"' || v_titulo || '" (' || public.brl(new.total) || '). O valor sai do seu saldo.', '/vender/vendas');
      end if;
    end if;
  exception when others then
    raise warning 'notif_pedido ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists orders_notificar on public.orders;
create trigger orders_notificar
  after insert or update of status, pix_code on public.orders
  for each row execute function public.notif_pedido();

-- ------------------------------------------------------------
-- 4) Chat do pedido: avisa a outra parte (1 aviso por conversa até ser lido)
-- ------------------------------------------------------------
create or replace function public.notif_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  v_titulo text;
  v_dono uuid;
  v_trecho text := left(regexp_replace(coalesce(new.texto, ''), '\s+', ' ', 'g'), 120);
begin
  begin
    if new.papel not in ('comprador', 'vendedor', 'admin') then return new; end if;
    select id, comprador, store_id, product_id, entregue_em into o from public.orders where id = new.order_id;
    if o.id is null then return new; end if;
    select titulo into v_titulo from public.products where id = o.product_id;
    select owner into v_dono from public.stores where id = o.store_id;
    v_titulo := coalesce(v_titulo, 'seu pedido');

    if new.papel = 'comprador' and v_dono is not null and v_dono <> o.comprador then
      perform public.notificar(v_dono, 'mensagem', 'Mensagem do cliente', '"' || v_titulo || '": ' || v_trecho,
        '/vender/conversas/' || o.id, 'msg:' || o.id);
    end if;
    -- a mensagem automática pós-compra (logo após o pagamento) não gera aviso: a "Compra aprovada" já avisou
    if new.papel = 'vendedor' and not (o.entregue_em is not null and new.created_at < o.entregue_em + interval '2 minutes') then
      perform public.notificar(o.comprador, 'mensagem', 'O vendedor respondeu', '"' || v_titulo || '": ' || v_trecho,
        '/pedido/' || o.id, 'msg:' || o.id);
    end if;
    if new.papel = 'admin' then
      perform public.notificar(o.comprador, 'mensagem', 'Mensagem do suporte', '"' || v_titulo || '": ' || v_trecho,
        '/pedido/' || o.id, 'msg:' || o.id);
      if v_dono is not null and v_dono <> o.comprador then
        perform public.notificar(v_dono, 'mensagem', 'Mensagem do suporte', '"' || v_titulo || '": ' || v_trecho,
          '/vender/conversas/' || o.id, 'msg:' || o.id);
      end if;
    end if;
  exception when others then
    raise warning 'notif_mensagem ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists order_messages_notificar on public.order_messages;
create trigger order_messages_notificar
  after insert on public.order_messages
  for each row execute function public.notif_mensagem();

-- ------------------------------------------------------------
-- 5) Perguntas: nova (vendedor) e respondida (quem perguntou)
-- ------------------------------------------------------------
create or replace function public.notif_pergunta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_dono uuid;
begin
  begin
    select titulo into v_titulo from public.products where id = new.product_id;
    v_titulo := coalesce(v_titulo, 'um produto');
    if tg_op = 'INSERT' then
      select owner into v_dono from public.stores where id = new.store_id;
      if v_dono is not null and v_dono is distinct from new.autor then
        perform public.notificar(v_dono, 'pergunta', 'Nova pergunta',
          'Em "' || v_titulo || '". Responda rápido para não perder a venda.', '/vender/perguntas');
      end if;
    elsif new.resposta is not null and old.resposta is null then
      perform public.notificar(new.autor, 'resposta', 'Sua pergunta foi respondida',
        'Sobre "' || v_titulo || '": ' || left(new.resposta, 120), '/produto/' || new.product_id);
    end if;
  exception when others then
    raise warning 'notif_pergunta ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists product_questions_notificar on public.product_questions;
create trigger product_questions_notificar
  after insert or update of resposta on public.product_questions
  for each row execute function public.notif_pergunta();

-- ------------------------------------------------------------
-- 6) Saques: pago / recusado
-- ------------------------------------------------------------
create or replace function public.notif_saque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
begin
  begin
    if new.status is not distinct from old.status then return new; end if;
    select owner into v_dono from public.stores where id = new.store_id;
    if new.status = 'pago' then
      perform public.notificar(v_dono, 'saque', 'Saque pago: ' || public.brl(new.valor),
        'O valor foi enviado para a sua chave Pix cadastrada.', '/vender/recebimentos');
    elsif new.status = 'recusado' then
      perform public.notificar(v_dono, 'saque', 'Saque recusado',
        'O pedido de ' || public.brl(new.valor) || ' foi recusado e o valor voltou para o seu saldo. Fale com o suporte se tiver dúvida.',
        '/vender/recebimentos');
    end if;
  exception when others then
    raise warning 'notif_saque ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists payouts_notificar on public.payouts;
create trigger payouts_notificar
  after update of status on public.payouts
  for each row execute function public.notif_saque();

-- ------------------------------------------------------------
-- 7) Anúncios: aprovado / reprovado na fila de aprovação
--    (pedidos de correção, pausa e cancelamento chegam pelo aviso da moderação, item 8)
-- ------------------------------------------------------------
create or replace function public.notif_anuncio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
begin
  begin
    if old.status <> 'em_revisao' or new.status = old.status then return new; end if;
    if (to_jsonb(new) ->> 'moderacao') is not null then return new; end if; -- moderação já avisou
    select owner into v_dono from public.stores where id = new.store_id;
    if new.status = 'ativo' then
      perform public.notificar(v_dono, 'anuncio', 'Anúncio aprovado',
        '"' || new.titulo || '" já está no ar e pode vender.', '/produto/' || new.id);
    elsif new.status = 'reprovado' then
      perform public.notificar(v_dono, 'anuncio', 'Anúncio não aprovado',
        '"' || new.titulo || '" não foi aprovado. Revise o anúncio e envie de novo.', '/vender/produtos');
    end if;
  exception when others then
    raise warning 'notif_anuncio ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists products_notificar on public.products;
create trigger products_notificar
  after update of status on public.products
  for each row execute function public.notif_anuncio();

-- ------------------------------------------------------------
-- 8) Avisos e advertências do admin (inclui os da moderação) → também viram notificação
-- ------------------------------------------------------------
create or replace function public.notif_aviso_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txt text := coalesce(new.texto, '');
  v_titulo text;
  v_resto text;
begin
  begin
    if new.tipo not in ('aviso', 'advertencia') then return new; end if;
    -- moderação grava "Assunto\n\nCorpo": a 1ª linha vira o título
    if position(E'\n\n' in v_txt) between 2 and 140 then
      v_titulo := split_part(v_txt, E'\n\n', 1);
      v_resto := substr(v_txt, length(v_titulo) + 3);
    else
      v_titulo := case when new.tipo = 'advertencia' then 'Advertência da equipe' else 'Aviso da equipe' end;
      v_resto := v_txt;
    end if;
    perform public.notificar(new.user_id, new.tipo, v_titulo, v_resto,
      case when v_txt ilike '%anúncio%' or v_txt ilike '%anuncio%' then '/vender/produtos' else null end);
  exception when others then
    raise warning 'notif_aviso_admin ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists user_notices_notificar on public.user_notices;
create trigger user_notices_notificar
  after insert on public.user_notices
  for each row execute function public.notif_aviso_admin();

-- ------------------------------------------------------------
-- 9) Aviso em massa (o admin escreve no painel; só o servidor chama)
-- ------------------------------------------------------------
create or replace function public.notificar_em_massa(p_publico text, p_titulo text, p_texto text, p_link text, p_autor uuid, p_user uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_envio bigint;
  v_total int;
begin
  insert into public.notificacoes_envios(publico, titulo, texto, link, autor)
  values (p_publico, left(p_titulo, 140), left(p_texto, 600), p_link, p_autor) returning id into v_envio;

  insert into public.notificacoes(user_id, tipo, titulo, texto, link, envio_id)
  select pr.id, 'novidade', left(p_titulo, 140), left(p_texto, 600), p_link, v_envio
    from public.profiles pr
   where coalesce(to_jsonb(pr) ->> 'status', 'ativo') <> 'bloqueado'
     and case p_publico
           when 'todos' then true
           when 'vendedores' then exists (select 1 from public.stores s where s.owner = pr.id)
           when 'compradores' then exists (select 1 from public.orders o where o.comprador = pr.id and o.status in ('pago', 'entregue'))
           when 'usuario' then pr.id = p_user
           else false
         end;
  get diagnostics v_total = row_count;
  update public.notificacoes_envios set total = v_total where id = v_envio;
  return v_total;
end;
$$;
revoke all on function public.notificar_em_massa(text, text, text, text, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 10) Forma de pagamento do pedido (Dashboard: Pix x cartão)
-- ------------------------------------------------------------
alter table public.orders add column if not exists forma_pagamento text null;
do $$ begin
  alter table public.orders add constraint orders_forma_pagamento_chk check (forma_pagamento is null or forma_pagamento in ('pix', 'cartao'));
exception when duplicate_object then null; end $$;
create index if not exists orders_pagos_data_idx on public.orders(entregue_em) where status in ('pago', 'entregue');

-- ------------------------------------------------------------
-- Conferência (só leitura)
-- ------------------------------------------------------------
select to_regclass('public.notificacoes') as notificacoes, to_regclass('public.notificacoes_envios') as envios;
select tgname from pg_trigger where tgname in ('orders_notificar', 'order_messages_notificar', 'product_questions_notificar',
  'payouts_notificar', 'products_notificar', 'user_notices_notificar') order by 1;
select column_name from information_schema.columns where table_name = 'orders' and column_name = 'forma_pagamento';

-- ============================================================
-- REVERSÃO (só se precisar desfazer). Descomente e rode:
-- drop trigger if exists orders_notificar on public.orders;
-- drop trigger if exists order_messages_notificar on public.order_messages;
-- drop trigger if exists product_questions_notificar on public.product_questions;
-- drop trigger if exists payouts_notificar on public.payouts;
-- drop trigger if exists products_notificar on public.products;
-- drop trigger if exists user_notices_notificar on public.user_notices;
-- drop function if exists public.notif_pedido(), public.notif_mensagem(), public.notif_pergunta(),
--   public.notif_saque(), public.notif_anuncio(), public.notif_aviso_admin();
-- drop function if exists public.notificar_em_massa(text, text, text, text, uuid, uuid);
-- drop function if exists public.notificar(uuid, text, text, text, text, text);
-- drop function if exists public.brl(numeric);
-- drop table if exists public.notificacoes;
-- drop table if exists public.notificacoes_envios;
-- alter table public.orders drop constraint if exists orders_forma_pagamento_chk;
-- alter table public.orders drop column if exists forma_pagamento;
-- ============================================================
