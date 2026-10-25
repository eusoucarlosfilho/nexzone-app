import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Só aceita caminhos relativos internos ("/algo"), nunca "//host" ou "/\host". */
function safeNext(raw: string | null, fallback = '/vender'): string {
  if (!raw) return fallback;
  let v = raw;
  try { v = decodeURIComponent(raw); } catch { return fallback; }
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n\t]/.test(v)) return fallback;
  return v;
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const isRecovery = type === 'recovery' || (searchParams.get('next') || '').startsWith('/redefinir-senha');
  const next = safeNext(searchParams.get('next'), type === 'recovery' ? '/redefinir-senha' : '/vender');

  // Para onde mandar quando o link é inválido/expirado
  const fail = () => NextResponse.redirect(`${origin}${isRecovery ? '/esqueci-senha' : '/login'}?erro=link`);

  // Supabase devolve erros na query (ex.: otp_expired, access_denied)
  if (searchParams.get('error') || searchParams.get('error_code')) return fail();

  const supabase = createClient();

  if (code) {
    // Fluxo PKCE (padrão do @supabase/ssr): troca o código pela sessão e grava os cookies
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    // Fluxo por token_hash (template de e-mail com {{ .TokenHash }}): funciona mesmo abrindo o link em outro aparelho
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail();
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Sem código: se já houver sessão segue para o destino, senão trata como link inválido
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(`${origin}${next}`);
  return isRecovery ? fail() : NextResponse.redirect(`${origin}${next}`);
}
