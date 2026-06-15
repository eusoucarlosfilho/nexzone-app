import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet: { name: string; value: string; options?: any }[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  // Bloqueio de conta: se o usuário está 'bloqueado', manda pra /conta-suspensa.
  // Protegido: qualquer erro na leitura = deixa passar (nunca trava ninguém por engano).
  if (user) {
    const path = request.nextUrl.pathname;
    const liberado = path.startsWith('/conta-suspensa') || path.startsWith('/auth');
    if (!liberado) {
      try {
        const { data: prof } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle();
        if ((prof as any)?.status === 'bloqueado') {
          const url = request.nextUrl.clone();
          url.pathname = '/conta-suspensa';
          url.search = '';
          return NextResponse.redirect(url);
        }
      } catch { /* deixa passar */ }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
