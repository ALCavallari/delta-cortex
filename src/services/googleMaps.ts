import { validarCoordenadas } from './utm';

const hosts = new Set([
  'google.com', 'www.google.com', 'maps.google.com',
  'google.com.br', 'www.google.com.br', 'maps.google.com.br',
]);
const decimal = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const pair = new RegExp(`^(?:loc:)?\\s*(${decimal})\\s*,\\s*(${decimal})$`, 'i');

export function lerLinkGoogleMaps(link: string) {
  let url: URL;
  try { url = new URL(link.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if ((url.hostname === 'maps.app.goo.gl' && /^\/[\w-]+\/?$/.test(url.pathname)) ||
      (url.hostname === 'goo.gl' && /^\/maps\/[\w-]+\/?$/.test(url.pathname))) return { tipo: 'encurtado' } as const;
  if (!hosts.has(url.hostname) || (!url.hostname.startsWith('maps.') && !/^\/maps(?:\/|$)/.test(url.pathname))) return null;

  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return { tipo: 'sem-coordenadas' } as const; }
  const ponto = (valor: string | null, tipo: 'ponto' | 'visualizacao') => {
    const match = valor?.trim().match(pair);
    if (!match) return null;
    const latitude = Number(match[1]), longitude = Number(match[2]);
    return validarCoordenadas(latitude, longitude) ? { tipo, latitude, longitude } : null;
  };
  const segmentos = path.split('/');
  const destino = segmentos[2] === 'dir' ? segmentos[4] : null;
  const lugar = segmentos[2] === 'place'
    ? path.match(new RegExp(`/data=[^/]*!3d(${decimal})!4d(${decimal})(?=!|/|$)`))
    : null;
  const explicito = ponto(url.searchParams.get('destination'), 'ponto')
    ?? ponto(url.searchParams.get('daddr'), 'ponto')
    ?? ponto(destino, 'ponto')
    ?? ponto(lugar ? `${lugar[1]},${lugar[2]}` : null, 'ponto')
    ?? ponto(url.searchParams.get('query'), 'ponto')
    ?? ponto(url.searchParams.get('q'), 'ponto')
    ?? ponto(segmentos[2] === 'search' || segmentos[2] === 'place' ? segmentos[3] : null, 'ponto');
  if (explicito) return explicito;

  const centro = path.match(new RegExp(`/@(${decimal}),(${decimal})(?=,|/|$)`));
  return ponto(centro ? `${centro[1]},${centro[2]}` : null, 'visualizacao')
    ?? ponto(url.searchParams.get('ll'), 'visualizacao')
    ?? ponto(url.searchParams.get('center'), 'visualizacao')
    ?? { tipo: 'sem-coordenadas' } as const;
}
