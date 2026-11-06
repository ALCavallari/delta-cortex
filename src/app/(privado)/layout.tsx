import { Suspense, type ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PrivateHistoryGuard } from '@/components/auth/PrivateHistoryGuard';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, REDEFINIR, sessaoVerificada } from '@/lib/supabase/session';

async function AreaVerificada({ children }: { children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const claims = supabase ? await sessaoVerificada(supabase) : null;
  if (!claims) redirect('/');
  if (claims.session_id && (await cookies()).get(COOKIE_RECUPERACAO)?.value === claims.session_id) redirect(REDEFINIR);
  return <PrivateHistoryGuard>{children}</PrivateHistoryGuard>;
}

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-600">Verificando sessão…</p>}>
    <AreaVerificada>{children}</AreaVerificada>
  </Suspense>;
}
