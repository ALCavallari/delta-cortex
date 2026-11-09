export type Perfil = 'admin' | 'editor' | 'leitor' | 'cliente' | 'tecnico';

export function perfilValido(valor: unknown): valor is Perfil {
  return valor === 'admin' || valor === 'editor' || valor === 'leitor' || valor === 'cliente' || valor === 'tecnico';
}

export function destinoPerfil(perfil: Perfil) {
  if (perfil === 'cliente') return '/portal-cliente';
  if (perfil === 'tecnico') return '/meus-trabalhos';
  return '/dashboard';
}

export function rotaPermitida(perfil: Perfil, rota: string) {
  if (rota === '/acesso-indisponivel') return true;
  if (rota === '/administracao' || rota.startsWith('/administracao/')) return perfil === 'admin';
  if (perfil === 'cliente') return rota === '/portal-cliente';
  if (perfil === 'tecnico') return rota === '/meus-trabalhos'
    || /^\/acompanhamento\/visita\/[^/]+$/.test(rota) || rota === '/api/google-maps';
  return rota !== '/portal-cliente' && rota !== '/meus-trabalhos';
}
