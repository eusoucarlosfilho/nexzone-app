-- ============================================================
-- SQL 23 — Central de notificações
-- ------------------------------------------------------------
-- Rode DEPOIS do SQL 22 e ANTES de subir o código desta entrega. Pode rodar mais de uma vez.
--
-- O que faz:
--   1) notificacao_prefs: cada pessoa escolhe quais avisos chegam na tela do celular (o sino guarda tudo)
--   2) Novos avisos:
--        • lojista: "Pix gerado" quando alguém gera o Pix de um produto dele (aguardando pagamento)
--        • admin:   "Pix gerado" e "Venda paga" de QUALQUER loja da plataforma
--   3) O envio para o celular (SQL 22) passa a respeitar as escolhas de cada pessoa
-- Não mexe em pedidos, pagamentos nem saldo.
-- ============================================================

-- 1) Novos tipos de aviso no sino
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'venda', 'compra', 'pagamento', 'reembolso', 'mensagem', 'pergunta', 'resposta',
  'saque', 'anuncio', 'aviso', 'advertencia', 'novidade',
  'pix_gerado', 'adm_pix', 'adm_venda')) not valid;

-- 2) Preferências: uma linha só quando a pessoa DESLIGA (ou religa) um tipo. Sem linha = ligado.
create table if not exists public.notificacao_prefs (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  tipo         text not null check (char_length(tipo) <= 30),
  celular      boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, tipo)
);
alter table public.notificacao_prefs enable row level security;
revoke all on public.notificacao_prefs from anon, authenticated;
-- sem políticas: o site lê e grava pelo servidor, sempre da pessoa logada

-- 3) Avisos novos de pedido (lojista e admins). O aviso antigo do comprador continua no SQL 17.
create or replace function public.notif_pedido_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_loja text;
  v_dono uuid;
  v_admin uuid;
  pix_novo boolean;
  pago_agora boolean;
begin
  begin
    pix_novo := new.status = 'pendente' and new.pix_code is not null and (tg_op = 'INSERT' or old.pix_code is null);
    pago_agora := new.status in ('pago', 'entregue') and (tg_op = 'INSERT' or old.status not in ('pago', 'entregue'));
    if not pix_novo and not pago_agora then return new; end if;

    select p.titulo into v_titulo from public.products p where p.id = new.product_id;
    select s.owner, s.nome into v_dono, v_loja from public.stores s where s.id = new.store_id;
    v_titulo := coalesce(v_titulo, 'Produto');
    v_loja := coalesce(v_loja, 'loja');

    if pix_novo then
      -- lojista: alguém gerou o Pix de um produto dele
      if v_dono is not null and v_dono is distinct from new.comprador then
        perform public.notificar(v_dono, 'pix_gerado', 'Pix gerado: ' || public.brl(new.total),
          '"' || v_titulo || '" · aguardando pagamento. Se não cair, chame o cliente em Vendas.',
          '/vender/vendas?f=aguardando', 'pixv:' || new.id);
      end if;
      -- admins: Pix gerado em qualquer loja
      for v_admin in select id from public.profiles where role = 'admin' loop
        perform public.notificar(v_admin, 'adm_pix', 'Pix gerado: ' || public.brl(new.total),
          '"' || v_titulo || '" · ' || v_loja || ' · aguardando pagamento',
          '/admin', 'admpix:' || new.id);
      end loop;
    end if;

    if pago_agora then
      -- o "Pix gerado" daquele pedido sai da lista de não lidos
      update public.notificacoes set lida_em = now()
       where grupo in ('pixv:' || new.id, 'admpix:' || new.id) and lida_em is null;
      for v_admin in select id from public.profiles where role = 'admin' loop
        perform public.notificar(v_admin, 'adm_venda', 'Venda paga: ' || public.brl(new.total),
          '"' || v_titulo || '" · ' || v_loja || coalesce(' · ' || case to_jsonb(new) ->> 'forma_pagamento' when 'cartao' then 'cartão' when 'pix' then 'Pix' end, ''),
          '/admin');
      end loop;
    end if;
  exception when others then
    raise warning 'notif_pedido_equipe ignorado: %', sqlerrm;   -- aviso nunca trava o pedido
  end;
  return new;
end;
$$;
revoke all on function public.notif_pedido_equipe() from public, anon, authenticated;

drop trigger if exists orders_notif_equipe on public.orders;
create trigger orders_notif_equipe
  after insert or update of status, pix_code on public.orders
  for each row execute function public.notif_pedido_equipe();

-- 4) Celular: respeita o que cada pessoa desligou (redefine a função do SQL 22)
create or replace function public.push_ao_notificar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
begin
  begin
    if new.envio_id is not null then return new; end if;            -- aviso em massa: o site manda em lote
    if new.lida_em is not null then return new; end if;
    if tg_op = 'UPDATE' and old.created_at is not distinct from new.created_at then return new; end if;
    if not exists (select 1 from public.push_inscricoes where user_id = new.user_id) then return new; end if;
    if exists (select 1 from public.notificacao_prefs where user_id = new.user_id and tipo = new.tipo and celular = false) then return new; end if;
    select valor into v_url from public.push_config where chave = 'url_site';
    select valor into v_segredo from public.push_config where chave = 'segredo_disparo';
    if v_url is null or v_segredo is null then return new; end if;
    perform net.http_post(
      url := rtrim(v_url, '/') || '/api/push/disparar',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-segredo', v_segredo),
      timeout_milliseconds := 8000
    );
  exception when others then
    raise warning 'push_ao_notificar ignorado: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.push_ao_notificar() from public, anon, authenticated;

create or replace function public.push_destinos_envio(p_envio bigint)
returns table (id bigint, user_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.user_id, i.endpoint, i.p256dh, i.auth
    from public.push_inscricoes i
   where exists (select 1 from public.notificacoes n where n.envio_id = p_envio and n.user_id = i.user_id)
     and not exists (select 1 from public.notificacao_prefs f where f.user_id = i.user_id and f.tipo = 'aviso' and f.celular = false)
$$;
revoke all on function public.push_destinos_envio(bigint) from public, anon, authenticated;
grant execute on function public.push_destinos_envio(bigint) to service_role;

-- ------------------------------------------------------------
-- Conferência (rode depois; tudo "true")
-- ------------------------------------------------------------
-- select
--   to_regclass('public.notificacao_prefs') is not null as prefs,
--   exists (select 1 from pg_trigger where tgname = 'orders_notif_equipe') as aviso_pix_e_venda,
--   pg_get_constraintdef((select oid from pg_constraint where conname = 'notificacoes_tipo_check')) like '%pix_gerado%' as tipo_novo;

-- Para desfazer (só se precisar):
-- drop trigger if exists orders_notif_equipe on public.orders;
-- drop function if exists public.notif_pedido_equipe();
-- drop table if exists public.notificacao_prefs;
