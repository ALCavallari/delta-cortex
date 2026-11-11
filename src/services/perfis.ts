export type Perfil = 'admin' | 'editor' | 'leitor' | 'cliente' | 'tecnico';

export function perfilValido(valor: unknown): valor is Perfil {
  return valor === 'admin' || valor === 'editor' || valor === 'leitor' || valor === 'cliente' || valor === 'tecnico';
}

export function destinoPerfil(perfil: Perfil) {
  if (perfil === 'cliente' || perfil === 'tecnico') return '/acompanhamento';
  return '/dashboard';
}

export function rotaPermitida(perfil: Perfil, rota: string) {
  if (rota === '/acesso-indisponivel' || rota === '/meu-perfil/senha') return true;
  if (rota === '/administracao' || rota.startsWith('/administracao/')) return perfil === 'admin';
  if (perfil === 'cliente') return rota === '/acompanhamento' || rota === '/portal-cliente';
  if (perfil === 'tecnico') return rota === '/acompanhamento' || rota === '/meus-trabalhos'
    || /^\/acompanhamento\/(visita|relatorios)\/[^/]+$/.test(rota) || rota === '/api/google-maps';
  return rota !== '/portal-cliente' && rota !== '/meus-trabalhos';
}
