'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw, Search } from 'lucide-react';
import { Header } from '@/components/Header';
import { usePerfil } from '@/components/auth/PerfilContext';
import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { ContratoForm } from '@/components/financeiro/ContratoForm';
import { FaturamentosPanel } from '@/components/financeiro/FaturamentosPanel';
import { ConfiguracoesNFSe } from '@/components/financeiro/ConfiguracoesNFSe';
import { botaoFinanceiro, botaoSecundarioFinanceiro, campoFinanceiro } from '@/components/financeiro/FinanceiroDialog';
import { ClienteRepository, ProjetoRepository } from '@/services/repositoriosOperacionais';
import { FinanceiroRepository } from '@/services/financeiroSupabase';
import { dataBr, hojeLocal, moeda } from '@/services/faturamento';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { periodicidades, situacoesContrato, type Contrato } from '@/types/financeiro';
import type { Cliente, Projeto } from '@/types';

export default function FinanceiroPage() {
  const perfil = usePerfil();
  const podeEditar = perfil === 'admin' || perfil === 'editor';
  const permitido = podeEditar || perfil === 'leitor';
  const [aba, setAba] = useState<'contratos' | 'faturamentos' | 'nfse'>('contratos');
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [revisao, setRevisao] = useState(0);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('todas');
  const [modal, setModal] = useState<{ contrato?: Contrato; readOnly?: boolean } | null>(null);
  useEffect(() => {
    if (!permitido) return;
    let ativo = true;
    void Promise.all([FinanceiroRepository.listar(), ClienteRepository.listar(), ProjetoRepository.listar()])
      .then(([cs, cls, ps]) => { if (ativo) { setContratos(cs); setClientes(cls); setProjetos(ps); setErro(''); } })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o Financeiro.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [permitido, revisao]);
  const atualizar = () => { setCarregando(true); setRevisao(r => r + 1); };
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtrados = contratos.filter(c => (situacao === 'todas' || c.situacao === situacao) && normalizar(`${c.titulo} ${c.clientes?.nome_razao_social ?? ''} ${c.projetos?.nome ?? ''}`).includes(normalizar(busca)));
  const totalAtivo = contratos.filter(c => c.situacao === 'vigente').reduce((s, c) => s + c.valor_total_centavos, 0);

  return <div className="min-h-screen bg-slate-50">
    <Header title="Financeiro" subtitle={descricoesModulos.financeiro} backHref="/dashboard" backLabel="Menu Principal" />
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {!permitido ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Seu perfil não tem acesso ao Financeiro.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-[#333436]">Financeiro</h1><p className="mt-1 text-sm text-slate-500">{descricoesModulos.financeiro}</p></div>
          <div className="flex gap-2"><button type="button" disabled={carregando} onClick={atualizar} className={botaoSecundarioFinanceiro}><RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />Atualizar</button>
            {podeEditar && <button type="button" disabled={carregando || !!erro} className={botaoFinanceiro} onClick={() => setModal({})}><Plus size={18} />Novo Contrato</button>}
          </div>
        </div>
        <nav aria-label="Áreas do Financeiro" className="flex gap-5 overflow-x-auto border-b border-slate-200">
          {(['contratos', 'faturamentos', 'nfse'] as const).map(a => <button type="button" key={a} aria-current={aba === a ? 'page' : undefined} onClick={() => setAba(a)} className={`shrink-0 border-b-2 px-2 py-3 text-sm font-semibold ${aba === a ? 'border-[#00AFF0] text-sky-700' : 'border-transparent text-slate-500 hover:text-[#333436]'}`}>{a === 'contratos' ? 'Contratos' : a === 'faturamentos' ? 'Faturamentos e Projeções' : 'Configurações de NFS-e'}</button>)}
        </nav>
        <p className="text-xs text-slate-500">Fonte de dados: Supabase{!podeEditar && ' · Acesso de leitura'}</p>
        {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
        {erro && <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{erro}</p><p>Confira a conexão, suas permissões e se a migração do módulo Financeiro foi aplicada.</p><button type="button" className={botaoSecundarioFinanceiro} onClick={atualizar} disabled={carregando}>Tentar novamente</button></div>}
        {carregando && <p role="status" className="py-12 text-center text-sm text-slate-500">Carregando contratos e faturamentos…</p>}
        <div hidden={carregando || !!erro} className="space-y-5">
          <div hidden={aba !== 'contratos'} className="space-y-5">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {Object.entries(situacoesContrato).map(([v, t]) => <span key={v}>{t}: <strong className="text-[#333436]">{contratos.filter(c => c.situacao === v).length}</strong></span>)}
              <span>Valor contratado vigente: <strong className="text-[#333436]">{moeda(totalAtivo)}</strong></span>
            </div>
            <section className="flex flex-wrap gap-3" aria-label="Filtros de contratos"><label className="relative min-w-52 flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Pesquisar contratos por identificação, cliente ou projeto" className={`${campoFinanceiro} pl-10`} placeholder="Pesquisar contrato, cliente ou projeto" value={busca} onChange={e => setBusca(e.target.value)} /></label>
              <select aria-label="Situação do contrato" className={`${campoFinanceiro} sm:w-52`} value={situacao} onChange={e => setSituacao(e.target.value)}><option value="todas">Todas as situações</option>{Object.entries(situacoesContrato).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </section>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-4">Contrato</th><th className="p-4">Cliente / Projeto</th><th className="p-4">Vigência</th><th className="p-4">Faturamento</th><th className="p-4">Valor total</th><th className="p-4">Situação</th><th className="p-4">Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filtrados.map(c => <tr key={c.id} className="hover:bg-slate-50/70"><td className="p-4 font-semibold text-[#333436]">{c.titulo}</td><td className="max-w-64 p-4"><p>{c.clientes?.nome_razao_social ?? 'Cliente indisponível'}</p><p className="text-xs text-slate-500">{c.projetos?.nome ?? 'Projeto indisponível'}</p></td>
                <td className="whitespace-nowrap p-4">{dataBr(c.vigencia)}{c.vigencia < hojeLocal() && c.situacao === 'vigente' && <p className="text-xs text-amber-700">Vigência vencida</p>}</td>
                <td className="p-4">{periodicidades[c.faturamento]}<p className="text-xs text-slate-500">{c.parcelas} parcela(s)</p></td><td className="whitespace-nowrap p-4 font-semibold tabular-nums">{moeda(c.valor_total_centavos)}</td>
                <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.situacao === 'vigente' ? 'bg-emerald-50 text-emerald-700' : c.situacao === 'paralisado' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{situacoesContrato[c.situacao]}</span></td>
                <td className="p-4"><div className="flex gap-1"><BotaoAcaoCadastro acao="visualizar" onClick={() => setModal({ contrato: c, readOnly: true })} />{podeEditar && <BotaoAcaoCadastro acao="editar" onClick={() => setModal({ contrato: c })} />}</div></td>
              </tr>)}</tbody></table></div>
              {!filtrados.length && <div className="space-y-2 p-10 text-center text-slate-500"><FileText size={32} className="mx-auto text-slate-300" /><p className="text-sm">{contratos.length ? 'Nenhum contrato encontrado para os filtros selecionados.' : 'Nenhum contrato cadastrado.'}</p></div>}
            </div>
            {(!clientes.length || !projetos.length) && <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Cadastre clientes e projetos vinculados antes de criar um contrato.</p>}
          </div>
          <div hidden={aba !== 'faturamentos'}><FaturamentosPanel contratos={contratos} podeEditar={podeEditar} onChanged={atualizar} /></div>
          {aba === 'nfse' && <ConfiguracoesNFSe podeEditar={podeEditar} />}
        </div>
      </>}
    </main>
    {modal && permitido && <ContratoForm contrato={modal.contrato} readOnly={modal.readOnly || !podeEditar} clientes={clientes} projetos={projetos} onClose={() => setModal(null)} onSaved={() => { setModal(null); setAviso('Contrato salvo no Supabase.'); atualizar(); }} />}
  </div>;
}
