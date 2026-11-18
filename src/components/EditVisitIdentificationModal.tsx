'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Visita } from '@/types';
import { VisitaRepository } from '@/services/repositoriosOperacionais';

export function EditVisitIdentificationModal({ visita, fechar, salvar }: {
  visita: Visita; fechar: () => void; salvar: (atualizada: Visita) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [numero, setNumero] = useState(visita.identificacao.match(/^AS-(\d+)-\d{4}$/)?.[1] ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const valido = /^\d{1,9}$/.test(numero) && Number(numero) > 0;
  const codigo = valido ? `AS-${String(Number(numero)).padStart(3, '0')}-${visita.data.slice(0, 4)}` : '';
  useEffect(() => {
    const elemento = dialogo.current;
    elemento?.showModal();
    return () => elemento?.close();
  }, []);

  return <dialog ref={dialogo} aria-labelledby={tituloId} onCancel={evento => {
    evento.preventDefault();
    if (!ocupado) fechar();
  }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/60">
    <h2 id={tituloId} className="text-lg font-bold text-[#333436]">Editar identificação do trabalho</h2>
    <p className="my-3 text-sm text-slate-600">{visita.identificacaoProjeto}</p>
    <form className="space-y-4" onSubmit={async evento => {
      evento.preventDefault();
      if (!valido || ocupado) return;
      setOcupado(true);
      setErro('');
      try { salvar(await VisitaRepository.editarIdentificacao(visita, Number(numero))); }
      catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a identificação.'); }
      finally { setOcupado(false); }
    }}>
      <label className="block text-sm font-semibold">Número do trabalho
        <input type="text" inputMode="numeric" maxLength={9} pattern="[0-9]{1,9}" required
          value={numero} disabled={ocupado} onChange={evento => setNumero(evento.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" />
      </label>
      {codigo && <p className="text-sm font-mono text-slate-600">{codigo}</p>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={ocupado} onClick={fechar} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Cancelar</button>
        <button type="submit" disabled={!valido || ocupado} className="rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  </dialog>;
}
