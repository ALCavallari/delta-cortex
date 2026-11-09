import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/supabase/config';
import { COOKIE_RECUPERACAO, DASHBOARD, REDEFINIR, sessaoVerificada } from '@/lib/supabase/session';
import { lerPerfil } from '@/lib/supabase/perfil';
import { destinoPerfil, rotaPermitida } from '@/services/perfis';

const recursosPublicos = new Set([
  '/favicon.ico', '/Cortex.png', '/Cortex_Simplificado.png', '/logo-delta-s.png', '/logo-delta-s.jpg',
  '/Delta%20S%20-%20Fundo%20Transparente.png', '/file.svg', '/globe.svg', '/next.svg', '/vercel.svg', '/window.svg',
]);
const paginasPublicas = new Set(['/', '/recuperar-senha', REDEFINIR]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (recursosPublicos.has(pathname)) return NextResponse.next();

  let resposta = NextResponse.next({ request });
  function semCache(destino: NextResponse) {
    if (destino !== resposta) {
      for (const cookie of resposta.cookies.getAll()) destino.cookies.set(cookie);
    }
    destino.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return destino;
  }

  if (pathname === '/auth/callback' || pathname === '/auth/convite') return semCache(resposta);

  const config = supabaseConfig();
  const supabase = config && createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of items) resposta.cookies.set(name, value, options);
      },
    },
  });
  const claims = supabase ? await sessaoVerificada(supabase) : null;
  const recuperando = !!claims?.session_id && request.cookies.get(COOKIE_RECUPERACAO)?.value === claims.session_id;

  if (pathname === '/' && claims && request.method === 'GET') {
    return semCache(NextResponse.redirect(new URL(recuperando ? REDEFINIR : DASHBOARD, request.url)));
  }
  if (paginasPublicas.has(pathname)) return semCache(resposta);
  if (supabase && claims && !recuperando) {
    const perfil = await lerPerfil(supabase, claims.sub);
    if (pathname === '/acesso-indisponivel' || (perfil && rotaPermitida(perfil, pathname))) return semCache(resposta);
    if (pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) {
      return semCache(NextResponse.json({ erro: 'Acesso indisponível.' }, { status: 403 }));
    }
    return semCache(NextResponse.redirect(new URL(perfil ? destinoPerfil(perfil) : '/acesso-indisponivel', request.url)));
  }

  if (pathname.startsWith('/api/') || pathname === '/api' || !['GET', 'HEAD'].includes(request.method)) {
    return semCache(NextResponse.json({ erro: 'Sessão indisponível.' }, { status: config ? 401 : 503 }));
  }
  if (recuperando) return semCache(NextResponse.redirect(new URL(REDEFINIR, request.url)));
  const login = new URL('/', request.url);
  login.searchParams.set('next', pathname + search);
  return semCache(NextResponse.redirect(login));
}

export const config = {
  matcher: ['/((?!_next/static/|_next/image(?:/|$)|_next/webpack-hmr).*)'],
};
