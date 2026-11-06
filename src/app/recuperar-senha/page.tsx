import { Suspense } from 'react';
import Link from 'next/link';
import { RecuperarForm } from '@/components/auth/AuthForms';
import { supabaseConfig } from '@/lib/supabase/config';

export default function RecuperarSenhaPage() {
  return <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate-100 to-white p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h1 className="text-xl font-bold">Recuperar senha</h1>
      <p className="text-sm text-slate-600">Informe o e-mail da sua conta para receber o link de recuperação.</p>
      <Suspense fallback={<p role="status">Carregando formulário…</p>}>
        <RecuperarForm configurado={!!supabaseConfig()} />
      </Suspense>
      <Link href="/" className="inline-block text-sm font-semibold text-sky-800 hover:underline">Voltar para o login</Link>
    </section>
  </main>;
}
