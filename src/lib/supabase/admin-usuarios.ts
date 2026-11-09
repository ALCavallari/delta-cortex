import { criarClienteServidor } from './server';
import { cookies } from 'next/headers';
import { COOKIE_RECUPERACAO, sessaoVerificada } from './session';
import { lerPerfil } from './perfil';

export async function clienteDoAdministrador() {
  const supabase = await criarClienteServidor();
  if (!supabase) return null;
  const claims = await sessaoVerificada(supabase);
  if (!claims || await lerPerfil(supabase, claims.sub) !== 'admin') return null;
  if (claims.session_id && (await cookies()).get(COOKIE_RECUPERACAO)?.value === claims.session_id) return null;
  return supabase;
}
