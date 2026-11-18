'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, Calculator } from 'lucide-react';
import type { Cliente, Projeto } from '@/types';
import { periodicidades, situacoesContrato, type Contrato, type Fatura, type Periodicidade, type SituacaoContrato } from '@/types/financeiro';
import { FinanceiroRepository } from '@/services/financeiroSupabase';
import { dataValida, datasAutomaticas, distribuirCentavos, lerCentavos, MAX_PARCELAS, mesesPorPeriodo, moeda, valorEditavel } from '@/services/faturamento';
import { botaoFinanceiro, botaoSecundarioFinanceiro, campoFinanceiro, FinanceiroDialog } from './FinanceiroDialog';

type ParcelaForm = { id: string; data: string; valor: string; emitida: boolean; emitidaEm: string | null };
const novaParcela = (): ParcelaForm => ({ id: crypto.randomUUID(), data: '', valor: '', emitida: false, emitidaEm: null });
function Campo({ titulo, children, largo = false }: { titulo: string; children: ReactNode; largo?: boolean }) {
  return <label className={`block min-w-0 space-y-1.5 text-sm font-medium ${largo ? 'sm:col-span-2' : ''}`}><span>{titulo}</span>{children}</label>;
}

export function ContratoForm({ contrato, clientes, projetos, readOnly = false, onClose, onSaved }: {
  contrato?: Contrato; clientes: Cliente[]; projetos: Projeto[]; readOnly?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [id] = useState(() => contrato?.id ?? crypto.randomUUID());
  const [titulo, setTitulo] = useState(contrato?.titulo ?? '');
  const [clienteId, setClienteId] = useState(contrato?.cliente_id ?? '');
  const [projetoId, setProjetoId] = useState(contrato?.projeto_id ?? '');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [vigencia, setVigencia] = useState(contrato?.vigencia ?? '');
  const [periodo, setPeriodo] = useState<Periodicidade>(contrato?.faturamento ?? 'mensal');
  const [primeiro, setPrimeiro] = useState(contrato?.primeiro_faturamento ?? '');
  const [total, setTotal] = useState(contrato ? valorEditavel(contrato.valor_total_centavos) : '');
  const [situacao, setSituacao] = useState<SituacaoContrato>(contrato?.situacao ?? 'vigente');
  const [textoNF, setTextoNF] = useState(contrato?.texto_nfse ?? '');
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(() => contrato?.faturas.map(f => ({ id: f.id,
    data: f.data_faturamento, valor: valorEditavel(f.valor_centavos), emitida: f.situacao === 'emitida', emitidaEm: f.emitida_em,
  })) ?? [novaParcela()]);
  const [quantidade, setQuantidade] = useState(String(parcelas.length));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const temEmitidas = parcelas.some(p => p.emitida);
  const automatico = !!mesesPorPeriodo[periodo];
  const datas = automatico ? datasAutomaticas(primeiro, periodo, parcelas.length) : parcelas.map(p => p.data);
  const centavos = lerCentavos(total);
  const soma = parcelas.reduce((s, p) => s + (lerCentavos(p.valor) ?? 0), 0);
  const compativeis = projetos.filter(p => p.clienteId === clienteId);
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const opcoesClientes = clientes.filter(c => c.id === clienteId || normalizar(c.nomeRazaoSocial).includes(normalizar(buscaCliente)));

  function mudarQuantidade(valor: string) {
    setQuantidade(valor);
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) return;
    if (parcelas.slice(n).some(p => p.emitida)) {
      setErro('Uma parcela emitida não pode ser removida.');
      return;
    }
    setErro('');
    setParcelas(atual => Array.from({ length: n }, (_, i) => atual[i] ?? novaParcela()));
  }
  function distribuir() {
    if (centavos === null || centavos <= 0) { setErro('Informe um valor total válido em reais.'); return; }
    const fixo = parcelas.filter(p => p.emitida).reduce((s, p) => s + (lerCentavos(p.valor) ?? 0), 0);
    const livres = parcelas.filter(p => !p.emitida).length;
    if (!livres || centavos - fixo < livres) { setErro('O total deve comportar as faturas emitidas e ao menos R$ 0,01 por parcela pendente.'); return; }
    const valores = distribuirCentavos(centavos - fixo, livres);
    let i = 0;
    setParcelas(parcelas.map(p => p.emitida ? p : { ...p, valor: valorEditavel(valores[i++]) }));
    setErro('');
  }
  function editarParcela(i: number, dados: Partial<ParcelaForm>) {
    setParcelas(parcelas.map((p, indice) => indice === i ? { ...p, ...dados } : p));
  }
  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado || readOnly) return;
    setErro('');
    if (!titulo.trim() || !clienteId || !projetoId || !dataValida(vigencia)) { setErro('Preencha identificação, cliente, projeto e vigência.'); return; }
    if (Number(quantidade) !== parcelas.length || !Number.isInteger(Number(quantidade))) { setErro(`Informe de 1 a ${MAX_PARCELAS} parcelas, preservando as faturas emitidas.`); return; }
    if (centavos === null || centavos <= 0 || parcelas.some(p => !lerCentavos(p.valor))) { setErro('Informe valores positivos com até duas casas decimais.'); return; }
    if (soma !== centavos) { setErro('A soma das faturas deve ser igual ao valor total do contrato.'); return; }
    if (datas.length !== parcelas.length || datas.some(d => !dataValida(d) || d > vigencia)) {
      setErro('Todas as datas de faturamento devem ser válidas e estar dentro da vigência. Revise a quantidade ou o primeiro faturamento.'); return;
    }
    if (contrato?.faturas.some(f => f.situacao === 'emitida' && !parcelas.some((p, i) => p.id === f.id && i + 1 === f.numero
      && datas[i] === f.data_faturamento && lerCentavos(p.valor) === f.valor_centavos))) {
      setErro('O novo calendário altera uma fatura emitida. Preserve sua data, valor e número.'); return;
    }
    setOcupado(true);
    try {
      const faturas: Fatura[] = parcelas.map((p, i) => ({ id: p.id, contrato_id: id, numero: i + 1,
        data_faturamento: datas[i], valor_centavos: lerCentavos(p.valor)!, situacao: p.emitida ? 'emitida' : 'pendente', emitida_em: p.emitidaEm,
      }));
      await FinanceiroRepository.salvar({ id, titulo: titulo.trim(), cliente_id: clienteId, projeto_id: projetoId,
        vigencia, parcelas: parcelas.length, faturamento: periodo, primeiro_faturamento: automatico ? primeiro : null,
        valor_total_centavos: centavos, texto_nfse: textoNF.trim(), situacao,
      }, faturas, contrato?.atualizado_em ?? null);
      onSaved();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar o contrato.'); }
    finally { setOcupado(false); }
  }
  return <FinanceiroDialog titulo={readOnly ? 'Visualizar Contrato' : contrato ? 'Editar Contrato' : 'Novo Contrato'} ocupado={ocupado} onClose={onClose}>
    <form onSubmit={salvar} className="space-y-5 p-5">
      <fieldset disabled={ocupado || readOnly} className="grid gap-4 sm:grid-cols-2 disabled:opacity-90">
        <Campo titulo="Identificação do contrato *" largo><input className={campoFinanceiro} required maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Número ou nome do contrato" /></Campo>
        <Campo titulo="Cliente Contratante *">
          {!readOnly && !temEmitidas && <input aria-label="Pesquisar cliente" className={`${campoFinanceiro} mb-2`} placeholder="Pesquisar cliente" value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />}
          <select required disabled={temEmitidas || readOnly} className={campoFinanceiro} value={clienteId} onChange={e => { setClienteId(e.target.value); setProjetoId(''); }}>
            <option value="">Selecionar cliente</option>
            {opcoesClientes.map(c => <option key={c.id} value={c.id}>{c.nomeRazaoSocial}</option>)}
            {contrato && !clientes.some(c => c.id === contrato.cliente_id) && <option value={contrato.cliente_id}>{contrato.clientes?.nome_razao_social ?? 'Cliente indisponível'} (cadastro inativo)</option>}
          </select>
        </Campo>
        <Campo titulo="Projeto *"><select required disabled={!clienteId || temEmitidas || readOnly} className={campoFinanceiro} value={projetoId} onChange={e => setProjetoId(e.target.value)}>
          <option value="">Selecionar projeto do cliente</option>
          {compativeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          {contrato && clienteId === contrato.cliente_id && !compativeis.some(p => p.id === contrato.projeto_id) && <option value={contrato.projeto_id}>{contrato.projetos?.nome ?? 'Projeto indisponível'} (cadastro inativo)</option>}
        </select></Campo>
        <Campo titulo="Vigência — data final *"><input type="date" required min="1900-01-01" max="9999-12-31" className={campoFinanceiro} value={vigencia} onChange={e => setVigencia(e.target.value)} /></Campo>
        <Campo titulo="Situação"><select className={campoFinanceiro} value={situacao} onChange={e => setSituacao(e.target.value as SituacaoContrato)}>{Object.entries(situacoesContrato).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>
        <Campo titulo="Parcelas *"><input type="number" required min={1} max={MAX_PARCELAS} step={1} className={campoFinanceiro} value={quantidade} onChange={e => mudarQuantidade(e.target.value)} /></Campo>
        <Campo titulo="Faturamento *"><select className={campoFinanceiro} value={periodo} onChange={e => {
          const novo = e.target.value as Periodicidade;
          if (!mesesPorPeriodo[novo]) setParcelas(parcelas.map((p, i) => ({ ...p, data: datas[i] || p.data })));
          else if (!primeiro && parcelas[0]?.data) setPrimeiro(parcelas[0].data);
          setPeriodo(novo);
        }}>{Object.entries(periodicidades).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>
        {automatico && <Campo titulo="Primeiro faturamento *"><input type="date" required min="1900-01-01" max={vigencia || '9999-12-31'} className={campoFinanceiro} value={primeiro} onChange={e => setPrimeiro(e.target.value)} /></Campo>}
        <Campo titulo="Valor total do contrato (R$) *"><input required inputMode="decimal" className={campoFinanceiro} value={total} onChange={e => setTotal(e.target.value)} placeholder="0,00" /></Campo>
        <Campo titulo="Texto para a nota fiscal" largo><textarea rows={3} maxLength={10000} className={campoFinanceiro} value={textoNF} onChange={e => setTextoNF(e.target.value)} placeholder="Descrição dos serviços que constará na nota fiscal" /></Campo>
      </fieldset>
      <section className="space-y-3" aria-label="Calendário de faturamento">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Calendário de faturamento</h3>
          {!readOnly && <button type="button" disabled={ocupado} onClick={distribuir} className={botaoSecundarioFinanceiro}><Calculator size={16} />Distribuir valor</button>}
        </div>
        <p className="text-xs text-slate-500">{automatico ? 'Datas calculadas a partir do primeiro faturamento, preservando o dia de referência. ' : 'Informe manualmente a data de cada parcela. '}
          Ajuste os valores individuais conforme o contrato. Faturas emitidas têm data e valor preservados.</p>
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[480px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Parcela</th><th className="p-3">Data de faturamento</th><th className="p-3">Valor (R$)</th><th className="p-3">Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{parcelas.map((p, i) => <tr key={p.id}>
              <td className="p-3">{i + 1}/{parcelas.length}</td>
              <td className="p-2"><input aria-label={`Data da parcela ${i + 1}`} type="date" required min="1900-01-01" max={vigencia || '9999-12-31'} disabled={readOnly || ocupado || automatico || p.emitida} className={campoFinanceiro} value={datas[i] ?? ''} onChange={e => editarParcela(i, { data: e.target.value })} /></td>
              <td className="p-2"><input aria-label={`Valor da parcela ${i + 1}`} required inputMode="decimal" disabled={readOnly || ocupado || p.emitida} className={campoFinanceiro} value={p.valor} onChange={e => editarParcela(i, { valor: e.target.value })} /></td>
              <td className="p-3 text-xs">{p.emitida ? 'Emitida' : 'Pendente'}</td>
            </tr>)}</tbody></table>
        </div>
        <div className={`flex flex-wrap justify-between gap-2 text-sm ${centavos !== null && soma === centavos ? 'text-emerald-700' : 'text-amber-700'}`}>
          <span>Soma das parcelas: <strong>{moeda(soma)}</strong></span><span>Diferença: <strong>{moeda((centavos ?? 0) - soma)}</strong></span>
        </div>
      </section>
      {situacao !== 'vigente' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">As parcelas pendentes de contratos {situacao === 'paralisado' ? 'paralisados' : 'encerrados'} ficam fora das projeções. Faturas já emitidas permanecem no histórico.</p>}
      {erro && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{erro}</p>}
      <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={ocupado} onClick={onClose} className={botaoSecundarioFinanceiro}>{readOnly ? 'Fechar' : 'Cancelar'}</button>
        {!readOnly && <button type="submit" disabled={ocupado} className={botaoFinanceiro}>{ocupado ? 'Salvando…' : 'Salvar Contrato'}</button>}
      </footer>
    </form>
  </FinanceiroDialog>;
}
