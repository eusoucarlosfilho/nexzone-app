-- =====================================================================
-- 0008 — Central de Suporte (chamados, mensagens, auditoria, anexos e avisos)
-- Rodar no SQL Editor do Supabase, o script inteiro de uma vez, ANTES do deploy.
-- Idempotente: pode rodar de novo sem duplicar nada e sem apagar dados.
--
-- Segurança:
-- - Toda gravação (abrir chamado, responder, anexar, mudar status) passa por rotas
--   do servidor com service_role. Não existe política de INSERT/UPDATE/DELETE para
--   anon/authenticated: o navegador não grava nada direto nestas tabelas.
-- - O cliente logado só LÊ os próprios chamados e as mensagens que não são nota interna.
-- - O link do visitante usa um token; no banco fica só o hash (sha-256) do token.
-- - O bucket "suporte-anexos" é PRIVADO; anexos são entregues por link assinado de curta
--   duração gerado no servidor, depois de conferir quem está pedindo.
-- =====================================================================
begin;
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1) Protocolo CB-AAAA-000001 (sequence)
-- ---------------------------------------------------------------------
create sequence if not exists public.support_protocol_seq;

-- ---------------------------------------------------------------------
-- 2) Chamados
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id                 uuid primary key default gen_random_uuid(),
  protocol           text not null unique
                       default ('CB-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
                                || lpad(nextval('public.support_protocol_seq')::text, 6, '0')),
  user_id            uuid references public.profiles(id) on delete set null,
  requester_name     text not null check (length(requester_name) between 1 and 120),
  requester_email    text not null check (length(requester_email) between 3 and 200),
  requester_phone    text check (requester_phone is null or length(requester_phone) <= 30),
  category           text not null check (category in (
                       'compra_entrega', 'pagamento_pix', 'reembolso', 'saque_saldo', 'cadastro_login',
                       'publicar_produto', 'destaque', 'denuncia', 'sugestao', 'outro')),
  subject            text not null check (length(subject) between 1 and 160),
  order_id           uuid references public.orders(id) on delete set null,
  status             text not null default 'aberto' check (status in (
                       'aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado')),
  priority           text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'urgente')),
  assigned_to        uuid references public.profiles(id) on delete set null,
  access_token_hash  text not null,                -- sha-256 do token do link do visitante (o token em si não é guardado)
  ip_hash            text,                         -- sha-256 do IP (só para o limite de 3 chamados por hora)
  customer_snapshot  jsonb not null default '{}'::jsonb,
  last_sender_type   text check (last_sender_type in ('cliente', 'admin', 'sistema')),
  opened_at          timestamptz not null default now(),
  first_response_at  timestamptz,
  last_message_at    timestamptz not null default now(),
  resolved_at        timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists support_tickets_status_idx          on public.support_tickets (status);
create index if not exists support_tickets_last_message_at_idx on public.support_tickets (last_message_at desc);
create index if not exists support_tickets_requester_email_idx on public.support_tickets (lower(requester_email));
create index if not exists support_tickets_user_id_idx         on public.support_tickets (user_id);
create index if not exists support_tickets_created_at_idx      on public.support_tickets (created_at desc);
create index if not exists support_tickets_ip_hash_idx         on public.support_tickets (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- 3) Mensagens
-- ---------------------------------------------------------------------
create table if not exists public.support_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.support_tickets(id) on delete cascade,
  sender_type      text not null check (sender_type in ('cliente', 'admin', 'sistema')),
  sender_id        uuid references public.profiles(id) on delete set null,
  body             text not null check (length(body) between 1 and 10000),
  attachment_path  text,
  attachment_name  text,
  attachment_type  text,
  is_internal_note boolean not null default false,
  email_sent_at    timestamptz,
  email_status     text not null default 'nao_aplicavel'
                     check (email_status in ('nao_aplicavel', 'pendente', 'enviado', 'falhou', 'desativado')),
  email_error      text,
  created_at       timestamptz not null default now(),
  constraint support_messages_nota_so_admin check (not is_internal_note or sender_type = 'admin')
);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- 4) Auditoria
-- ---------------------------------------------------------------------
create table if not exists public.support_ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  event_type  text not null check (event_type in (
                'aberto', 'status_alterado', 'prioridade_alterada', 'atribuido',
                'respondido', 'nota_interna', 'reaberto')),
  from_value  text,
  to_value    text,
  created_at  timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events (ticket_id, created_at);

-- updated_at automático
create or replace function public.support_tickets_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.support_tickets_touch();

