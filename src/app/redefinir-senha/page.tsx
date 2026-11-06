import { Suspense } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { RedefinirForm } from '@/components/auth/AuthForms';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, sessaoVerificada } from '@/lib/supabase/session';

async function FormularioVerificado() {
  const supabase = await criarClienteServidor();
  const claims = supabase ? await sessaoVerificada(supabase) : null;
  if (!claims?.session_id || (await cookies()).get(COOKIE_RECUPERACAO)?.value !== claims.session_id) {
    return <div className="space-y-3 text-sm">
      <p role="alert" className="text-red-800">Link inválido ou expirado. Solicite um novo link de recuperação.</p>
      <Link href="/recuperar-senha" className="font-semibold text-sky-800 underline">Solicitar novo link</Link>
    </div>;
  }
  return <RedefinirForm />;
}

export default function RedefinirSenhaPage() {
  return <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate-100 to-white p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h1 className="text-xl font-bold">Definir nova senha</h1>
      <Suspense fallback={<p role="status">Verificando link…</p>}><FormularioVerificado /></Suspense>
    </section>
  </main>;
}
