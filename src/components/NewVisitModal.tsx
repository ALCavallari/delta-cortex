'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CORPO_TECNICO, SEM_TECNICOS, normalizarBusca } from '@/services/technicians';
import {
  X,
  Compass,
  Building2,
  Calendar,
  Sparkles,
  AlertCircle,
  Play,
  Info,
  FolderKanban,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Cliente, Profissional, MotivoVisita, Visita, Projeto } from '@/types';
import { contextoRestrito } from '@/services/supabaseOperacional';
import {
  ClienteRepository,
  ProfissionalRepository,
  VisitaRepository,
  ProjetoRepository,
} from '@/services/repositoriosOperacionais';

interface NewVisitModalProps {
  onClose: () => void;
  onVisitCreated?: (visita: Visita) => void;
  tecnicoDesignado?: boolean;
}

type ContratanteVisita = Pick<Cliente, 'id' | 'nomeRazaoSocial'> & Partial<Pick<Cliente, 'cpfCnpj' | 'cidade' | 'estado'>>;
type TecnicoVisita = Pick<Profissional, 'id' | 'nome'>;

function impedirEnvioNaBusca(evento: React.KeyboardEvent<HTMLInputElement>) {
  if (evento.key === 'Enter' && !evento.nativeEvent.isComposing) evento.preventDefault();
}

