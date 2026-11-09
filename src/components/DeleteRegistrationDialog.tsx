'use client';

import { useState } from 'react';
import { TechnicianDialog, botaoNeutro } from './TechnicianModal';

export function ConfirmarExclusaoCadastro({ tipo, nome, onClose, onConfirm, mensagemErro }: {
  tipo: 'Cliente' | 'Projeto'; nome: string; onClose: () => void; onConfirm: () => Promise<void>;
  mensagemErro?: (erro: unknown) => string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entidade = tipo.toLowerCase();

  async function confirmar() {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try { await onConfirm(); }
    catch (falha) { setErro(mensagemErro?.(falha) ?? `Não foi possível excluir o ${entidade}.`); }
    finally { setOcupado(false); }
  }

  return <TechnicianDialog titulo={`Excluir ${tipo}`} onClose={onClose} ocupado={ocupado}>
    <div className="space-y-4 p-5">
      <p>Tem certeza de que deseja excluir este {entidade} do cadastro?</p>
      <p className="break-words font-semibold">{nome}</p>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={botaoNeutro} disabled={ocupado} onClick={onClose}>Cancelar</button>
        <button type="button" className="min-h-10 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? 'Excluindo…' : `Excluir ${tipo}`}</button>
      </div>
    </div>
  </TechnicianDialog>;
}
