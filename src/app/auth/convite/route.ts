import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, REDEFINIR, sessaoVerificada } from '@/lib/supabase/session';

export async function GET(request: NextRequest) {
  const responder = (rota: string) => NextResponse.redirect(new URL(rota, request.url), {
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
  const invalido = () => responder('/recuperar-senha?erro=convite');
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  if (!token_hash || token_hash.length > 512 || request.nextUrl.searchParams.get('type') !== 'invite') return invalido();
  const supabase = await criarClienteServidor(true);
  if (!supabase) return invalido();
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'invite' });
    if (error || !data.session) return invalido();
    const claims = await sessaoVerificada(supabase);
    if (!claims?.session_id) return invalido();
    (await cookies()).set(COOKIE_RECUPERACAO, claims.session_id, {
      httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 900,
    });
    return responder(REDEFINIR);
  } catch {
    return invalido();
  }
}
