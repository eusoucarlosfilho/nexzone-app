-- ============================================================
-- NÃO EXECUTAR — AGUARDANDO APROVAÇÃO EXPRESSA
-- Comprei Barato · V3 · 01 — Correção da C1 (papel e situação do perfil)
-- ============================================================
-- Problema (C1): a política "perfil: atualiza o próprio" deixa o usuário mudar QUALQUER coluna
-- da própria linha em public.profiles, inclusive role ('admin') e status ('ativo').
--
-- Correção: gatilho BEFORE UPDATE que, para chamadas feitas com a sessão do próprio usuário
-- (papel 'authenticated' ou 'anon'), bloqueia:
--   - qualquer mudança de status, de cb_points (se existir) e de vendedor_desde (se existir);
--   - qualquer mudança de role, EXCETO 'comprador' -> 'vendedor'/'ambos' e 'vendedor' -> 'ambos'
--     (o fluxo de criar loja em src/app/vender/actions.ts faz exatamente isso).
-- Rotas de servidor que usam a service role (painel admin) e o SQL Editor continuam podendo tudo.
--
-- Pode rodar mais de uma vez. Não altera nenhum dado.
-- Depois de aplicado, a variável ADMIN_USER_IDS continua valendo como camada extra.

create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  papel text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'));
begin
  -- Sem JWT (SQL Editor / postgres) ou service role (rotas de servidor do admin): permitido.
  if papel is null or papel = 'service_role' then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Alteração de situação da conta não permitida.' using errcode = '42501';
  end if;

  -- Colunas que só o sistema pode mudar (verificadas só se existirem na tabela):
  -- cb_points (saldo de pontos) e vendedor_desde (marco gravado por gatilho, script 02).
  if (to_jsonb(new) ? 'cb_points') and (to_jsonb(new) -> 'cb_points') is distinct from (to_jsonb(old) -> 'cb_points') then
    raise exception 'Alteração de pontos não permitida.' using errcode = '42501';
  end if;
  if (to_jsonb(new) ? 'vendedor_desde') and (to_jsonb(new) -> 'vendedor_desde') is distinct from (to_jsonb(old) -> 'vendedor_desde') then
    raise exception 'Alteração do marco de vendedor não permitida.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if not (
      (old.role = 'comprador' and new.role in ('vendedor', 'ambos'))
      or (old.role = 'vendedor' and new.role = 'ambos')
    ) then
      raise exception 'Alteração de papel não permitida.' using errcode = '42501';
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists proteger_campos_perfil on public.profiles;
create trigger proteger_campos_perfil
  before update on public.profiles
  for each row execute function public.proteger_campos_perfil();

-- Conferência (somente leitura): deve listar o gatilho
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'proteger_campos_perfil';

-- Teste manual sugerido (com um usuário comum logado no site, pelo console do navegador):
--   await supabase.from('profiles').update({ role: 'admin' }).eq('id', '<id do próprio usuário>')
--   -> deve retornar erro "Alteração de papel não permitida."
--
-- Reverter:
-- drop trigger if exists proteger_campos_perfil on public.profiles;
-- drop function if exists public.proteger_campos_perfil();
