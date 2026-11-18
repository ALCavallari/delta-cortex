'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import type { ConfiguracaoNFSe, ContextoNFSe } from '@/types/nfse';
import { NFSeRepository } from '@/services/nfseSupabase';
import { configuracaoInicialNFSe, formatarPercentual, lerPercentual, pendenciasConfiguracao } from '@/services/nfse';
import { hojeLocal } from '@/services/faturamento';
import { botaoFinanceiro, botaoSecundarioFinanceiro, campoFinanceiro } from './FinanceiroDialog';

type Dados = Omit<ConfiguracaoNFSe, 'atualizado_em'>;
const campos: { campo: keyof Dados; titulo: string; max: number; opcional?: boolean }[] = [
  { campo: 'razao_social', titulo: 'Razão social', max: 200 }, { campo: 'cnpj', titulo: 'CNPJ', max: 18 },
  { campo: 'inscricao_municipal', titulo: 'Inscrição Municipal (se houver)', max: 30, opcional: true },
  { campo: 'email', titulo: 'E-mail', max: 254 }, { campo: 'telefone', titulo: 'Telefone', max: 20 },
  { campo: 'cep', titulo: 'CEP', max: 9 }, { campo: 'logradouro', titulo: 'Logradouro', max: 200 },
  { campo: 'numero', titulo: 'Número', max: 30 }, { campo: 'complemento', titulo: 'Complemento', max: 200, opcional: true },
  { campo: 'bairro', titulo: 'Bairro', max: 100 }, { campo: 'municipio', titulo: 'Município', max: 100 },
  { campo: 'codigo_municipio', titulo: 'Código IBGE do município', max: 7 }, { campo: 'uf', titulo: 'UF', max: 2 },
  { campo: 'codigo_tributacao_nacional', titulo: 'Código de tributação nacional', max: 6 },
  { campo: 'codigo_tributacao_municipal', titulo: 'Código de tributação municipal', max: 3 },
  { campo: 'codigo_nbs', titulo: 'Código NBS', max: 9 }, { campo: 'descricao_servico', titulo: 'Descrição do serviço', max: 200 },
];

function FormularioConfiguracao({ contexto, podeEditar, onSaved }: { contexto: ContextoNFSe; podeEditar: boolean; onSaved: () => void }) {
  const [dados, setDados] = useState<Dados>(() => contexto.configuracao ?? configuracaoInicialNFSe);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!podeEditar || ocupado) return;
    const normalizado = Object.fromEntries(Object.keys(configuracaoInicialNFSe).map(k => [k, dados[k as keyof Dados].trim()])) as Dados;
    for (const c of ['cnpj', 'telefone', 'cep'] as const) normalizado[c] = normalizado[c].replace(/\D/g, '');
    const pendencias = pendenciasConfiguracao(normalizado);
    if (pendencias.length) { setErro(pendencias.join(' ')); return; }
    setOcupado(true); setErro('');
    try { await NFSeRepository.salvarConfiguracao(normalizado, contexto.configuracao?.atualizado_em ?? null); onSaved(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar os dados fiscais.'); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={salvar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold">Emitente e serviço padrão</h2>
    <p className="text-sm text-slate-600">Regime: Simples Nacional, com tributos federais e municipal pelo Simples. Os códigos do serviço serão usados como padrão para todos os contratos.</p>
    {!contexto.configuracao && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Os códigos e o município estão preenchidos como referência da nota analisada. Confira e salve os dados da empresa. Nenhum dado foi importado automaticamente.</p>}
    <fieldset disabled={!podeEditar || ocupado} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campos.map(c => <label key={c.campo} className="space-y-1 text-sm font-medium">{c.titulo}{!c.opcional && ' *'}
        <input className={campoFinanceiro} required={!c.opcional} maxLength={c.max} type={c.campo === 'email' ? 'email' : 'text'} value={dados[c.campo]}
          onChange={e => setDados({ ...dados, [c.campo]: c.campo === 'uf' ? e.target.value.toUpperCase() : e.target.value })} />
      </label>)}
    </fieldset>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    {podeEditar && <div className="flex justify-end"><button disabled={ocupado} className={botaoFinanceiro}><Save size={16} />{ocupado ? 'Salvando…' : 'Salvar configuração'}</button></div>}
  </form>;
}

