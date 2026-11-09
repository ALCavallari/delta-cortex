import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { lerPerfil } from '@/lib/supabase/perfil';
import { sessaoVerificada } from '@/lib/supabase/session';
import { destinoPerfil, type Perfil } from '@/services/perfis';

export async function AreaPerfil({ esperado, children }: { esperado: Perfil; children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const claims = supabase && await sessaoVerificada(supabase);
  const perfil = supabase && claims ? await lerPerfil(supabase, claims.sub) : null;
  if (perfil !== esperado) redirect(perfil ? destinoPerfil(perfil) : '/acesso-indisponivel');
  return children;
}
