'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';

interface EventoInstalacao extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallAppButton() {
  const eventoInstalacao = useRef<EventoInstalacao | null>(null);
  const instrucoesId = useId();
  const [instalado, setInstalado] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [instrucoes, setInstrucoes] = useState<'ios' | 'navegador'>();

  useEffect(() => {
    const modoApp = window.matchMedia('(display-mode: standalone)');
    const atualizarModo = () => {
      const navegador = navigator as Navigator & { standalone?: boolean };
      setInstalado(modoApp.matches || navegador.standalone === true);
    };
    const prepararInstalacao = (evento: Event) => {
      evento.preventDefault();
      eventoInstalacao.current = evento as EventoInstalacao;
    };
    const concluirInstalacao = () => {
      eventoInstalacao.current = null;
      setInstalado(true);
    };

    atualizarModo();
    modoApp.addEventListener('change', atualizarModo);
    window.addEventListener('beforeinstallprompt', prepararInstalacao);
    window.addEventListener('appinstalled', concluirInstalacao);
    return () => {
      modoApp.removeEventListener('change', atualizarModo);
      window.removeEventListener('beforeinstallprompt', prepararInstalacao);
      window.removeEventListener('appinstalled', concluirInstalacao);
    };
  }, []);

  function mostrarInstrucoes() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    setInstrucoes(ios ? 'ios' : 'navegador');
  }

  async function instalar() {
    const evento = eventoInstalacao.current;
    if (!evento) {
      mostrarInstrucoes();
      return;
    }
    eventoInstalacao.current = null;
    setInstalando(true);
    setInstrucoes(undefined);
    try {
      const resposta = await evento.prompt();
      if (resposta.outcome === 'accepted') setInstalado(true);
    } catch {
      mostrarInstrucoes();
    } finally {
      setInstalando(false);
    }
  }

  if (instalado) return null;

  return <div className="space-y-2">
    <button type="button" onClick={() => void instalar()} disabled={instalando}
      aria-describedby={instrucoes ? instrucoesId : undefined}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-[#333436] hover:bg-slate-50 disabled:opacity-50">
      <Download size={18} aria-hidden />
      {instalando ? 'Abrindo instalação…' : 'Baixar aplicativo'}
    </button>
    {instrucoes && <p id={instrucoesId} role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
      {instrucoes === 'ios'
        ? <>No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Se aparecer a opção <strong>Abrir como App da Web</strong>, ative-a e toque em <strong>Adicionar</strong>.</>
        : <>No menu do navegador, procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</>}
    </p>}
  </div>;
}
