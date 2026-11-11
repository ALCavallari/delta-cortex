import { Suspense, type ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PrivateHistoryGuard } from '@/components/auth/PrivateHistoryGuard';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, PRIMEIRO_ACESSO, REDEFINIR, lerEstadoSenha, sessaoVerificada } from '@/lib/supabase/session';
import { PerfilProvider } from '@/components/auth/PerfilContext';
import { lerPerfil } from '@/lib/supabase/perfil';
import { SincronizadorCampo } from '@/components/SincronizadorCampo';

async function AreaVerificada({ children }: { children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const claims = supabase ? await sessaoVerificada(supabase) : null;
  if (!claims || !supabase) redirect('/');
  if (claims.session_id && (await cookies()).get(COOKIE_RECUPERACAO)?.value === claims.session_id) redirect(REDEFINIR);
  const senha = await lerEstadoSenha(supabase);
  if (!senha) return <p role="alert" className="p-6 text-sm">Não foi possível verificar o acesso. Tente novamente.</p>;
  if (senha !== 'liberado') redirect(PRIMEIRO_ACESSO);
  const perfil = await lerPerfil(supabase, claims.sub);
  const operaCampo = perfil === 'admin' || perfil === 'editor' || perfil === 'tecnico';
  return <PrivateHistoryGuard><PerfilProvider perfil={perfil} email={claims.email} usuarioId={claims.sub}>
    {operaCampo && <SincronizadorCampo usuarioId={claims.sub} />}
    {children}
  </PerfilProvider></PrivateHistoryGuard>;
}

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-600">Verificando sessão…</p>}>
    <AreaVerificada>{children}</AreaVerificada>
  </Suspense>;
}
