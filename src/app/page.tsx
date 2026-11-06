'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogIn, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      {/* Container Centralizado */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 sm:p-10 text-center flex flex-col items-center transition-all">
        {/* Logo Delta CorteX */}
        <div className="mb-6 flex w-full justify-center">
          <Image
            src="/Cortex.png"
            alt="Delta CorteX"
            width={320}
            height={320}
            sizes="(min-width: 640px) 320px, (min-width: 352px) 256px, calc(100vw - 6rem - 2px)"
            preload
            className="h-auto w-64 max-w-full object-contain sm:w-80"
          />
        </div>

        {/* Aviso de Acesso Demonstrativo */}
        <div className="w-full mb-8 bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 text-left">
          <ShieldAlert className="w-5 h-5 text-[#00AFF0] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">Acesso Demonstrativo:</span>{' '}
            Nesta primeira etapa de desenvolvimento, a autenticação direta está habilitada. Não utilize credenciais reais.
          </div>
        </div>

        {/* Botão Principal de Login */}
        <Link
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 text-base"
        >
          <LogIn className="w-5 h-5" />
          <span>Login</span>
        </Link>
      </div>

      {/* Rodapé Corporativo */}
      <footer className="mt-8 text-center text-xs text-slate-400">
        <p>© 2026 Delta S Engenharia e Consultoria Ambiental.</p>
        <p className="mt-1">Delta CorteX • Versão 1.0.0 (Etapa 1 — Frontend Local)</p>
      </footer>
    </main>
  );
}
