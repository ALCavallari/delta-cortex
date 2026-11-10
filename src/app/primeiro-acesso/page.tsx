import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlterarSenhaForm } from '@/components/auth/AuthForms';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, DASHBOARD, REDEFINIR, lerEstadoSenha, sessaoVerificada } from '@/lib/supabase/session';

async function PrimeiroAcessoVerificado() {
  const supabase = await criarClienteServidor();
  const claims = supabase && await sessaoVerificada(supabase);
  if (!supabase || !claims?.session_id) redirect('/');
  if ((await cookies()).get(COOKIE_RECUPERACAO)?.value === claims.session_id) redirect(REDEFINIR);
  const estado = await lerEstadoSenha(supabase);
  if (estado === 'liberado') redirect(DASHBOARD);
  if (estado === 'sessao_anterior') return <div className="space-y-3">
    <p className="text-sm">A senha provisória já foi trocada. Saia e entre novamente com a nova senha.</p>
    <LogoutButton menu />
  </div>;
  if (!estado) return <p role="alert" className="text-sm text-red-800">Não foi possível verificar a conta. Tente novamente.</p>;
  return <div className="space-y-4">
    <p className="text-sm text-slate-700">Defina uma senha pessoal para acessar o Delta CorteX.</p>
    <AlterarSenhaForm primeiroAcesso />
    <LogoutButton menu />
  </div>;
}

export default function PrimeiroAcessoPage() {
  return <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate-100 to-white p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h1 className="text-xl font-bold">Primeiro acesso</h1>
      <Suspense fallback={<p role="status">Verificando a conta…</p>}><PrimeiroAcessoVerificado /></Suspense>
    </section>
  </main>;
}
