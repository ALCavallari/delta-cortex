import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export async function criarClienteServidor(escreverCookies = false) {
  const config = supabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        // Componentes de servidor recebem os cookies atualizados pelo Proxy.
        if (escreverCookies) for (const { name, value, options } of items) jar.set(name, value, options);
      },
    },
  });
}
