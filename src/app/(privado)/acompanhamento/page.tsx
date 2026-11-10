'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { baixarRelatorio } from '@/services/reportDownload';
import { ShareReportModal } from '@/components/ShareReportModal';
import { RelatoriosEmitidos } from '@/components/RelatoriosEmitidos';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { ProjectOccurrenceMap } from '@/components/Map/ProjectOccurrenceMap';
import { Header } from '@/components/Header';
import { NewVisitModal } from '@/components/NewVisitModal';
import { Visita, Cliente, Projeto, Profissional } from '@/types';
import { usePerfil } from '@/components/auth/PerfilContext';
import type { Perfil } from '@/services/perfis';
import { contextoRestrito } from '@/services/supabaseOperacional';
import {
  VisitaRepository,
  RelatorioRepository,
  ClienteRepository,
  ProjetoRepository,
  ProfissionalRepository,
} from '@/services/repositoriosOperacionais';
import {
  Plus,
  Compass,
  Calendar,
  User,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Trash2,
  FileDown,
  FilePenLine,
  Share2,
  RotateCcw,
  Search,
  Filter,
  ArrowUpDown,
  History,
  X,
  Link2,
} from 'lucide-react';

export default function AcompanhamentoDashboardPage() {
  const perfil = usePerfil();
  if (!perfil) return <p role="status" className="p-6 text-sm">Acesso ao Trabalho de Campo indisponível.</p>;
  return <TrabalhoDeCampo key={perfil} perfil={perfil} />;
}

