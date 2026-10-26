-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · Ofertas Parceiras · pacote V3 (candidato)
-- Nenhum destes scripts foi executado em nenhum banco.
-- ============================================================
-- 02 · Registro anônimo de cliques de saída (OPCIONAL: sem ele, os cliques aparecem como "indisponível")
-- Um clique NÃO é uma venda. Nenhum dado pessoal: sem IP, sem usuário, sem sessão, sem URL de origem.
-- Só o servidor grava e lê (RLS ligado, sem políticas).
-- Depende de 01.

create table if not exists public.partner_offer_clicks (
  id          bigserial primary key,
  offer_id    uuid not null references public.partner_offers(id) on delete cascade,
  origem      text null check (origem in ('pagina','card','busca','categoria','home','recomendacao')),
  dispositivo text null check (dispositivo in ('mobile','desktop','tablet')),
  created_at  timestamptz not null default now()
);
create index if not exists partner_offer_clicks_offer_idx on public.partner_offer_clicks (offer_id, created_at desc);
create index if not exists partner_offer_clicks_created_idx on public.partner_offer_clicks (created_at desc);

alter table public.partner_offer_clicks enable row level security;
revoke all on public.partner_offer_clicks from anon, authenticated;

-- Retenção sugerida (rodar só com aprovação, periodicamente):
-- delete from public.partner_offer_clicks where created_at < now() - interval '180 days';

-- Reverter:
-- drop table if exists public.partner_offer_clicks;
