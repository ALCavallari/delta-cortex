'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { criarClienteNavegador } from '@/lib/supabase/client';

export function LogoutButton({ escuro = false }: { escuro?: boolean }) {
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState(false);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setErro(false);
    try {
      const supabase = criarClienteNavegador();
      if (!supabase) throw new Error();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      window.location.replace('/');
    } catch {
      setErro(true);
      setSaindo(false);
    }
  }

  return <div className="relative shrink-0">
    <button type="button" disabled={saindo} aria-label={saindo ? 'Saindo' : 'Sair'} title="Sair"
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold disabled:opacity-50 ${escuro
        ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
      onClick={() => void sair()}>
      <LogOut size={16} aria-hidden />
      <span className="hidden md:inline">{saindo ? 'Saindo…' : 'Sair'}</span>
    </button>
    {erro && <p role="alert" className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800">
      Não foi possível sair. Tente novamente.
    </p>}
  </div>;
}
