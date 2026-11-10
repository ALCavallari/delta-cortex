import { Header } from '@/components/Header';
import { AlterarSenhaForm } from '@/components/auth/AuthForms';

export default function AlterarMinhaSenhaPage() {
  return <>
    <Header title="Meu Perfil" />
    <main className="mx-auto w-full max-w-lg p-5 sm:p-8">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">Alterar minha senha</h1>
        <AlterarSenhaForm />
      </section>
    </main>
  </>;
}