function PercentuaisMensais({ contexto, podeEditar, onSaved }: { contexto: ContextoNFSe; podeEditar: boolean; onSaved: () => void }) {
  const [mes, setMes] = useState(() => hojeLocal().slice(0, 7));
  const selecionado = contexto.percentuais.find(p => p.id === `${mes}-01`);
  const [percentual, setPercentual] = useState(() => selecionado ? (selecionado.percentual_centesimos / 100).toFixed(2).replace('.', ',') : '');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  function selecionarMes(valor: string) {
    const atual = contexto.percentuais.find(p => p.id === `${valor}-01`);
    setMes(valor); setPercentual(atual ? (atual.percentual_centesimos / 100).toFixed(2).replace('.', ',') : ''); setErro('');
  }
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (ocupado || !podeEditar) return;
    const valor = lerPercentual(percentual);
    if (valor === null || !/^\d{4}-\d{2}$/.test(mes)) { setErro('Informe o mês e um percentual de 0 a 100, com até duas casas decimais.'); return; }
    setOcupado(true); setErro('');
    try { await NFSeRepository.salvarPercentual(mes, valor, selecionado?.atualizado_em ?? null); onSaved(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar o percentual.'); }
    finally { setOcupado(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold">Percentual mensal do Simples Nacional</h2>
    <p className="text-sm text-slate-600">Percentual aproximado dos tributos (pTotTribSN), informado pela contabilidade. Não é a alíquota de ISS. O mês deve corresponder à competência fiscal escolhida na fatura.</p>
    {podeEditar && <form onSubmit={salvar} className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm font-medium">Mês / ano<input required type="month" min="1900-01" max="9999-12" className={campoFinanceiro} disabled={ocupado} value={mes} onChange={e => selecionarMes(e.target.value)} /></label>
      <label className="space-y-1 text-sm font-medium">Percentual (%)<input required inputMode="decimal" placeholder="Ex.: 14,23" className={campoFinanceiro} disabled={ocupado} value={percentual} onChange={e => setPercentual(e.target.value)} /></label>
      <button disabled={ocupado} className={botaoFinanceiro}>{ocupado ? 'Salvando…' : selecionado ? 'Atualizar percentual' : 'Cadastrar percentual'}</button>
      <p className="w-full text-xs text-slate-500">Alterações não modificam a preparação já registrada ao marcar uma fatura como emitida. Meses sem cadastro não recebem o percentual de outro mês.</p>
    </form>}
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Competência</th><th className="p-3">Percentual aproximado</th>{podeEditar && <th className="p-3">Ação</th>}</tr></thead>
      <tbody className="divide-y divide-slate-100">{[...contexto.percentuais].reverse().map(p => <tr key={p.id}><td className="p-3">{p.id.slice(0, 7).split('-').reverse().join('/')}</td><td className="p-3 font-semibold tabular-nums">{formatarPercentual(p.percentual_centesimos)}</td>{podeEditar && <td className="p-3"><button type="button" disabled={ocupado} onClick={() => selecionarMes(p.id.slice(0, 7))} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50">Editar</button></td>}</tr>)}</tbody>
    </table>{!contexto.percentuais.length && <p className="p-4 text-sm text-slate-500">Nenhum percentual mensal cadastrado.</p>}</div>
  </section>;
}

export function ConfiguracoesNFSe({ podeEditar }: { podeEditar: boolean }) {
  const [contexto, setContexto] = useState<ContextoNFSe | null>(null);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    let ativo = true;
    void NFSeRepository.carregar().then(c => { if (ativo) { setContexto(c); setErro(''); } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as configurações.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [revisao]);
  function atualizar() { setCarregando(true); setRevisao(r => r + 1); }
  const salvo = () => { setAviso('Dados fiscais salvos no Supabase.'); atualizar(); };
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Configurações de NFS-e</h2><button type="button" disabled={carregando} className={botaoSecundarioFinanceiro} onClick={atualizar}><RefreshCw size={16} />Atualizar</button></div>
    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Preparação para integração. A transmissão está desabilitada. Esta etapa não recebe certificados, não assina documentos e não emite notas fiscais.</p>
    {aviso && <p role="status" className="text-sm text-emerald-700">{aviso}</p>}
    {carregando && <p role="status" className="text-sm text-slate-500">Carregando configurações fiscais…</p>}
    {erro && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro} Confira a aplicação da migração de preparação de NFS-e.</p>}
    {!carregando && !erro && contexto && <><FormularioConfiguracao contexto={contexto} podeEditar={podeEditar} onSaved={salvo} /><PercentuaisMensais contexto={contexto} podeEditar={podeEditar} onSaved={salvo} /></>}
  </div>;
}
