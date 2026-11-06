'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDown, Mail, MessageCircle, Share2, X } from 'lucide-react';
import { RelatorioVisita } from '@/types';
import { RelatorioRepository } from '@/services/storage';
import { baixarRelatorio } from '@/services/reportDownload';

const titulo = 'Relatório de Acompanhamento Sistemático';
const indisponivel = 'Não foi possível localizar o arquivo PDF deste relatório.';

export function ShareReportModal({ visitaId, projeto, data, onClose }: {
  visitaId: string; projeto: string; data: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preparado, setPreparado] = useState<{ relatorio: RelatorioVisita; arquivo: File; nativo: boolean }>();
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const assunto = `${titulo} - ${projeto}`;
  const mensagem = `Segue o ${titulo} referente ao projeto ${projeto}, realizado em ${data}.`;
  const botao = 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';

  useEffect(() => {
    const elemento = dialog.current;
    elemento?.showModal();
    return () => elemento?.close();
  }, []);

  useEffect(() => {
    let ativo = true;
    void RelatorioRepository.listarPorVisita(visitaId).then(([relatorio]) => {
      if (!relatorio || !(relatorio.pdf instanceof Blob) || !relatorio.pdf.size) throw new Error(indisponivel);
      const nomeAlternativo = `RAS_${visitaId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const arquivo = new File([relatorio.pdf], relatorio.nomeArquivo || nomeAlternativo, { type: 'application/pdf' });
      let nativo = false;
      try {
        nativo = typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] });
      } catch { /* O navegador pode bloquear o compartilhamento por política. */ }
      if (ativo) setPreparado({ relatorio, arquivo, nativo });
    }).catch(() => { if (ativo) setErro(indisponivel); });
    return () => { ativo = false; };
  }, [visitaId]);

  async function compartilhar() {
    if (!preparado?.nativo || ocupado) return;
    setErro('');
    setOcupado(true);
    try {
      await navigator.share({ files: [preparado.arquivo], title: titulo, text: assunto });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setErro('Não foi possível abrir o compartilhamento. Você pode baixar o PDF e anexá-lo manualmente.');
      }
    } finally {
      setOcupado(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="compartilhar-relatorio-titulo"
    onCancel={e => { e.preventDefault(); if (!ocupado) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-[#333436] shadow-xl backdrop:bg-slate-900/60">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id="compartilhar-relatorio-titulo" className="text-lg font-bold">Compartilhar Relatório</h2>
      <button type="button" aria-label="Fechar" disabled={ocupado} onClick={onClose} className="rounded-lg p-3 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
    </div>
    {!preparado && !erro && <p role="status" className="mb-3 text-sm text-slate-600">Carregando PDF…</p>}
    {erro && <p role="alert" className="mb-3 text-sm text-red-700">{erro}</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={!preparado?.nativo || ocupado} onClick={compartilhar}
        className="col-span-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#00AFF0] px-3 py-2 text-sm font-semibold text-[#333436] disabled:opacity-50">
        <Share2 className="h-4 w-4" /> {ocupado ? 'Abrindo compartilhamento…' : 'Compartilhar arquivo'}
      </button>
      {preparado && <>
        <a href={`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`} className={botao}>
          <Mail className="h-4 w-4" /> E-mail
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" className={botao}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" className={botao} onClick={() => {
          try { baixarRelatorio(preparado.relatorio); }
          catch { setErro(indisponivel); }
        }}><FileDown className="h-4 w-4" /> Baixar PDF</button>
      </>}
    </div>
    {preparado && <p className="mt-3 text-xs text-slate-600">
      {!preparado.nativo && 'O navegador não oferece compartilhamento nativo deste arquivo. '}
      As opções de E-mail e WhatsApp abrem apenas a mensagem. Baixe o PDF e anexe-o manualmente.
    </p>}
  </dialog>;
}
