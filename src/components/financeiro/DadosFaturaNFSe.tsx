'use client';

import { useState } from 'react';
import type { Contrato, Fatura } from '@/types/financeiro';
import { NFSeRepository } from '@/services/nfseSupabase';
import { dataBr, dataValida, moeda } from '@/services/faturamento';
import { formatarPercentual } from '@/services/nfse';
import { botaoFinanceiro, botaoSecundarioFinanceiro, campoFinanceiro, FinanceiroDialog } from './FinanceiroDialog';

export function DadosFaturaNFSe({ contrato, fatura, podeEditar, onClose, onSaved }: {
  contrato: Contrato; fatura: Fatura; podeEditar: boolean; onClose: () => void; onSaved: () => void;
}) {
  const editavel = podeEditar && fatura.situacao === 'pendente';
  const [competencia, setCompetencia] = useState(fatura.competencia_nfse ?? '');
  const [periodo, setPeriodo] = useState(fatura.periodo_servicos ?? '');
  const [descricao, setDescricao] = useState(fatura.descricao_nfse ?? (editavel ? contrato.texto_nfse : ''));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const snapshot = fatura.preparacao_emissao;
  return <FinanceiroDialog titulo={editavel ? 'Preparar dados da NFS-e' : 'Dados fiscais da fatura'} ocupado={ocupado} onClose={onClose}>
    <form className="space-y-4 p-5" onSubmit={async e => {
      e.preventDefault(); if (ocupado || !editavel) return;
      if (!dataValida(competencia) || !periodo.trim() || !descricao.trim()) { setErro('Preencha competência fiscal, período dos serviços e descrição da nota.'); return; }
      setOcupado(true); setErro('');
      try { await NFSeRepository.salvarFatura(contrato, fatura, { competencia, periodo, descricao }); onSaved(); }
      catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar os dados da fatura.'); }
      finally { setOcupado(false); }
    }}>
      <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{contrato.titulo} · Parcela {fatura.numero}/{contrato.parcelas}</p><p>{contrato.clientes?.nome_razao_social} · {contrato.projetos?.nome}</p><p className="mt-1">Faturamento: {dataBr(fatura.data_faturamento)} · Valor vinculado: <strong>{moeda(fatura.valor_centavos)}</strong></p></div>
      <p className="text-xs text-slate-500">A competência fiscal e o período dos serviços são independentes da data programada de faturamento. O percentual mensal será buscado pelo mês da competência fiscal, sem utilizar outro mês como alternativa.</p>
      <fieldset disabled={!editavel || ocupado} className="space-y-4">
        <label className="block space-y-1 text-sm font-medium">Competência fiscal *<input type="date" required min="1900-01-01" max="9999-12-31" className={campoFinanceiro} value={competencia} onChange={e => setCompetencia(e.target.value)} /></label>
        <label className="block space-y-1 text-sm font-medium">Período dos serviços *<input required maxLength={200} placeholder="Ex.: Outubro/2026" className={campoFinanceiro} value={periodo} onChange={e => setPeriodo(e.target.value)} /></label>
        <label className="block space-y-1 text-sm font-medium">Descrição da nota fiscal *<textarea required rows={6} maxLength={10000} className={campoFinanceiro} value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
      </fieldset>
      {editavel && <p className="text-xs text-slate-500">O texto do contrato é a referência inicial. Os ajustes salvos aqui pertencem somente a esta fatura. Edite o valor pelo calendário do contrato.</p>}
      {fatura.situacao === 'emitida' && <section className="space-y-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900"><p>Fatura emitida: dados fiscais bloqueados para edição.</p>
        {snapshot ? <><p className="text-xs">Preparação preservada no momento do registro manual da emissão; não substitui o XML da nota autorizada externamente.</p><details><summary className="cursor-pointer">Consultar preparação preservada</summary><dl className="mt-2 space-y-2 text-xs">
          <div><dt className="font-semibold">Emitente</dt><dd>{snapshot.emitente?.razao_social ?? 'Não informado'} · {snapshot.emitente?.cnpj ?? 'CNPJ não informado'}</dd></div>
          <div><dt className="font-semibold">Tomador</dt><dd>{snapshot.tomador?.nome ?? 'Não informado'} · {snapshot.tomador?.cpf_cnpj ?? 'Documento não informado'}</dd></div>
          <div><dt className="font-semibold">Competência / Período</dt><dd>{snapshot.competencia ? dataBr(snapshot.competencia) : 'Não informada'} · {snapshot.periodo ?? 'Não informado'}</dd></div>
          <div><dt className="font-semibold">Percentual aproximado do Simples</dt><dd>{snapshot.percentual ? formatarPercentual(snapshot.percentual.percentual_centesimos) : 'Não cadastrado para a competência'}</dd></div>
          <div><dt className="font-semibold">Valor / Descrição</dt><dd className="whitespace-pre-wrap break-words">{moeda(snapshot.valor_centavos)} · {snapshot.descricao ?? 'Não informada'}</dd></div>
        </dl></details></>
          : <p className="text-xs">Esta fatura não possui preparação fiscal preservada. Nenhuma informação histórica foi reconstruída automaticamente.</p>}
      </section>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <footer className="flex justify-end gap-3"><button type="button" disabled={ocupado} className={botaoSecundarioFinanceiro} onClick={onClose}>{editavel ? 'Cancelar' : 'Fechar'}</button>{editavel && <button disabled={ocupado} className={botaoFinanceiro}>{ocupado ? 'Salvando…' : 'Salvar dados da fatura'}</button>}</footer>
    </form>
  </FinanceiroDialog>;
}
