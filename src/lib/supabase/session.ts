import type { SupabaseClient } from '@supabase/supabase-js';

export const COOKIE_RECUPERACAO = 'delta-recovery';
export const DASHBOARD = '/dashboard';
export const REDEFINIR = '/redefinir-senha';
export const PRIMEIRO_ACESSO = '/primeiro-acesso';
export const ALTERAR_SENHA = '/meu-perfil/senha';
const areasPrivadas = ['/dashboard', '/clientes', '/projetos', '/modulos', '/acompanhamento',
  '/administracao', '/portal-cliente', '/meus-trabalhos', ALTERAR_SENHA];
const temCaractereInseguro = (texto: string) =>
  [...texto].some(c => c === '\\' || c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127);

export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') ||
      temCaractereInseguro(valor)) return DASHBOARD;
  try {
    const base = 'https://delta.invalid';
    const destino = new URL(valor, base);
    const caminho = decodeURIComponent(destino.pathname);
    if (destino.origin !== base || !areasPrivadas.some(area => caminho === area || caminho.startsWith(area + '/')) ||
        temCaractereInseguro(caminho)) return DASHBOARD;
    return destino.pathname + destino.search;
  } catch {
    return DASHBOARD;
  }
}

export async function sessaoVerificada(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const email = claims?.email;
    return !error && claims?.sub && claims.role === 'authenticated' &&
      typeof email === 'string' && email && claims.is_anonymous !== true ? { ...claims, email } : null;
  } catch {
    return null;
  }
}

export async function lerEstadoSenha(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('delta_cortex_estado_senha');
  return !error && (data === 'pendente' || data === 'sessao_anterior' || data === 'liberado') ? data : null;
}