function TrabalhoDeCampo({ perfil }: { perfil: Perfil }) {
  const clienteExterno = perfil === 'cliente';
  const tecnicoDesignado = perfil === 'tecnico';
  const restrito = clienteExterno || tecnicoDesignado;
  const [visitaCompartilhada, setVisitaCompartilhada] = useState<Visita | null>(null);
  const [visitaRelatorios, setVisitaRelatorios] = useState<Visita | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [comRelatorio, setComRelatorio] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<'trabalhos' | 'mapa'>(clienteExterno ? 'mapa' : 'trabalhos');
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [visitasExcluidas, setVisitasExcluidas] = useState<Visita[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nomeRazaoSocial'>[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [profissionais, setProfissionais] = useState<Pick<Profissional, 'id' | 'nome'>[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const semProjetoDesignado = tecnicoDesignado && projetos.length === 0;

  // Modais
  const [modalNovaVisitaAberto, setModalNovaVisitaAberto] = useState(false);
  const [visitaParaExcluir, setVisitaParaExcluir] = useState<Visita | null>(null);
  const [modalExcluidasAberto, setModalExcluidasAberto] = useState(false);
  const [visitaParaVincular, setVisitaParaVincular] = useState<Visita | null>(null);
  const [erroVinculo, setErroVinculo] = useState('');
  const [projetoVinculoSelecionado, setProjetoVinculoSelecionado] = useState('');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filtros e Pesquisa
  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('TODOS');
  const [filtroProjeto, setFiltroProjeto] = useState('TODOS');
  const [filtroMotivo, setFiltroMotivo] = useState('TODOS');
  const [filtroExecutor, setFiltroExecutor] = useState('TODOS');
  const [filtroRespTecnico, setFiltroRespTecnico] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [ordenacao, setOrdenacao] = useState<'data-desc' | 'data-asc' | 'projeto-asc' | 'cliente-asc'>('data-desc');
  const [painelFiltrosAberto, setPainelFiltrosAberto] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const carregarDados = useCallback(() =>
    Promise.all([
      clienteExterno ? [] : VisitaRepository.listar(false),
      restrito ? [] : VisitaRepository.listarExcluidas(),
      ProjetoRepository.listar(),
      restrito ? contextoRestrito() : Promise.all([ClienteRepository.listar(), ProfissionalRepository.listar()])
        .then(([clientes, profissionais]) => ({ clientes, profissionais })),
    ]).then(async ([listaVisitas, listaExcluidas, listaProjetos, contexto]) => {
      setErroCarga('');
      setVisitas(listaVisitas);
      setVisitasExcluidas(listaExcluidas);
      setClientes(contexto.clientes);
      setProjetos(listaProjetos);
      setProfissionais(contexto.profissionais);
      if (!restrito) {
        try { setComRelatorio(await RelatorioRepository.visitasComRelatorio()); }
        catch { showToast('Não foi possível consultar os relatórios salvos.'); }
      }
    }).catch(err => {
      setErroCarga(err instanceof Error ? err.message : 'Não foi possível carregar os trabalhos.');
      console.error('Erro ao carregar dados do acompanhamento:', err);
    }).finally(() => {
      setCarregando(false);
    }), [clienteExterno, restrito, showToast]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Exclusão lógica de visita
  const handleConfirmarExclusaoVisita = async () => {
    if (!visitaParaExcluir) return;
    try {
      await VisitaRepository.excluirLogico(visitaParaExcluir.id);
      showToast(`Visita "${visitaParaExcluir.identificacao}" excluída com sucesso.`);
      setVisitaParaExcluir(null);
      await carregarDados();
    } catch (err) {
      console.error('Erro ao excluir visita:', err);
      showToast('Falha ao excluir visita.');
    }
  };

  // Restauração de visita excluída
  const handleRestaurarVisita = async (id: string) => {
    try {
      await VisitaRepository.restaurar(id);
      showToast('Visita restaurada com sucesso!');
      await carregarDados();
    } catch (err) {
      console.error('Erro ao restaurar visita:', err);
      showToast('Falha ao restaurar visita.');
    }
  };

  // Vincular visita antiga a um projeto
  const handleSalvarVinculoProjeto = async () => {
    if (!visitaParaVincular || !projetoVinculoSelecionado) return;
    setErroVinculo('');
    try {
      const proj = projetos.find((p) => p.id === projetoVinculoSelecionado);
      if (!proj) return;
      await VisitaRepository.vincularProjeto();

      showToast(`Visita vinculada com sucesso ao projeto "${proj.nome}".`);
      setVisitaParaVincular(null);
      setProjetoVinculoSelecionado('');
      await carregarDados();
    } catch (err) {
      console.error('Erro ao vincular visita ao projeto:', err);
      setErroVinculo(err instanceof Error ? err.message : 'Falha ao vincular projeto à visita.');
    }
  };

  // Projetos disponíveis para o filtro (considera o cliente selecionado, quando aplicável)
  const projetosFiltradosParaOpcoes = useMemo(() => {
    if (filtroCliente === 'TODOS') return projetos;
    return projetos.filter((p) => p.clienteId === filtroCliente);
  }, [projetos, filtroCliente]);

  // Lista de executores e responsáveis técnicos únicos para selects
  const executoresDisponiveis = useMemo(() => {
    const setNomes = new Set<string>();
    for (const v of visitas) {
      if (v.executorNome) setNomes.add(v.executorNome);
    }
    for (const p of profissionais) {
      setNomes.add(p.nome);
    }
    return Array.from(setNomes).sort();
  }, [visitas, profissionais]);

  const responsaveisDisponiveis = useMemo(() => {
    const setNomes = new Set<string>();
    for (const v of visitas) {
      if (v.responsavelTecnicoNome) setNomes.add(v.responsavelTecnicoNome);
    }
    for (const p of profissionais) {
      setNomes.add(p.nome);
    }
    return Array.from(setNomes).sort();
  }, [visitas, profissionais]);

  const limparFiltros = () => {
    setBusca('');
    setFiltroCliente('TODOS');
    setFiltroProjeto('TODOS');
    setFiltroMotivo('TODOS');
    setFiltroExecutor('TODOS');
    setFiltroRespTecnico('TODOS');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroStatus('TODOS');
    setOrdenacao('data-desc');
  };

  const temFiltroAtivo =
    busca.trim() !== '' ||
    filtroCliente !== 'TODOS' ||
    filtroProjeto !== 'TODOS' ||
    filtroMotivo !== 'TODOS' ||
    filtroExecutor !== 'TODOS' ||
    filtroRespTecnico !== 'TODOS' ||
    filtroDataInicio !== '' ||
    filtroDataFim !== '' ||
    filtroStatus !== 'TODOS' ||
    ordenacao !== 'data-desc';

  // Filtragem e Ordenação em Memória
  const visitasFiltradas = useMemo(() => {
    let result = [...visitas];

    // Busca Geral: identificação da visita, nome do projeto, cliente contratante
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      result = result.filter((v) => {
        const matchId = v.identificacao.toLowerCase().includes(termo);
        const matchProj = (v.identificacaoProjeto || '').toLowerCase().includes(termo);
        const matchCli = v.clienteNome.toLowerCase().includes(termo);
        return matchId || matchProj || matchCli;
      });
    }

    // Filtro por Cliente Contratante
    if (filtroCliente !== 'TODOS') {
      result = result.filter((v) => v.clienteId === filtroCliente);
    }

    // Filtro por Projeto
    if (filtroProjeto !== 'TODOS') {
      result = result.filter(
        (v) => v.projetoId === filtroProjeto || v.identificacaoProjeto === filtroProjeto
      );
    }

    // Filtro por Motivo da Visita
    if (filtroMotivo !== 'TODOS') {
      result = result.filter((v) => v.motivo === filtroMotivo);
    }

    // Filtro por Executor
    if (filtroExecutor !== 'TODOS') {
      result = result.filter((v) => v.executorNome === filtroExecutor);
    }

    // Filtro por Responsável Técnico
    if (filtroRespTecnico !== 'TODOS') {
      result = result.filter((v) => v.responsavelTecnicoNome === filtroRespTecnico);
    }

    // Filtro por Data Inicial
    if (filtroDataInicio) {
      result = result.filter((v) => v.data >= filtroDataInicio);
    }

    // Filtro por Data Final
    if (filtroDataFim) {
      result = result.filter((v) => v.data <= filtroDataFim);
    }

    // Filtro por Status
    if (filtroStatus !== 'TODOS') {
      result = result.filter((v) => v.status === filtroStatus);
    }

    // Ordenação
    result.sort((a, b) => {
      if (ordenacao === 'data-asc') {
        return new Date(a.data || a.criadoEm).getTime() - new Date(b.data || b.criadoEm).getTime();
      }
      if (ordenacao === 'projeto-asc') {
        const pA = a.identificacaoProjeto || '';
        const pB = b.identificacaoProjeto || '';
        return pA.localeCompare(pB);
      }
      if (ordenacao === 'cliente-asc') {
        return a.clienteNome.localeCompare(b.clienteNome);
      }
      // data-desc (Padrão: Visitas mais recentes primeiro)
      return new Date(b.data || b.criadoEm).getTime() - new Date(a.data || a.criadoEm).getTime();
    });

    return result;
  }, [
    visitas,
    busca,
    filtroCliente,
    filtroProjeto,
    filtroMotivo,
    filtroExecutor,
    filtroRespTecnico,
    filtroDataInicio,
    filtroDataFim,
    filtroStatus,
    ordenacao,
  ]);

  // Métricas baseadas nas visitas ativas não excluídas
  const totalVisitas = visitas.length;

  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return '';
    if (dataStr.includes('-')) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        title="Trabalho de Campo"
        subtitle={descricoesModulos.trabalhoCampo}
        backHref={restrito ? undefined : '/dashboard'}
        backLabel="Menu Principal"
        action={aba === 'trabalhos' ? (
          <button
            onClick={() => setModalNovaVisitaAberto(true)}
            disabled={semProjetoDesignado}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 text-xs sm:text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Trabalho</span>
          </button>
        ) : undefined}
      />

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#333436] text-white shadow-xl border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-[#A3CA33] shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <nav aria-label="Áreas de Trabalho de Campo" className="mb-5 flex border-b border-slate-200">
          {([
            ['trabalhos', 'Trabalhos Cadastrados'],
            ['mapa', 'Mapa de Ocorrências/Relatórios'],
          ] as const).filter(([id]) => !clienteExterno || id === 'mapa').map(([id, titulo]) => (
            <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)}
              className={`min-h-11 flex-1 border-b-2 px-2 py-2 text-sm font-semibold sm:flex-none sm:px-5 ${aba === id
                ? 'border-[#00AFF0] text-sky-800' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}>
              {titulo}
            </button>
          ))}
        </nav>
        {aba === 'mapa' ? (
          <section aria-labelledby="titulo-mapa-ocorrencias" className="space-y-4">
            <h1 id="titulo-mapa-ocorrencias" className="text-2xl font-bold text-[#333436]">Mapa de Ocorrências/Relatórios</h1>
            {erroCarga ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{erroCarga}</p> :
              <ProjectOccurrenceMap projetos={projetos} clientes={clientes} carregando={carregando} portal={clienteExterno}
                restrito={restrito} exibirRelatorios={!restrito} />}
          </section>
        ) : <>
        {/* Cabeçalho da Seção & Ações de Topo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#333436] tracking-tight">
              Trabalho de Campo
            </h1>
            <p className="text-sm text-slate-500">
              {descricoesModulos.trabalhoCampo}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {visitasExcluidas.length > 0 && (
              <button
                type="button"
                onClick={() => setModalExcluidasAberto(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
                title="Visualizar visitas excluídas e restaurar"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span>Visitas Excluídas ({visitasExcluidas.length})</span>
              </button>
            )}

            <button
              onClick={() => setModalNovaVisitaAberto(true)}
              disabled={semProjetoDesignado}
              className="sm:hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-[#00AFF0] text-xs shadow-md disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Trabalho</span>
            </button>
          </div>
        </div>

        {/* FERRAMENTAS DE PESQUISA, FILTROS E ORDENAÇÃO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs mb-6 space-y-4">
          {/* Barra de Pesquisa Geral e Ações Rápidas */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Campo de Pesquisa Geral */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por identificação da visita, projeto ou cliente contratante..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Ordenação */}
            <div className="relative md:w-64">
              <ArrowUpDown className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white cursor-pointer"
              >
                <option value="data-desc">Visitas mais recentes</option>
                <option value="data-asc">Visitas mais antigas</option>
                <option value="projeto-asc">Ordem alfabética do projeto</option>
                <option value="cliente-asc">Ordem alfabética do cliente</option>
              </select>
            </div>

            {/* Toggle Painel de Filtros Avançados */}
            <button
              type="button"
              onClick={() => setPainelFiltrosAberto(!painelFiltrosAberto)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border ${
                painelFiltrosAberto || temFiltroAtivo
                  ? 'bg-blue-50 text-[#00AFF0] border-blue-200'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filtros</span>
              {temFiltroAtivo && (
                <span className="w-2 h-2 rounded-full bg-[#00AFF0]" />
              )}
            </button>
          </div>

          {/* Painel de Filtros Avançados Expansível */}
          {painelFiltrosAberto && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 1. Cliente Contratante */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cliente Contratante
                </label>
                <select
                  value={filtroCliente}
                  onChange={(e) => {
                    setFiltroCliente(e.target.value);
                    setFiltroProjeto('TODOS');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os Clientes</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeRazaoSocial}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Projeto (considera o cliente selecionado) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Projeto / Empreendimento
                </label>
                <select
                  value={filtroProjeto}
                  onChange={(e) => setFiltroProjeto(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os Projetos</option>
                  {projetosFiltradosParaOpcoes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Motivo da Visita */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo da Visita
                </label>
                <select
                  value={filtroMotivo}
                  onChange={(e) => setFiltroMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os Motivos</option>
                  <option value="Visita Sistemática">Visita Sistemática</option>
                  <option value="Mon. Fauna">Mon. Fauna</option>
                  <option value="Mon. Flora">Mon. Flora</option>
                </select>
              </div>

              {/* 8. Status */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              {/* 4. Executor */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Executor
                </label>
                <select
                  value={filtroExecutor}
                  onChange={(e) => setFiltroExecutor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os Executores</option>
                  {executoresDisponiveis.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Responsável Técnico */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsável Técnico
                </label>
                <select
                  value={filtroRespTecnico}
                  onChange={(e) => setFiltroRespTecnico(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                >
                  <option value="TODOS">Todos os RTs</option>
                  {responsaveisDisponiveis.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Data Inicial */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                />
              </div>

              {/* 7. Data Final */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#00AFF0] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Rodapé da Barra de Filtros: Contador e Limpar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Encontrada(s) <strong>{visitasFiltradas.length}</strong> de <strong>{totalVisitas}</strong> visita(s)
            </span>

            {temFiltroAtivo && (
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

        {/* Lista de Visitas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#333436] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00AFF0]" />
              Trabalhos de Campo Cadastrados
            </h2>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Fonte de dados: Supabase
            </span>
          </div>

          {carregando ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-10 h-10 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-600">Carregando histórico de visitas...</p>
            </div>
          ) : erroCarga ? (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{erroCarga}</p>
          ) : visitasFiltradas.length === 0 ? (
            /* Estado Vazio */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#00AFF0] flex items-center justify-center mx-auto mb-4">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#333436] mb-1">
                {semProjetoDesignado ? 'Nenhum projeto autorizado' : visitas.length === 0
                  ? 'Nenhuma visita de acompanhamento criada'
                  : 'Nenhuma visita encontrada com os filtros aplicados'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                {semProjetoDesignado ? 'Procure a administração para receber acesso a um projeto.' : visitas.length === 0
                  ? 'Inicie uma nova visita sistemática para abrir a ferramenta de mapa georreferenciado e registrar observações ou ocorrências com fotos e coordenadas UTM.'
                  : 'Tente ajustar os critérios de pesquisa ou clique no botão Limpar Filtros para exibir todas as visitas ativas.'}
              </p>
              {!semProjetoDesignado && (visitas.length === 0 ? (
                <button
                  onClick={() => setModalNovaVisitaAberto(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeira Visita</span>
                </button>
              ) : (
                <button
                  onClick={limparFiltros}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Limpar Filtros</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {visitasFiltradas.map((visita) => (
                <div
                  key={visita.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-[#00AFF0] hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group"
                >
                  <div className="space-y-2 flex-1">
                    {/* Topo do Card de Visita */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {visita.identificacao}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#00AFF0] border border-blue-200/60">
                        {visita.motivo}
                      </span>

                      {visita.status === 'em_andamento' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Em andamento
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Concluída
                        </span>
                      )}
                    </div>

                    {/* Cliente e Projeto */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#333436] group-hover:text-[#00AFF0] transition-colors">
                        {visita.clienteNome}
                      </h3>
                      {visita.identificacaoProjeto ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>Projeto: <strong>{visita.identificacaoProjeto}</strong></span>
                        </p>
                      ) : !restrito && (
                        /* Compatibilidade com visitas antigas sem projeto vinculado */
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400 italic">
                            Visita anterior sem vínculo com Projetos
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setVisitaParaVincular(visita);
                              setErroVinculo('');
                              setProjetoVinculoSelecionado(projetos.length > 0 ? projetos[0].id : '');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#00AFF0] hover:bg-blue-100 text-[11px] font-semibold transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Vincular Projeto</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Metadados: Data, Executor e Responsável Técnico */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Data: <strong>{formatarDataBR(visita.data)}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Executor: <strong>{visita.executorNome}</strong></span>
                      </div>
                      {visita.responsavelTecnicoNome && (
                        <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
                          <span>RT: <strong>{visita.responsavelTecnicoNome}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações: Abrir / Retomar Visita & Excluir Visita */}
                  <div className="w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/acompanhamento/visita/${visita.id}`}
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-sm shadow-blue-400/20 text-sm"
                    >
                      <span>
                        {visita.status === 'em_andamento' ? 'Retomar Visita' : 'Abrir Visita'}
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>

                    {comRelatorio.has(visita.id) && <>
                      {perfil === 'admin' && <button type="button" title="Gerenciar relatórios"
                        aria-label={`Editar ou excluir relatórios de ${visita.identificacao}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-sky-700 hover:bg-sky-50"
                        onClick={() => setVisitaRelatorios(visita)}><FilePenLine className="h-4 w-4" /></button>}
                      <button type="button" title="Baixar relatório PDF"
                      aria-label={`Baixar relatório PDF de ${visita.identificacao}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      disabled={!!baixando} aria-busy={baixando === visita.id}
                      onClick={async () => {
                        if (baixando) return;
                        setBaixando(visita.id);
                        try {
                          const [relatorio] = await RelatorioRepository.listarPorVisita(visita.id);
                          if (!relatorio) throw new Error('Relatório indisponível.');
                          baixarRelatorio(relatorio);
                        } catch { showToast('Não foi possível localizar o arquivo PDF deste relatório.'); }
                        finally { setBaixando(null); }
                      }}>{baixando === visita.id ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <FileDown className="h-4 w-4" />}</button>
                      <button type="button" title="Compartilhar relatório PDF"
                        aria-label={`Compartilhar relatório PDF de ${visita.identificacao}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-sky-700 hover:bg-sky-50"
                        onClick={() => setVisitaCompartilhada(visita)}><Share2 className="h-4 w-4" /></button>
                    </>}
                    {/* Botão de Excluir Visita (Lixeira) */}
                    {!restrito && <button
                      type="button"
                      onClick={() => setVisitaParaExcluir(visita)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
                      title="Excluir Visita"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>}
      </main>
      {visitaCompartilhada && <ShareReportModal key={visitaCompartilhada.id}
        visitaId={visitaCompartilhada.id} onClose={() => setVisitaCompartilhada(null)} />}
      {perfil === 'admin' && visitaRelatorios && <RelatoriosEmitidos key={visitaRelatorios.id} visita={visitaRelatorios}
        fechar={() => setVisitaRelatorios(null)} onAlterado={() => void carregarDados()} />}

      {/* Modal Novo Trabalho */}
      <NewVisitModal
        isOpen={modalNovaVisitaAberto}
        tecnicoDesignado={tecnicoDesignado}
        onClose={() => setModalNovaVisitaAberto(false)}
        onVisitCreated={() => carregarDados()}
      />

      {/* MODAL DE CONFIRMAÇÃO: EXCLUIR VISITA */}
      {visitaParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#333436] mb-2">
              Excluir Visita
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Tem certeza de que deseja excluir esta visita e seus registros associados?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisitaParaExcluir(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusaoVisita}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-sm font-semibold text-white transition-all shadow-md shadow-red-500/20"
              >
                Excluir Visita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR E RESTAURAR VISITAS EXCLUÍDAS */}
      {modalExcluidasAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <History className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#333436]">
                    Visitas Excluídas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Restaure visitas e seus registros preservados no Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalExcluidasAberto(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-sm">
              {visitasExcluidas.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="font-semibold text-slate-700">Nenhuma visita excluída</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Todas as visitas cadastradas estão ativas na listagem principal.
                  </p>
                </div>
              ) : (
                visitasExcluidas.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded">
                          {v.identificacao}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {v.motivo}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#333436]">{v.clienteNome}</p>
                      {v.identificacaoProjeto && (
                        <p className="text-xs text-slate-500">Projeto: {v.identificacaoProjeto}</p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Data da visita: {formatarDataBR(v.data)} • Excluída em:{' '}
                        {v.deletedAt ? new Date(v.deletedAt).toLocaleString('pt-BR') : '—'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestaurarVisita(v.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-400 text-xs font-semibold shadow-xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Visita</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setModalExcluidasAberto(false)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR VISITA ANTIGA A UM PROJETO */}
      {visitaParaVincular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#00AFF0]" />
                <h3 className="text-base font-bold text-[#333436]">
                  Vincular Visita a Projeto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVisitaParaVincular(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Selecione um projeto cadastrado para associar à visita{' '}
              <strong>{visitaParaVincular.identificacao}</strong>. Todos os registros geográficos e fotos serão preservados.
            </p>

            {projetos.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl mb-4">
                Nenhum projeto cadastrado. Acesse o módulo Projetos para criar um projeto primeiro.
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Projeto / Empreendimento
                  </label>
                  <select
                    value={projetoVinculoSelecionado}
                    onChange={(e) => {
                      setProjetoVinculoSelecionado(e.target.value);
                      setErroVinculo('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {erroVinculo && (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{erroVinculo}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVisitaParaVincular(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarVinculoProjeto}
                disabled={projetos.length === 0 || !projetoVinculoSelecionado}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] rounded-xl disabled:opacity-50"
              >
                Salvar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
