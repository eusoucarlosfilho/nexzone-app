import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Client com a sessão do usuário (respeita RLS)
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet: { name: string; value: string; options?: any }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* chamado de Server Component: ok ignorar */ }
        },
      },
    }
  );
}

// Client administrativo (service_role) — IGNORA RLS. Usar só no servidor
// (webhook de pagamento, rotinas de sistema). Nunca expor no client.
import { createClient as createAdminBase } from '@supabase/supabase-js';
export function createAdminClient() {
  return createAdminBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