-- ---------------------------------------------------------------------
-- 5) RLS e permissões
-- ---------------------------------------------------------------------
alter table public.support_tickets       enable row level security;
alter table public.support_messages      enable row level security;
alter table public.support_ticket_events enable row level security;

drop policy if exists "suporte: cliente lê os próprios; admin tudo" on public.support_tickets;
create policy "suporte: cliente lê os próprios; admin tudo" on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "suporte: cliente lê mensagens (sem nota interna); admin tudo" on public.support_messages;
create policy "suporte: cliente lê mensagens (sem nota interna); admin tudo" on public.support_messages
  for select to authenticated
  using (
    public.is_admin()
    or (not is_internal_note
        and ticket_id in (select t.id from public.support_tickets t where t.user_id = auth.uid()))
  );

drop policy if exists "suporte: só admin lê a auditoria" on public.support_ticket_events;
create policy "suporte: só admin lê a auditoria" on public.support_ticket_events
  for select to authenticated
  using (public.is_admin());

-- Nada para anon. Para authenticated, só leitura (e só de colunas que podem aparecer para o cliente).
revoke all on public.support_tickets, public.support_messages, public.support_ticket_events from anon;
revoke all on public.support_tickets, public.support_messages, public.support_ticket_events from authenticated;
grant select (id, protocol, user_id, requester_name, requester_email, requester_phone, category, subject,
              order_id, status, priority, opened_at, first_response_at, last_message_at, resolved_at,
              closed_at, created_at, updated_at)
  on public.support_tickets to authenticated;
grant select (id, ticket_id, sender_type, body, attachment_name, attachment_type, is_internal_note, created_at)
  on public.support_messages to authenticated;
grant select on public.support_ticket_events to authenticated;
grant select, insert, update, delete on public.support_tickets, public.support_messages, public.support_ticket_events to service_role;

revoke all on sequence public.support_protocol_seq from public, anon, authenticated;
grant usage, select on sequence public.support_protocol_seq to service_role;

revoke all on function public.support_tickets_touch() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Configurações de aviso (tabela settings). Só na PRIMEIRA execução:
--    - suporte_email_cliente: enviar ao cliente cada resposta nossa (ATIVADO)
--    - suporte_aviso_admins: { "<id do admin>": true } — cada admin liga/desliga o próprio aviso.
--      Todos os admins atuais começam ATIVADOS. Admin novo (sem chave) também conta como ativado.
-- ---------------------------------------------------------------------
insert into public.settings (key, value)
values ('suporte_email_cliente', 'true'::jsonb)
on conflict (key) do nothing;

insert into public.settings (key, value)
select 'suporte_aviso_admins',
       coalesce((select jsonb_object_agg(p.id::text, true) from public.profiles p where p.role = 'admin'), '{}'::jsonb)
on conflict (key) do nothing;

commit;

-- ---------------------------------------------------------------------
-- 7) Bucket privado "suporte-anexos" e política de leitura dos admins.
--    Fica FORA da transação de propósito: se o projeto não permitir mexer no schema
--    storage pelo SQL Editor, as tabelas acima já ficam gravadas e aparece um aviso.
--    (O servidor também cria o bucket sozinho na primeira vez, se ele não existir.)
-- ---------------------------------------------------------------------
do $bucket$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('suporte-anexos', 'suporte-anexos', false, 5242880,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
  on conflict (id) do update
    set public = false,
        file_size_limit = 5242880,
        allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
  raise notice 'Bucket suporte-anexos: OK (privado, 5 MB, imagens e PDF).';
exception when others then
  raise notice 'Não foi possível criar o bucket pelo SQL (%). Crie em Storage > New bucket: nome "suporte-anexos", PRIVADO, limite 5 MB.', sqlerrm;
end
$bucket$;

do $policy$
begin
  -- Leitura direta só para admins logados. Clientes e visitantes recebem link assinado pelo servidor.
  -- Não há política de INSERT/UPDATE/DELETE: uploads usam URL assinada criada pelo servidor.
  execute 'drop policy if exists "suporte-anexos: admin lê" on storage.objects';
  execute $p$create policy "suporte-anexos: admin lê" on storage.objects
            for select to authenticated
            using (bucket_id = 'suporte-anexos' and public.is_admin())$p$;
  raise notice 'Política "suporte-anexos: admin lê": OK.';
exception when others then
  raise notice 'Política de storage não criada pelo SQL (%). Ela é opcional: o site entrega os anexos por link assinado do servidor.', sqlerrm;
end
$policy$;
