import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Delta CorteX',
    short_name: 'Delta CorteX',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#333436',
    icons: [
      { src: '/cortex-app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/cortex-app-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
