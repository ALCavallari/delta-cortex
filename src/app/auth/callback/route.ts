import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, REDEFINIR, sessaoVerificada } from '@/lib/supabase/session';

export async function GET(request: NextRequest) {
  const responder = (caminho: string) => NextResponse.redirect(new URL(caminho, request.url), {
    headers: { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' },
  });
  const invalido = () => responder('/recuperar-senha?erro=link');
  const supabase = await criarClienteServidor(true);
  if (!supabase) return responder('/recuperar-senha');
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');

  try {
    if (code && !tokenHash) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) return invalido();
      if (!('redirectType' in data) || data.redirectType !== 'recovery') {
        await supabase.auth.signOut({ scope: 'local' });
        return invalido();
      }
    } else if (tokenHash && !code && searchParams.get('type') === 'recovery') {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error || !data.session) return invalido();
    } else return invalido();

    const claims = await sessaoVerificada(supabase);
    if (!claims?.session_id) return invalido();
    (await cookies()).set(COOKIE_RECUPERACAO, claims.session_id, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
    return responder(REDEFINIR);
  } catch {
    return invalido();
  }
}
