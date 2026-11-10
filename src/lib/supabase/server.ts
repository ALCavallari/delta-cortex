import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export function criarClientePrivilegiado() {
  const config = supabaseConfig();
  const segredo = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !segredo?.startsWith('sb_secret_')) return null;
  return createClient(config.url, segredo, { auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
  } });
}

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
