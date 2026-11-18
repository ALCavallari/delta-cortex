'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export const campoFinanceiro = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00AFF0] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-600';
export const botaoFinanceiro = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50';
export const botaoSecundarioFinanceiro = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function FinanceiroDialog({ titulo, ocupado = false, onClose, children }: {
  titulo: string; ocupado?: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!ocupado) onClose(); }}
    className="m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl bg-white text-[#333436] shadow-xl backdrop:bg-slate-900/60">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <h2 id={id} className="text-lg font-bold">{titulo}</h2>
      <button type="button" disabled={ocupado} aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}
