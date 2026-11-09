'use server';

import { criarClienteServidor } from '@/lib/supabase/server';

export async function exigirAdminLegado(): Promise<void> {
  const cliente = await criarClienteServidor();
  if (cliente) {
    const { data, error } = await cliente.auth.getClaims();
    const usuario = data?.claims?.sub;
    if (!error && usuario) {
      const acesso = await cliente.from('acessos_usuarios').select('papel')
        .eq('user_id', usuario).eq('ativo', true).maybeSingle();
      if (!acesso.error && acesso.data?.papel === 'admin') return;
    }
  }
  throw new Error('Esta operação exige um administrador ativo.');
}
