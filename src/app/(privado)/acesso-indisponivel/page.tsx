import { Header } from '@/components/Header';

export default function AcessoIndisponivel() {
  return <><Header /><main className="mx-auto max-w-3xl p-6">
    <h1 className="text-xl font-bold">Acesso indisponível</h1>
    <p className="mt-2">Procure a administração para conferir o status da sua conta.</p>
  </main></>;
}
