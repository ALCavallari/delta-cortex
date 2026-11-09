'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { ConfirmarExclusaoCadastro } from '@/components/DeleteRegistrationDialog';
import { Header } from '@/components/Header';
import { ProjectModal } from '@/components/ProjectModal';
import { ProjectDetailsModal } from '@/components/ProjectDetailsModal';
import { Projeto, Cliente } from '@/types';
import {
  ProjetoRepository,
  ClienteRepository,
} from '@/services/repositoriosOperacionais';
import {
  Plus,
  Search,
  FolderKanban,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  // Filtros e ordenação
  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<string>('TODOS');
  const [ordenacao, setOrdenacao] = useState<'data-desc' | 'data-asc' | 'nome-asc' | 'nome-desc'>('data-desc');

  // Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [projetoEmEdicao, setProjetoEmEdicao] = useState<Projeto | null>(null);
  const [projetoDetalhes, setProjetoDetalhes] = useState<Projeto | null>(null);

  // Toast feedback
  const [projetoParaExcluir, setParaExcluir] = useState<Projeto | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErroCarga('');
      const [projs, clis] = await Promise.all([
        ProjetoRepository.listar(),
        ClienteRepository.listar(),
      ]);
      setProjetos(projs);
      setClientes(clis);
    } catch (err) {
      setErroCarga(err instanceof Error ? err.message : 'Não foi possível carregar os projetos.');
      console.error('Erro ao carregar projetos e clientes:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const showToast = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => {
      setMensagemSucesso(null);
    }, 4000);
  };

  const handleProjetoSalvo = (projeto: Projeto) => {
    carregarDados();
    showToast(
      projetoEmEdicao
        ? `Projeto "${projeto.nome}" atualizado com sucesso!`
        : `Projeto "${projeto.nome}" cadastrado com sucesso!`
    );
  };

  const abrirNovo = () => {
    setProjetoEmEdicao(null);
    setModalCadastroAberto(true);
  };

  const abrirEdicao = (projeto: Projeto) => {
    setProjetoEmEdicao(projeto);
    setModalCadastroAberto(true);
  };

  const abrirDetalhes = (projeto: Projeto) => {
    setProjetoDetalhes(projeto);
  };

  const limparFiltros = () => {
    setBusca('');
    setFiltroCliente('TODOS');
    setOrdenacao('data-desc');
  };

  const filtrosAtivos = busca.trim() !== '' || filtroCliente !== 'TODOS' || ordenacao !== 'data-desc';

  // Mapa rápido de cliente por ID para lookup dinâmico
  const mapaClientes = useMemo(() => {
    const map = new Map<string, Cliente>();
    for (const c of clientes) {
      map.set(c.id, c);
    }
    return map;
  }, [clientes]);

  // Filtragem e ordenação
  const projetosFiltrados = useMemo(() => {
    let result = [...projetos];

    // Busca textual por Nome do Projeto ou Conteúdo da Descrição
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      result = result.filter((p) => {
        const matchNome = p.nome.toLowerCase().includes(termo);
        const matchDesc = (p.descricao || '').toLowerCase().includes(termo);
        const clienteNome = mapaClientes.get(p.clienteId)?.nomeRazaoSocial.toLowerCase() || '';
        const matchCliente = clienteNome.includes(termo);
        return matchNome || matchDesc || matchCliente;
      });
    }

    // Filtro por Cliente Contratante
    if (filtroCliente !== 'TODOS') {
      result = result.filter((p) => p.clienteId === filtroCliente);
    }

    // Ordenação
    result.sort((a, b) => {
      if (ordenacao === 'nome-asc') {
        return a.nome.localeCompare(b.nome);
      }
      if (ordenacao === 'nome-desc') {
        return b.nome.localeCompare(a.nome);
      }
      if (ordenacao === 'data-asc') {
        return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
      }
      // data-desc (padrão)
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });

    return result;
  }, [projetos, busca, filtroCliente, ordenacao, mapaClientes]);

  const formatarDataBR = (dataStr?: string) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        title="Projetos"
        subtitle={descricoesModulos.projetos}
        backHref="/dashboard"
        backLabel="Menu Principal"
        action={
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Projeto</span>
          </button>
        }
      />

      {/* Toast de Sucesso */}
      {mensagemSucesso && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#333436] text-white shadow-xl border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-[#A3CA33] shrink-0" />
          <span className="text-sm font-medium">{mensagemSucesso}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Título de Seção & Botão Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#333436] tracking-tight">
              Projetos
            </h1>
            <p className="text-sm text-slate-500">
              {descricoesModulos.projetos}
            </p>
          </div>

          <div className="sm:hidden">
            <button
              onClick={abrirNovo}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Projeto</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Pesquisa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
            {/* Campo de Pesquisa Geral */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por nome do projeto ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Filtro por Cliente Contratante */}
            <div className="md:col-span-4">
              <select
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white"
              >
                <option value="TODOS">Todos os Clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeRazaoSocial}
                  </option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div className="md:col-span-3">
              <div className="relative">
                <ArrowUpDown className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={ordenacao}
                  onChange={(e) => setOrdenacao(e.target.value as any)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white cursor-pointer"
                >
                  <option value="data-desc">Mais recentes primeiro</option>
                  <option value="data-asc">Mais antigos primeiro</option>
                  <option value="nome-asc">Nome do Projeto (A-Z)</option>
                  <option value="nome-desc">Nome do Projeto (Z-A)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rodapé da barra de filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Exibindo <strong>{projetosFiltrados.length}</strong> de <strong>{projetos.length}</strong> projeto(s) cadastrado(s)
            </span>

            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#00AFF0] font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Listagem de Projetos */}
        {carregando ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-10 h-10 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">Carregando projetos...</p>
          </div>
        ) : erroCarga ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{erroCarga}</p>
        ) : projetosFiltrados.length === 0 ? (
          /* Estado Vazio */
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#00AFF0] flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#333436] mb-1">
              {projetos.length === 0
                ? 'Nenhum projeto cadastrado.'
                : 'Nenhum projeto encontrado com os filtros aplicados.'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {projetos.length === 0
                ? 'Cadastre o primeiro projeto de geração ou licenciamento ambiental vinculado a um cliente contratante.'
                : 'Tente alterar os termos da busca ou clique em Limpar Filtros para ver todos os projetos cadastrados.'}
            </p>
            {projetos.length === 0 ? (
              <button
                onClick={abrirNovo}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Projeto</span>
              </button>
            ) : (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        ) : (
          /* Tabela Responsiva de Projetos */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Nome do Projeto</th>
                    <th className="px-5 py-3.5">Cliente Contratante</th>
                    <th className="px-5 py-3.5">Descrição</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Data de Cadastro</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {projetosFiltrados.map((projeto) => {
                    const cliente = mapaClientes.get(projeto.clienteId);
                    return (
                      <tr
                        key={projeto.id}
                        className="hover:bg-blue-50/30 transition-colors group"
                      >
                        {/* Nome do Projeto */}
                        <td className="px-5 py-4 font-bold text-[#333436]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00AFF0] flex items-center justify-center shrink-0">
                              <FolderKanban className="w-4 h-4" />
                            </div>
                            <span className="line-clamp-2">{projeto.nome}</span>
                          </div>
                        </td>

                        {/* Cliente Contratante */}
                        <td className="px-5 py-4">
                          {cliente ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800 line-clamp-1">
                                {cliente.nomeRazaoSocial}
                              </p>
                              <p className="text-xs text-slate-400">
                                {cliente.cidade}/{cliente.estado}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              ID: {projeto.clienteId}
                            </span>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {projeto.descricao || '—'}
                          </p>
                        </td>

                        {/* Data de Cadastro */}
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatarDataBR(projeto.criadoEm)}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <BotaoAcaoCadastro acao="visualizar" onClick={() => abrirDetalhes(projeto)} />
                            <BotaoAcaoCadastro acao="editar" onClick={() => abrirEdicao(projeto)} />
                            <BotaoAcaoCadastro acao="excluir" rotulo="Excluir projeto" onClick={() => setParaExcluir(projeto)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Cadastro / Edição */}
      <ProjectModal
        isOpen={modalCadastroAberto}
        onClose={() => setModalCadastroAberto(false)}
        projectToEdit={projetoEmEdicao}
        clientes={clientes}
        onProjectSaved={handleProjetoSalvo}
      />

      {/* Modal Detalhes */}
      <ProjectDetailsModal
        isOpen={!!projetoDetalhes}
        onClose={() => setProjetoDetalhes(null)}
        projeto={projetoDetalhes}
        cliente={projetoDetalhes ? mapaClientes.get(projetoDetalhes.clienteId) || null : null}
        onDelete={item => { setProjetoDetalhes(null); setParaExcluir(item); }}
        onEdit={(proj) => {
          setProjetoDetalhes(null);
          abrirEdicao(proj);
        }}
      />
      {projetoParaExcluir && <ConfirmarExclusaoCadastro tipo="Projeto" nome={projetoParaExcluir.nome}
        onClose={() => setParaExcluir(null)} onConfirm={async () => {
          await ProjetoRepository.excluir(projetoParaExcluir.id);
          setProjetos(itens => itens.filter(item => item.id !== projetoParaExcluir.id));
          setParaExcluir(null);
          showToast('Projeto excluído.');
        }} />}
    </div>
  );
}
