'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { Header } from '@/components/Header';
import { TechnicianDetails, TechnicianDialog, TechnicianForm, WhatsAppTecnico, botaoNeutro, botaoPrincipal } from '@/components/TechnicianModal';
import { ProfissionalRepository } from '@/services/storage';
import { limparCaracteres } from '@/services/validation';
import { normalizarBusca } from '@/services/technicians';
import type { Profissional } from '@/types';

type Modal = { tipo: 'novo' } | { tipo: 'editar' | 'detalhes' | 'excluir'; tecnico: Profissional };
const controle = 'min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
const colunas = ['Nome Completo', 'CPF', 'Contato', 'E-mail', 'Habilitado', 'Placa do Veículo', 'Ações'];

export default function CorpoTecnicoPage() {
  const [tecnicos, setTecnicos] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('nome-asc');
  const [modal, setModal] = useState<Modal | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let ativo = true;
    void ProfissionalRepository.listar()
      .then(lista => { if (ativo) setTecnicos(lista); })
      .catch(() => { if (ativo) setFalhaCarga(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [recarregar]);

  const termo = normalizarBusca(busca);
  const digitos = /^[+\d\s()./-]+$/.test(termo) ? limparCaracteres(termo) : '';
  const filtrados = tecnicos.filter(p => {
    if (p.deletedAt) return false;
    return !termo || normalizarBusca(p.nome).includes(termo) ||
      (!!digitos && [p.cpf, p.cnpj, p.contato].some(v => limparCaracteres(v ?? '').includes(digitos)));
  }).sort((a, b) => {
    const nome = a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordem === 'nome-desc') return -nome;
    if (ordem === 'data-desc') return (b.criadoEm ?? '').localeCompare(a.criadoEm ?? '') || nome;
    if (ordem === 'data-asc') return (a.criadoEm ?? '9999').localeCompare(b.criadoEm ?? '9999') || nome;
    return nome;
  });

  async function excluirTecnico(p: Profissional) {
    if (ocupado) return;
    setOcupado(p.id);
    setAviso(null);
    try {
      await ProfissionalRepository.definirExclusao(p.id, true);
      setTecnicos(lista => lista.map(atual => atual.id === p.id ? { ...atual, deletedAt: new Date().toISOString() } : atual));
      setModal(null);
      setAviso({ texto: 'Técnico excluído.' });
    } catch {
      setAviso({ texto: 'Não foi possível excluir o técnico.', erro: true });
    } finally { setOcupado(null); }
  }

  const fechar = () => { setModal(null); setAviso(null); };
  const abrir = (m: Modal) => { setModal(m); setAviso(null); };
  function acoes(p: Profissional) {
    return <div className="flex flex-wrap items-center gap-1">
        <BotaoAcaoCadastro acao="visualizar" rotulo={`Visualizar ${p.nome}`} onClick={() => abrir({ tipo: 'detalhes', tecnico: p })} />
        <BotaoAcaoCadastro acao="editar" rotulo={`Editar ${p.nome}`} onClick={() => abrir({ tipo: 'editar', tecnico: p })} />
        <BotaoAcaoCadastro acao="excluir" rotulo={`Excluir ${p.nome}`} onClick={() => abrir({ tipo: 'excluir', tecnico: p })} />
    </div>;
  }
  const situacao = (p: Profissional) => <span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.habilitado ? 'bg-lime-50 text-lime-800' : 'bg-slate-100 text-slate-700'}`}
    title={p.habilitado === undefined ? 'Cadastro antigo sem habilitação definida' : undefined}>{p.habilitado ? 'Sim' : 'Não'}</span>;
  const contato = (p: Profissional) => <div className="flex flex-wrap items-center gap-2">{p.contato || '—'} <WhatsAppTecnico telefone={p.contato} /></div>;

  return <div className="min-h-screen bg-slate-50">
    <Header title="Corpo Técnico" subtitle={descricoesModulos.corpoTecnico} backHref="/dashboard" backLabel="Menu Principal" />
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-[#333436]">Corpo Técnico</h1><p className="text-sm text-slate-600">{descricoesModulos.corpoTecnico}</p></div>
        <button type="button" className={botaoPrincipal} onClick={() => abrir({ tipo: 'novo' })}><Plus size={18} /> Novo Técnico</button>
      </div>
      {aviso && modal?.tipo !== 'excluir' && <p role={aviso.erro ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${aviso.erro ? 'border-red-200 bg-red-50 text-red-800' : 'border-lime-200 bg-lime-50 text-lime-900'}`}>{aviso.texto}</p>}
      <section aria-label="Pesquisa e filtros" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Pesquisar por nome, CPF, CNPJ ou contato</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
            <input type="search" className={`${controle} w-full pl-9`} placeholder="Nome, CPF, CNPJ ou contato" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <select aria-label="Ordenar profissionais" className={controle} value={ordem} onChange={e => setOrdem(e.target.value)}>
            <option value="nome-asc">Nome: A a Z</option><option value="nome-desc">Nome: Z a A</option>
            <option value="data-desc">Cadastro: mais recente</option><option value="data-asc">Cadastro: mais antigo</option>
          </select>
          <button type="button" className={botaoNeutro} onClick={() => { setBusca(''); setOrdem('nome-asc'); }}>Limpar Filtros</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-slate-600">{carregando || falhaCarga ? '' : `${filtrados.length} ${filtrados.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`}</p>
        </div>
      </section>
      {carregando ? <p role="status" className="p-5 text-slate-600">Carregando técnicos…</p> :
        falhaCarga ? <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-4 text-red-800">
          <p>Não foi possível carregar os técnicos.</p>
          <button type="button" className={botaoNeutro} onClick={() => { setFalhaCarga(false); setCarregando(true); setRecarregar(n => n + 1); }}>Tentar novamente</button>
        </div> :
        !filtrados.length ? <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-700">
          <Users className="mx-auto text-slate-400" />
          <p>{tecnicos.some(p => !p.deletedAt) ? 'Nenhum técnico encontrado com os filtros atuais.' : 'Nenhum técnico cadastrado.'}</p>
          {!tecnicos.some(p => !p.deletedAt) && <button type="button" className={botaoPrincipal} onClick={() => abrir({ tipo: 'novo' })}>Cadastrar o primeiro técnico</button>}
        </div> : <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-700"><tr>{colunas.map(c => <th key={c} scope="col" className="p-3">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filtrados.map(p => <tr key={p.id}>
                <th scope="row" className="break-words p-3 font-semibold">{p.nome}</th><td className="p-3">{p.cpf || '—'}</td>
                <td className="p-3">{contato(p)}</td><td className="max-w-48 break-all p-3">{p.email || '—'}</td>
                <td className="p-3">{situacao(p)}</td><td className="p-3">{p.placaVeiculo || '—'}</td><td className="p-3">{acoes(p)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">{filtrados.map(p => <li key={p.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="break-words font-bold text-[#333436]">{p.nome}</h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              <dt>CPF</dt><dd>{p.cpf || '—'}</dd><dt>Contato</dt><dd>{contato(p)}</dd>
              <dt>E-mail</dt><dd className="break-all">{p.email || '—'}</dd><dt>Habilitado</dt><dd>{situacao(p)}</dd>
              <dt>Placa</dt><dd>{p.placaVeiculo || '—'}</dd>
            </dl>
            {acoes(p)}
          </li>)}</ul>
        </>}
    </main>
    {(modal?.tipo === 'novo' || modal?.tipo === 'editar') && <TechnicianForm key={modal.tipo === 'editar' ? modal.tecnico.id : 'novo'}
      tecnico={modal.tipo === 'editar' ? modal.tecnico : undefined} onClose={fechar}
      onSaved={p => {
        setTecnicos(lista => lista.some(t => t.id === p.id) ? lista.map(t => t.id === p.id ? p : t) : [...lista, p]);
        setModal(null); setAviso({ texto: modal.tipo === 'novo' ? 'Técnico cadastrado com sucesso.' : 'Técnico atualizado com sucesso.' });
      }} />}
    {modal?.tipo === 'detalhes' && <TechnicianDetails tecnico={modal.tecnico} onClose={fechar}
      onEdit={() => abrir({ tipo: 'editar', tecnico: modal.tecnico })} onDelete={() => abrir({ tipo: 'excluir', tecnico: modal.tecnico })} />}
    {modal?.tipo === 'excluir' && <TechnicianDialog titulo="Excluir Técnico" onClose={fechar} ocupado={!!ocupado}>
      <div className="space-y-4 p-5">
        <p>Tem certeza de que deseja excluir este técnico do cadastro?</p>
        <p className="break-words font-semibold">{modal.tecnico.nome}</p>
        {aviso?.erro && <p role="alert" className="text-sm text-red-700">{aviso.texto}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={botaoNeutro} disabled={!!ocupado} onClick={fechar}>Cancelar</button>
          <button type="button" className="min-h-10 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={!!ocupado} onClick={() => void excluirTecnico(modal.tecnico)}>{ocupado ? 'Excluindo…' : 'Excluir Técnico'}</button>
        </div>
      </div>
    </TechnicianDialog>}
  </div>;
}
