'use client';

import { useState } from 'react';
import { CheckCircle2, FileCheck2, RotateCcw } from 'lucide-react';
import type { Contrato, Fatura } from '@/types/financeiro';
import { dataBr, dataValida, hojeLocal, moeda, somarMeses } from '@/services/faturamento';
import { FinanceiroRepository } from '@/services/financeiroSupabase';
import { botaoFinanceiro, botaoSecundarioFinanceiro, campoFinanceiro, FinanceiroDialog } from './FinanceiroDialog';
import { DadosFaturaNFSe } from './DadosFaturaNFSe';
import { RevisaoNFSe } from './RevisaoNFSe';

type Linha = { contrato: Contrato; fatura: Fatura };
const nomeCliente = (c: Contrato) => c.clientes?.nome_razao_social ?? 'Cliente indisponível';
const nomeProjeto = (c: Contrato) => c.projetos?.nome ?? 'Projeto indisponível';
const tituloMes = (mes: string) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${mes}-01T12:00:00Z`));

export function FaturamentosPanel({ contratos, podeEditar, onChanged }: { contratos: Contrato[]; podeEditar: boolean; onChanged: () => void }) {
  const [mes, setMes] = useState(() => hojeLocal().slice(0, 7));
  const [cliente, setCliente] = useState('');
  const [situacao, setSituacao] = useState('todas');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [limiteFuturo, setLimiteFuturo] = useState(12);
  const [emissao, setEmissao] = useState<{ linha: Linha; emitida: boolean } | null>(null);
  const [dataEmissao, setDataEmissao] = useState(hojeLocal);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [dadosFatura, setDadosFatura] = useState<Linha | null>(null);
  const [revisar, setRevisar] = useState<string[] | null>(null);
  const linhas = contratos.flatMap(contrato => contrato.faturas.map(fatura => ({ contrato, fatura })));
  const base = linhas.filter(l => !cliente || l.contrato.cliente_id === cliente);
  const doMes = base.filter(l => l.fatura.data_faturamento.startsWith(mes));
  const vigentes = doMes.filter(l => l.contrato.situacao === 'vigente' || l.fatura.situacao === 'emitida');
  const exibidas = doMes.filter(l => situacao === 'todas' || l.fatura.situacao === situacao)
    .sort((a, b) => a.fatura.data_faturamento.localeCompare(b.fatura.data_faturamento) || a.contrato.titulo.localeCompare(b.contrato.titulo));
  const pendentes = doMes.filter(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente');
  const emitidas = doMes.filter(l => l.fatura.situacao === 'emitida');
  const somar = (lista: Linha[]) => lista.reduce((s, l) => s + l.fatura.valor_centavos, 0);
  const selecaoValida = pendentes.filter(l => selecionadas.has(l.fatura.id));
  const totalSelecionado = somar(selecaoValida);
  const clientes = [...new Map(contratos.map(c => [c.cliente_id, nomeCliente(c)])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const futuro = base.filter(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente' && l.fatura.data_faturamento.slice(0, 7) > mes)
    .sort((a, b) => a.fatura.data_faturamento.localeCompare(b.fatura.data_faturamento));
  const inicioProjecao = `${hojeLocal().slice(0, 7)}-01`;
  const projecao = Array.from({ length: 12 }, (_, i) => {
    const m = somarMeses(inicioProjecao, i).slice(0, 7);
    const itens = base.filter(l => l.fatura.data_faturamento.startsWith(m));
    return { mes: m, emitido: somar(itens.filter(l => l.fatura.situacao === 'emitida')),
      pendente: somar(itens.filter(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente')) };
  });
  const maximo = Math.max(1, ...projecao.map(p => p.emitido + p.pendente));
  const media = projecao.reduce((s, p) => s + p.emitido + p.pendente, 0) / 12;
  const porCliente = clientes.map(([id, nome]) => ({ id, nome,
    emitido: somar(emitidas.filter(l => l.contrato.cliente_id === id)),
    pendente: somar(pendentes.filter(l => l.contrato.cliente_id === id)),
  })).filter(c => c.emitido + c.pendente > 0).sort((a, b) => (b.emitido + b.pendente) - (a.emitido + a.pendente));

  function limparSelecao() { setSelecionadas(new Set()); setLimiteFuturo(12); }
  function selecionar(id: string, marcado: boolean) {
    setSelecionadas(atual => { const novo = new Set(atual); if (marcado) novo.add(id); else novo.delete(id); return novo; });
  }
  async function confirmarEmissao() {
    if (!emissao || ocupado) return;
    if (emissao.emitida && (!dataValida(dataEmissao) || dataEmissao > hojeLocal())) { setErro('Informe uma data de emissão válida, até a data de hoje.'); return; }
    setOcupado(true); setErro('');
    try {
      await FinanceiroRepository.registrarEmissao(emissao.linha.contrato, emissao.linha.fatura, emissao.emitida, dataEmissao);
      setAviso(emissao.emitida ? 'Emissão registrada. Nenhuma nota fiscal foi gerada pelo sistema.' : 'Fatura retornou à situação pendente.');
      setEmissao(null); limparSelecao(); onChanged();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a fatura.'); }
    finally { setOcupado(false); }
  }

  return <div className="space-y-5">
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Filtros de faturamento">
      <label className="space-y-1 text-xs font-semibold text-slate-600">Mês de referência<input type="month" min="1900-01" max="9999-12" className={campoFinanceiro} value={mes} onChange={e => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) { setMes(e.target.value); limparSelecao(); }
      }} /></label>
      <label className="min-w-44 flex-1 space-y-1 text-xs font-semibold text-slate-600">Cliente<select className={campoFinanceiro} value={cliente} onChange={e => { setCliente(e.target.value); limparSelecao(); }}><option value="">Todos os clientes</option>{clientes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">Situação da fatura<select className={campoFinanceiro} value={situacao} onChange={e => { setSituacao(e.target.value); setSelecionadas(new Set()); }}><option value="todas">Todas</option><option value="pendente">Pendentes</option><option value="emitida">Emitidas</option></select></label>
      <button type="button" onClick={() => { setMes(hojeLocal().slice(0, 7)); setCliente(''); setSituacao('todas'); limparSelecao(); }} className={botaoSecundarioFinanceiro}>Mês atual</button>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo financeiro">
      {[['Total programado no mês', somar(vigentes), 'text-[#333436]'], ['Emitido no mês', somar(emitidas), 'text-emerald-700'],
        ['Pendente no mês', somar(pendentes), 'text-[#00AFF0]'], ['Média mensal · horizonte de 12 meses', media, 'text-[#333436]']].map(([rotulo, valor, cor]) =>
        <div key={String(rotulo)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{rotulo}</p><p className={`mt-2 break-words text-lg font-bold tabular-nums sm:text-xl ${cor}`}>{moeda(Number(valor))}</p></div>)}
    </section>
    <p className="text-xs text-slate-500">Valores agrupados pela data programada de faturamento. Projeções incluem pendências de contratos vigentes e faturas emitidas; emissão não representa recebimento.</p>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div><h2 className="font-bold">Faturamentos de {tituloMes(mes)}</h2><p className="text-xs text-slate-500">{exibidas.length} fatura(s) · {selecaoValida.length} selecionada(s) · {moeda(totalSelecionado)}</p></div>
        {podeEditar && <div className="flex flex-wrap gap-2"><button type="button" disabled={!pendentes.length || situacao === 'emitida'} className={botaoSecundarioFinanceiro} onClick={() => setSelecionadas(new Set(pendentes.map(l => l.fatura.id)))}>Selecionar pendentes</button>
          <button type="button" disabled={!selecaoValida.length} className={botaoSecundarioFinanceiro} onClick={() => setRevisar(selecaoValida.map(l => l.fatura.id))}>Revisar NFS-e</button>
          <span title="A automação de NFS-e será disponibilizada em uma próxima etapa."><button type="button" disabled className={botaoFinanceiro}><FileCheck2 size={16} />Emitir NFse</button></span>
        </div>}
      </div>
      <p className="px-4 pt-3 text-xs text-slate-500">A emissão automática está em preparação. Use “Registrar emissão” somente para notas já emitidas fora do sistema.</p>
      {aviso && <p role="status" className="mx-4 mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
        {podeEditar && <th className="p-3"><input type="checkbox" aria-label="Selecionar todas as faturas pendentes visíveis" disabled={!exibidas.some(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente')}
          checked={exibidas.some(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente') && exibidas.filter(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente').every(l => selecionadas.has(l.fatura.id))}
          onChange={e => setSelecionadas(new Set(e.target.checked ? exibidas.filter(l => l.fatura.situacao === 'pendente' && l.contrato.situacao === 'vigente').map(l => l.fatura.id) : []))} /></th>}
        <th className="p-3">Cliente / Projeto</th><th className="p-3">Contrato / Parcela</th><th className="p-3">Faturamento</th><th className="p-3">Valor</th><th className="p-3">Situação</th><th className="p-3">Ações</th>
      </tr></thead><tbody className="divide-y divide-slate-100">{exibidas.map(l => <tr key={l.fatura.id} className="hover:bg-slate-50/70">
        {podeEditar && <td className="p-3"><input type="checkbox" aria-label={`Selecionar parcela ${l.fatura.numero} de ${l.contrato.titulo}`} disabled={l.fatura.situacao === 'emitida' || l.contrato.situacao !== 'vigente'} checked={selecaoValida.some(s => s.fatura.id === l.fatura.id)} onChange={e => selecionar(l.fatura.id, e.target.checked)} /></td>}
        <td className="max-w-64 p-3"><p className="font-medium">{nomeCliente(l.contrato)}</p><p className="text-xs text-slate-500">{nomeProjeto(l.contrato)}</p></td>
        <td className="p-3">{l.contrato.titulo}<p className="text-xs text-slate-500">Parcela {l.fatura.numero}/{l.contrato.parcelas}</p></td>
        <td className="whitespace-nowrap p-3">{dataBr(l.fatura.data_faturamento)}</td><td className="whitespace-nowrap p-3 font-semibold tabular-nums">{moeda(l.fatura.valor_centavos)}</td>
        <td className="p-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${l.fatura.situacao === 'emitida' ? 'bg-emerald-50 text-emerald-700' : l.contrato.situacao !== 'vigente' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>
          {l.fatura.situacao === 'emitida' && <CheckCircle2 size={13} />}{l.fatura.situacao === 'emitida' ? 'Emitida' : 'Pendente'}</span>
          {l.fatura.emitida_em && <p className="mt-1 text-xs text-slate-500">Emissão: {dataBr(l.fatura.emitida_em)}</p>}
          {l.contrato.situacao !== 'vigente' && <p className="mt-1 text-xs text-slate-500">Contrato {l.contrato.situacao} · fora da previsão pendente</p>}
        </td>
        <td className="p-3"><button type="button" onClick={() => setDadosFatura(l)} className="block rounded-lg p-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">Dados da NFS-e</button>{podeEditar && <button type="button" disabled={l.fatura.situacao === 'pendente' && l.contrato.situacao !== 'vigente'} onClick={() => {
          setEmissao({ linha: l, emitida: l.fatura.situacao !== 'emitida' }); setDataEmissao(hojeLocal()); setErro('');
        }} className="inline-flex items-center gap-1 rounded-lg p-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-40">
          {l.fatura.situacao === 'emitida' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}{l.fatura.situacao === 'emitida' ? 'Voltar a pendente' : 'Registrar emissão'}
        </button>}</td>
      </tr>)}</tbody></table></div>
      {!exibidas.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum faturamento encontrado para os filtros selecionados.</p>}
    </section>

    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Evolução e projeção de faturamento</h2><p className="mt-1 text-xs text-slate-500">12 meses, incluindo o mês atual · filtro de cliente aplicado</p>
        <div className="mt-3 flex gap-4 text-xs text-slate-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#A3CA33]" />Emitido</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#00AFF0]" />Pendente previsto</span></div>
        <div className="mt-4 space-y-2.5" role="img" aria-label="Projeção de faturamentos por mês; valores detalhados na tabela abaixo">
          {projecao.map(p => <div key={p.mes} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-xs"><span className="text-slate-600">{tituloMes(p.mes)}</span>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100"><span className="bg-[#A3CA33]" style={{ width: `${p.emitido / maximo * 100}%` }} /><span className="bg-[#00AFF0]" style={{ width: `${p.pendente / maximo * 100}%` }} /></div><span className="text-right tabular-nums">{moeda(p.emitido + p.pendente)}</span></div>)}
        </div>
        <details className="mt-4 text-xs"><summary className="cursor-pointer text-sky-700">Detalhamento mensal</summary><table className="mt-2 w-full text-right"><caption className="sr-only">Valores emitidos e pendentes no horizonte de 12 meses</caption><thead><tr><th className="py-2 text-left">Mês</th><th>Emitido</th><th>Pendente</th></tr></thead><tbody>{projecao.map(p => <tr key={p.mes}><td className="py-1 text-left">{tituloMes(p.mes)}</td><td>{moeda(p.emitido)}</td><td>{moeda(p.pendente)}</td></tr>)}</tbody></table></details>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Faturamento por cliente</h2><p className="mt-1 text-xs text-slate-500">Mês de referência: {tituloMes(mes)}</p>
        <div className="mt-4 max-h-96 space-y-4 overflow-y-auto">{porCliente.map(c => <div key={c.id} className="border-b border-slate-100 pb-3"><p className="text-sm font-semibold">{c.nome}</p><p className="mt-1 text-sm font-bold">{moeda(c.emitido + c.pendente)}</p><p className="text-xs text-slate-500">Emitido: {moeda(c.emitido)} · Pendente: {moeda(c.pendente)}</p></div>)}
          {!porCliente.length && <p className="text-sm text-slate-500">Sem faturamentos previstos ou emitidos neste mês.</p>}</div>
      </section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Faturamentos futuros</h2><span className="text-sm font-semibold">{futuro.length} parcela(s) · {moeda(somar(futuro))}</span></div><p className="mt-1 text-xs text-slate-500">Pendências de contratos vigentes após {tituloMes(mes)}.</p>
      <ul className="mt-3 divide-y divide-slate-100">{futuro.slice(0, limiteFuturo).map(l => <li key={l.fatura.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-semibold">{nomeCliente(l.contrato)} · {nomeProjeto(l.contrato)}</p><p className="text-xs text-slate-500">{l.contrato.titulo} · Parcela {l.fatura.numero}/{l.contrato.parcelas} · {dataBr(l.fatura.data_faturamento)}</p></div><strong className="tabular-nums">{moeda(l.fatura.valor_centavos)}</strong></li>)}</ul>
      {!futuro.length && <p className="py-4 text-sm text-slate-500">Nenhum faturamento futuro programado.</p>}
      {futuro.length > limiteFuturo && <button type="button" className={botaoSecundarioFinanceiro} onClick={() => setLimiteFuturo(l => l + 24)}>Mostrar mais faturamentos</button>}
    </section>
    {dadosFatura && <DadosFaturaNFSe contrato={dadosFatura.contrato} fatura={dadosFatura.fatura} podeEditar={podeEditar} onClose={() => setDadosFatura(null)} onSaved={() => {
      setDadosFatura(null); setAviso('Dados da fatura salvos no Supabase.'); onChanged();
    }} />}
    {revisar && <RevisaoNFSe ids={revisar} onClose={() => setRevisar(null)} />}
    {emissao && <FinanceiroDialog titulo={emissao.emitida ? 'Registrar emissão da fatura' : 'Retornar fatura a pendente'} ocupado={ocupado} onClose={() => setEmissao(null)}>
      <form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); void confirmarEmissao(); }}><p className="text-sm">{emissao.linha.contrato.titulo} · Parcela {emissao.linha.fatura.numero} · <strong>{moeda(emissao.linha.fatura.valor_centavos)}</strong></p>
        <p className="text-sm text-slate-600">{emissao.emitida ? 'Confirme apenas se a nota fiscal já foi emitida. Esta ação registra a situação financeira e não emite uma NFS-e.' : 'Esta ação corrige a situação da fatura no Delta CorteX. Ela não cancela uma nota fiscal no órgão emissor.'}</p>
        {emissao.emitida && <label className="block space-y-1 text-sm">Data da emissão<input required type="date" min="1900-01-01" max={hojeLocal()} disabled={ocupado} className={campoFinanceiro} value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} /></label>}
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <footer className="flex justify-end gap-3"><button type="button" disabled={ocupado} className={botaoSecundarioFinanceiro} onClick={() => setEmissao(null)}>Cancelar</button><button disabled={ocupado} className={botaoFinanceiro}>{ocupado ? 'Salvando…' : 'Confirmar'}</button></footer>
      </form>
    </FinanceiroDialog>}
  </div>;
}