export function NewVisitModal({ onClose, onVisitCreated, tecnicoDesignado = false }: NewVisitModalProps) {
  const router = useRouter();

  const [clientes, setClientes] = useState<ContratanteVisita[]>([]);
  const [profissionais, setProfissionais] = useState<TecnicoVisita[]>([]);
  const [executorVinculado, setExecutorVinculado] = useState<string | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Campos do formulário
  const [motivo, setMotivo] = useState<MotivoVisita>('Visita Sistemática');
  const [executorId, setExecutorId] = useState('');
  const [responsavelTecnicoId, setResponsavelTecnicoId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [buscaProjeto, setBuscaProjeto] = useState('');
  const [dataVisita, setDataVisita] = useState('');
  const [vinculacaoAutomatica, setVinculacaoAutomatica] = useState(true);
  const [identificacao, setIdentificacao] = useState('');

  // Validação
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);

  // Inicializa dados ao abrir
  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      try {
        setCarregandoDados(true);
        const [contexto, projs, visitasExistentes] = await Promise.all([
          tecnicoDesignado ? contextoRestrito() : Promise.all([ClienteRepository.listar(), ProfissionalRepository.listarAtivos()])
            .then(([clientes, profissionais]) => ({ clientes, profissionais, profissionalId: null })),
          ProjetoRepository.listar(),
          VisitaRepository.listar(),
        ]);
        if (cancelado) return;

        setClientes(contexto.clientes);
        setProfissionais(contexto.profissionais);
        setExecutorVinculado(contexto.profissionalId);
        setProjetos(projs);

        setProjetoId(projs[0]?.id ?? '');

        setExecutorId(contexto.profissionalId ?? contexto.profissionais[0]?.id ?? '');
        setResponsavelTecnicoId(contexto.profissionalId ?? contexto.profissionais[0]?.id ?? '');

        // Data atual no formato YYYY-MM-DD para o input
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const dataHojeIso = `${ano}-${mes}-${dia}`;
        setDataVisita(dataHojeIso);

        // Gerar identificação automática provisória
        const seq = String(visitasExistentes.length + 1).padStart(3, '0');
        const codigoAuto = `VIS-${ano}${mes}${dia}-${seq}`;
        setIdentificacao(codigoAuto);
      } catch (err) {
        if (cancelado) return;
        console.error('Erro ao carregar dados do modal de visita:', err);
        setErroGeral(err instanceof Error ? err.message : 'Não foi possível carregar os dados da visita.');
      } finally {
        if (!cancelado) setCarregandoDados(false);
      }
    };

    void carregar();
    return () => { cancelado = true; };
  }, [tecnicoDesignado]);

  // Recalcula código automático se data ou toggle mudar
  useEffect(() => {
    if (vinculacaoAutomatica && dataVisita) {
      const dLimpa = dataVisita.replace(/-/g, '');
      const hash = Math.floor(100 + Math.random() * 900);
      setIdentificacao(`VIS-${dLimpa}-${hash}`);
    }
  }, [vinculacaoAutomatica, dataVisita]);

  const mapaClientes = useMemo(() => {
    const map = new Map<string, ContratanteVisita>();
    for (const c of clientes) {
      map.set(c.id, c);
    }
    return map;
  }, [clientes]);

  const projetosFiltrados = useMemo(() => {
    if (!buscaProjeto.trim()) return projetos;
    const termo = buscaProjeto.toLowerCase().trim();
    return projetos.filter((p) => {
      const matchProj = p.nome.toLowerCase().includes(termo);
      const clienteNome = mapaClientes.get(p.clienteId)?.nomeRazaoSocial.toLowerCase() || '';
      const matchCli = clienteNome.includes(termo);
      return matchProj || matchCli;
    });
  }, [projetos, buscaProjeto, mapaClientes]);

  const projetoSelecionado = useMemo(() => {
    return projetos.find((p) => p.id === projetoId);
  }, [projetos, projetoId]);

  const clienteDoProjeto = useMemo(() => {
    if (!projetoSelecionado) return null;
    return mapaClientes.get(projetoSelecionado.clienteId) || null;
  }, [projetoSelecionado, mapaClientes]);

  const handleSelecionarProjeto = (projId: string) => {
    setProjetoId(projId);
    if (erros.projetoId) setErros((prev) => ({ ...prev, projetoId: '' }));
  };

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (motivo !== 'Visita Sistemática') {
      novosErros.motivo =
        'As ferramentas para este motivo serão desenvolvidas em etapas futuras. Selecione "Visita Sistemática".';
    }

    if (!projetoSelecionado) {
      novosErros.projetoId =
        projetos.length === 0
          ? 'Cadastre um projeto antes de iniciar uma visita.'
          : 'Selecione um projeto cadastrado para iniciar a visita.';
    } else if (!clienteDoProjeto) {
      novosErros.projetoId = 'O contratante deste projeto está indisponível. Revise o vínculo em Projetos antes de iniciar a visita.';
    }

    if (!profissionais.some(p => p.id === executorId)) {
      novosErros.executorId = 'Selecione o profissional executor.';
    }

    if (!profissionais.some(p => p.id === responsavelTecnicoId)) {
      novosErros.responsavelTecnicoId = 'Selecione o responsável técnico.';
    }

    if (!dataVisita) {
      novosErros.dataVisita = 'Informe a data da visita.';
    }

    if (!identificacao.trim()) {
      novosErros.identificacao = 'Identificação da visita é obrigatória.';
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleIniciar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (iniciando || carregandoDados) return;
    setErroGeral(null);

    if (!validar() || !projetoSelecionado || !clienteDoProjeto) return;

    try {
      setIniciando(true);
      const novaVisita = await VisitaRepository.criar({
        id: `vis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        identificacao: identificacao.trim(),
        motivo,
        executorId,
        responsavelTecnicoId,
        projetoId: projetoSelecionado.id,
        identificacaoProjeto: projetoSelecionado.nome,
        clienteId: clienteDoProjeto.id,
        clienteNome: clienteDoProjeto.nomeRazaoSocial,
        data: dataVisita,
        status: 'em_andamento',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      if (onVisitCreated) {
        onVisitCreated(novaVisita);
      }

      onClose();
      // Redireciona imediatamente para a ferramenta operacional com mapa
      router.push(`/acompanhamento/visita/${novaVisita.id}`);
    } catch (err) {
      console.error('Erro ao iniciar visita:', err);
      setErroGeral(err instanceof Error ? err.message : 'Falha ao salvar a visita.');
    } finally {
      setIniciando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00AFF0] flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#333436]">
                Novo Trabalho de Campo
              </h2>
              <p className="text-xs text-slate-500">
                Inicie uma atividade de campo georreferenciada para a Delta S Engenharia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={iniciando}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleIniciar} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {erroGeral && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{erroGeral}</span>
            </div>
          )}

          {/* 10.1. Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Motivo da Visita *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'Visita Sistemática', label: 'Visita Sistemática', desc: 'Ativo nesta etapa' },
                { id: 'Mon. Fauna', label: 'Mon. Fauna', desc: 'Etapa futura' },
                { id: 'Mon. Flora', label: 'Mon. Flora', desc: 'Etapa futura' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    setMotivo(m.id as MotivoVisita);
                    if (m.id !== 'Visita Sistemática') {
                      setErros((prev) => ({
                        ...prev,
                        motivo:
                          'A ferramenta de monitoramento específico será desenvolvida posteriormente. Para esta etapa, utilize "Visita Sistemática".',
                      }));
                    } else {
                      setErros((prev) => ({ ...prev, motivo: '' }));
                    }
                  }}
                  className={`flex flex-col text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                    motivo === m.id
                      ? 'border-[#00AFF0] bg-blue-50 text-[#00AFF0] shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-sm">{m.label}</span>
                  <span
                    className={`text-[10px] mt-0.5 ${
                      m.id === 'Visita Sistemática' ? 'text-[#00AFF0]' : 'text-slate-400'
                    }`}
                  >
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>
            {erros.motivo && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1 font-medium">
                <Info className="w-3.5 h-3.5 shrink-0" />
                {erros.motivo}
              </p>
            )}
          </div>

          {/* Seleção de Projeto e Identificação Automática do Cliente Contratante */}
          <div className="space-y-3.5 pt-2 border-t border-slate-100">
            {/* Campo 1: Identificação do Projeto / Empreendimento (Obrigatório e Pesquisável) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Identificação do Projeto / Empreendimento *
                </label>
                {!tecnicoDesignado && <Link
                  href="/projetos"
                  onClick={onClose}
                  className="text-[11px] font-semibold text-[#00AFF0] hover:underline inline-flex items-center gap-1"
                >
                  <FolderKanban className="w-3 h-3" />
                  <span>Gerenciar Projetos</span>
                </Link>}
              </div>

              {projetos.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Cadastre um projeto antes de iniciar uma visita.</span>
                  </div>
                  <p>
                    Para garantir o rastreamento técnico, todas as visitas devem estar vinculadas a um projeto previamente cadastrado.
                  </p>
                  <Link
                    href="/projetos"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00AFF0] text-white rounded-lg font-semibold hover:bg-[#0098d1] transition-colors"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Ir para o Módulo Projetos</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Busca textual por nome do projeto ou cliente */}
                  {projetos.length > 2 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={buscaProjeto}
                        onChange={(e) => setBuscaProjeto(e.target.value)}
                        onKeyDown={impedirEnvioNaBusca}
                        placeholder="Pesquisar por projeto ou cliente contratante..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#00AFF0] bg-slate-50"
                      />
                    </div>
                  )}

                  <select
                    value={projetoId}
                    onChange={(e) => handleSelecionarProjeto(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-hidden focus:ring-2 bg-white transition-all ${
                      erros.projetoId
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                    }`}
                  >
                    <option value="">Selecione um projeto cadastrado...</option>
                    {projetosFiltrados.map((p) => {
                      const c = mapaClientes.get(p.clienteId);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nome} — Cliente Contratante: {c ? c.nomeRazaoSocial : 'Não identificado'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {erros.projetoId && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.projetoId}</p>
              )}
            </div>

            {/* Campo 2: Cliente Contratante (Informativo / Somente Leitura) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente Contratante <span className="text-slate-400 font-normal">(Informativo — Vinculado ao Projeto)</span>
              </label>

              <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00AFF0] shrink-0" />
                  <span className="font-semibold text-[#333436]">
                    {clienteDoProjeto ? clienteDoProjeto.nomeRazaoSocial : 'Selecione um projeto para identificar o contratante'}
                  </span>
                </div>
                {clienteDoProjeto?.cpfCnpj && (
                  <span className="text-[11px] text-slate-500 font-normal">
                    {clienteDoProjeto.cpfCnpj} • {clienteDoProjeto.cidade}/{clienteDoProjeto.estado}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                O cliente contratante é obtido automaticamente do projeto selecionado e não pode ser alterado diretamente aqui.
              </p>
            </div>
          </div>

          {/* 10.2 & 10.3. Executor e Responsável Técnico */}
          <section className="space-y-3 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Corpo Técnico</h3>
            {carregandoDados ? <p role="status" className="text-sm text-slate-600">Carregando técnicos…</p> :
              !profissionais.length ? <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p>{tecnicoDesignado ? 'Nenhum profissional disponível para a visita. Procure a administração.' : SEM_TECNICOS}</p>
                {!tecnicoDesignado && <Link href={CORPO_TECNICO} className="font-semibold text-sky-700 underline">Abrir Corpo Técnico</Link>}
              </div> :
              <div className="grid gap-4 sm:grid-cols-2">
                <SeletorTecnico rotulo="Executor da Visita" tecnicos={profissionais} value={executorId} erro={erros.executorId} fixo={!!executorVinculado}
                  onChange={id => { setExecutorId(id); setErros(prev => ({ ...prev, executorId: '' })); }} />
                <SeletorTecnico rotulo="Responsável Técnico (RT)" tecnicos={profissionais} value={responsavelTecnicoId} erro={erros.responsavelTecnicoId}
                  onChange={id => { setResponsavelTecnicoId(id); setErros(prev => ({ ...prev, responsavelTecnicoId: '' })); }} />
              </div>}
          </section>

          {/* 10.5 & 10.6. Data e Identificação */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data da Visita *
              </label>
              <input
                type="date"
                value={dataVisita}
                onChange={(e) => setDataVisita(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white"
              />
              {erros.dataVisita && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.dataVisita}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Identificação da Visita *
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={vinculacaoAutomatica}
                    onChange={(e) => setVinculacaoAutomatica(e.target.checked)}
                    className="rounded text-[#00AFF0] focus:ring-[#00AFF0]"
                  />
                  <span>Automática</span>
                </label>
              </div>
              <input
                type="text"
                value={identificacao}
                onChange={(e) => setIdentificacao(e.target.value)}
                readOnly={vinculacaoAutomatica}
                placeholder="Ex: VIS-20261014-001"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono focus:outline-hidden focus:ring-2 transition-all ${
                  vinculacaoAutomatica
                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                }`}
              />
              {erros.identificacao && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.identificacao}</p>
              )}
            </div>
          </div>

          {/* 10.7. Botão Iniciar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={iniciando}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={iniciando || carregandoDados || !profissionais.length || !projetos.length}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{iniciando ? 'Iniciando Visita...' : 'Iniciar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SeletorTecnico({ rotulo, tecnicos, value, onChange, erro, fixo = false }: {
  rotulo: string; tecnicos: TecnicoVisita[]; value: string; onChange: (id: string) => void; erro?: string; fixo?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const termo = normalizarBusca(busca);
  const filtrados = tecnicos.filter(p => normalizarBusca(p.nome).includes(termo));
  const opcoes = tecnicos.filter(p => p.id === value || filtrados.includes(p));
  const classe = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#00AFF0]';
  return <div className="min-w-0 space-y-2">
    {!fixo && <input type="search" aria-label={`Pesquisar por nome: ${rotulo}`} placeholder="Pesquisar por nome" className={classe}
      value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={impedirEnvioNaBusca} />}
    <label className="block text-xs font-semibold text-slate-700">{rotulo} *
      <select className={`${classe} mt-1`} value={value} disabled={fixo} onChange={e => onChange(e.target.value)}>
        <option value="">Selecione um técnico</option>
        {opcoes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
    {!filtrados.length && <p className="text-xs text-slate-500">Nenhum técnico encontrado nessa pesquisa.</p>}
    {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
  </div>;
}
