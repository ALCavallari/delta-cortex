'use client';

import { usePerfil } from '@/components/auth/PerfilContext';
import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  Compass,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Navigation,
  Crosshair,
  Radio,
  FileCheck,
  Trash2,
  RotateCcw,
  History,
  X,
} from 'lucide-react';
import { Visita, RegistroCampo } from '@/types';
import {
  VisitaRepository,
  ProjetoRepository,
  ArquivoGeograficoRepository,
  RegistroCampoRepository,
} from '@/services/repositoriosOperacionais';
import { useGeolocation } from '@/hooks/useGeolocation';
import { FieldRecordModal } from '@/components/FieldRecordModal';
import { CamposFiltrosMapa, MapFilterToolbar } from '@/components/Map/MapFilterToolbar';
import type { EnquadramentoMapa } from '@/components/Map/LeafletMap';
import { normalizarBusca } from '@/services/technicians';
import { registrosNoMapa } from '@/services/fieldHistory';
import { ReportActivitiesModal } from '@/components/ReportActivitiesModal';
import { MarkerDetailsModal } from '@/components/Map/MarkerDetailsModal';

// Carregamento dinâmico sem SSR para o componente de mapa Leaflet
const LeafletMap = dynamic(() => import('@/components/Map/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <div className="w-12 h-12 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold tracking-wide">
        Carregando Camada Cartográfica e Satélite...
      </p>
      <span className="text-xs text-slate-400 mt-1">Delta CorteX SIG</span>
    </div>
  ),
});

function VisitaOperacionalContent() {
  const router = useRouter();
  const tecnicoDesignado = usePerfil() === 'tecnico';
  const voltar = tecnicoDesignado ? '/meus-trabalhos' : '/acompanhamento';
  const params = useParams();
  const visitaId = (params?.id as string) || '';

  const [visita, setVisita] = useState<Visita | null>(null);
  const [contexto, setRegistros] = useState<RegistroCampo[]>([]);
  const [historicoMapa, setHistoricoMapa] = useState(false);
  const [filtrosMapaAbertos, setFiltrosMapaAbertos] = useState(false);
  const [meioMapa, setMeioMapa] = useState('');
  const [gravidadeMapa, setGravidadeMapa] = useState('');
  const [situacaoMapa, setSituacaoMapa] = useState('');
  const [descricaoMapa, setDescricaoMapa] = useState('');
  const [focoProjeto, setFocoProjeto] = useState<{ enquadramento: EnquadramentoMapa; acionamento: number }>();
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  // Hook de Geolocalização com alta precisão e monitoramento contínuo
  const {
    latitude: userLat,
    longitude: userLng,
    accuracy: userAccuracy,
    loading: gpsLoading,
    error: gpsError,
    permissionDenied: gpsDenied,
    refreshLocation,
  } = useGeolocation({ enableHighAccuracy: true });

  const [relatorioModal, setRelatorioModal] = useState<'pergunta' | 'atividades' | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  // Modais operacionais
  const [modalRegistroAberto, setModalRegistroAberto] = useState(false);
  const [marcadorSelecionado, setMarcadorSelecionado] = useState<RegistroCampo | null>(null);
  const [modalExcluidosAberto, setModalExcluidosAberto] = useState(false);
  const [modoHistorico, setModoHistorico] = useState<'excluidos' | 'historico' | 'observacoes_excluidas'>('excluidos');
  const [registrosExcluidos, setRegistrosExcluidos] = useState<RegistroCampo[]>([]);
  const [carregandoExcluidos, setCarregandoExcluidos] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [centerMapTrigger, setCenterMapTrigger] = useState(0);

  // Carrega a visita e os registros de campo associados
  useEffect(() => {
    if (!visitaId) return;

    const carregarDados = async () => {
      try {
        setCarregando(true);
        setErroCarga('');
        const v = await VisitaRepository.obterPorId(visitaId);
        if (!v) {
          router.push(voltar);
          return;
        }
        setVisita(v);

        const regs = await RegistroCampoRepository.listarNoContexto(v);
        setRegistros(regs);
      } catch (err) {
        console.error('Erro ao carregar dados da visita:', err);
        setErroCarga(err instanceof Error ? err.message : 'Não foi possível carregar a visita.');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [visitaId, router, voltar]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  const handleAbrirNovoRegistro = () => {
    if (userLat === null || userLng === null) {
      if (gpsDenied) {
        alert(
          'Acesso à localização negado. Habilite a permissão de GPS no navegador para registrar pontos de campo georreferenciados.'
        );
      } else {
        alert('Aguardando sincronização do sinal de GPS. Tente novamente em instantes.');
      }
      return;
    }
    setModalRegistroAberto(true);
  };

  const handleRegistroSalvo = (novo: RegistroCampo) => {
    setRegistros((prev) => [...prev, novo]);
    showToast(`${novo.tipo} registrada com sucesso na posição atual!`);
  };

  const handleExcluirRegistro = async (registroId: string) => {
    try {
      await RegistroCampoRepository.excluirLogico(registroId);
      setRegistros((prev) => prev.filter((r) => r.id !== registroId));
      setMarcadorSelecionado(null);
      setRegistrosExcluidos(prev => prev.filter(r => r.id !== registroId));
      showToast('Registro excluído com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
      showToast('Falha ao excluir registro.');
    }
  };

  const abrirModalExcluidos = async (modo: 'excluidos' | 'historico' | 'observacoes_excluidas' = 'excluidos') => {
    if (!visita) return;
    setModoHistorico(modo);
    setRegistrosExcluidos([]);
    try {
      setCarregandoExcluidos(true);
      setModalExcluidosAberto(true);
      const todos = await RegistroCampoRepository.listarNoContexto(visita);
      setRegistrosExcluidos(todos.filter(r => {
        if (modo === 'observacoes_excluidas') {
          return r.tipo === 'Observacao' && r.visitaId === visita.id && !!r.deletedAt;
        }
        return r.tipo === 'Ocorrencia' && (modo === 'excluidos' ? !!r.deletedAt : !r.deletedAt);
      })
        .sort((a,b) => (b.deletedAt ?? b.registradoEm).localeCompare(a.deletedAt ?? a.registradoEm)));
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      showToast('Não foi possível carregar o histórico.');
    } finally {
      setCarregandoExcluidos(false);
    }
  };

  const handleRestaurarRegistro = async (id: string) => {
    try {
      await RegistroCampoRepository.restaurar(id);
      if (visita) setRegistros(await RegistroCampoRepository.listarNoContexto(visita));
      setRegistrosExcluidos((prev) => prev.filter((r) => r.id !== id));
      showToast('Registro restaurado com sucesso!');
    } catch (err) {
      console.error('Erro ao restaurar registro:', err);
      showToast('Falha ao restaurar registro.');
    }
  };

  const mudarSituacao = async (id: string, situacao: 'resolvido' | 'em_aberto') => {
    if (!visita) return;
    try {
      await RegistroCampoRepository.mudarSituacao(id, situacao, visita, contexto.find(r => r.id === id)?.versao);
      const todos = await RegistroCampoRepository.listarNoContexto(visita);
      setRegistros(todos);
      setRegistrosExcluidos(prev => prev.map(r => todos.find(atual => atual.id === r.id) ?? r));
      setMarcadorSelecionado(prev => prev?.id === id ? todos.find(r => r.id === id) ?? null : prev);
      showToast(situacao === 'resolvido' ? 'Registro resolvido.' : 'Registro reaberto.');
    } catch {
      showToast('Não foi possível atualizar a situação do registro.');
    }
  };

  const handleConcluirVisita = async () => {
    if (!visita || visita.status === 'concluida' || finalizando) return;
    const confirm = window.confirm(
      'Deseja marcar esta visita sistemática como Concluída? Você poderá reabri-la posteriormente no painel.'
    );
    if (!confirm) return;

    try {
      setFinalizando(true);
      await VisitaRepository.atualizarStatus(visita.id, 'concluida', visita.atualizadoEm);
      setVisita((prev) => (prev ? { ...prev, status: 'concluida' } : null));
      if (tecnicoDesignado) router.push(voltar); else setRelatorioModal('pergunta');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showToast('Não foi possível finalizar a visita. Tente novamente.');
    } finally { setFinalizando(false); }
  };

  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return '';
    if (dataStr.includes('-')) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
  };

  if (erroCarga) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-white">
      <p role="alert">{erroCarga}</p>
      <button type="button" className="rounded-lg bg-white/10 px-4 py-2" onClick={() => router.push(voltar)}>Voltar aos trabalhos</button>
    </div>;
  }

  if (carregando || !visita) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base font-semibold">Carregando Visita Sistemática...</p>
      </div>
    );
  }

  const registros = registrosNoMapa(contexto, visita);
  const idsVisiveis = new Set(registros.map(r => r.id));
  const termoMapa = normalizarBusca(descricaoMapa);
  const marcadores = contexto.filter(r => {
    const resolvida = r.situacao === 'resolvido';
    const incluirHistorico = historicoMapa && r.tipo === 'Ocorrencia' && resolvida &&
      !r.deletedAt && r.registradoEm <= visita.criadoEm;
    return (idsVisiveis.has(r.id) || incluirHistorico) &&
      (!meioMapa || r.meio === meioMapa) &&
      (!gravidadeMapa || r.gravidade === gravidadeMapa) &&
      (!historicoMapa || !situacaoMapa || resolvida === (situacaoMapa === 'resolvida')) &&
      (!termoMapa || normalizarBusca(r.descricao).includes(termoMapa));
  });

  async function centralizarNoProjeto() {
    if (!visita) return;
    const projetoId = visita.projetoId;
    try {
      const projeto = projetoId ? await ProjetoRepository.obterPorId(projetoId) : undefined;
      const local = projeto?.localizacao;
      let enquadramento: EnquadramentoMapa | undefined;
      if (local && Number.isFinite(local.latitude) && Number.isFinite(local.longitude) &&
          Math.abs(local.latitude) <= 90 && Math.abs(local.longitude) <= 180) {
        enquadramento = { centro: [local.latitude, local.longitude] };
      } else {
        const arquivos = projetoId ? await ArquivoGeograficoRepository.listar(projetoId) : [];
        const arquivo = arquivos.find(a => a.visivel) ?? arquivos[0];
        if (arquivo) {
          const [oeste, sul, leste, norte] = arquivo.metadados.foco;
          enquadramento = { pontos: [[sul, oeste], [norte, leste]] };
        } else {
          const pontos = registros.filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
            .map(r => [r.latitude, r.longitude] as [number, number]);
          if (pontos.length) enquadramento = { pontos };
        }
      }
      if (!enquadramento) {
        showToast('O projeto não possui localização nem pontos disponíveis para centralizar.');
        return;
      }
      const destino = enquadramento;
      setFocoProjeto(anterior => ({ enquadramento: destino, acionamento: (anterior?.acionamento ?? 0) + 1 }));
    } catch {
      showToast('Não foi possível consultar a localização do projeto.');
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden relative select-none">
      {relatorioModal === 'pergunta' && <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="relatorio-titulo" className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 text-[#333436]">
          <h2 id="relatorio-titulo" className="text-lg font-bold mb-3">Relatório de Visita</h2>
          <p className="text-sm mb-6">Deseja emitir o relatório de visita?</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push(voltar)} className="px-6 py-3 border border-slate-300 rounded-xl font-semibold">Não</button>
            <button type="button" onClick={() => setRelatorioModal('atividades')} className="px-6 py-3 bg-[#00AFF0] text-white rounded-xl font-semibold">Sim</button>
          </div>
        </section>
      </div>}
      {relatorioModal === 'atividades' && <ReportActivitiesModal visita={visita}
        onClose={() => router.push(voltar)} onDone={() => router.push(voltar)} />}
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#333436] text-white shadow-2xl border border-slate-700 text-xs sm:text-sm font-semibold animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-[#A3CA33] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 11.1 Cabeçalho Operacional Compacto */}
      <header className="h-16 sm:h-20 bg-[#333436] border-b border-slate-800 text-white px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-md">
        {/* Esquerda: Retorno e Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={voltar}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Voltar ao Trabalho de Campo"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-[#00AFF0] border border-blue-400/30">
                {visita.identificacao}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white max-w-[200px] sm:max-w-md truncate">
                {visita.clienteNome}
              </h1>
            </div>
            {visita.identificacaoProjeto ? (
              <span className="text-[11px] text-slate-400 truncate max-w-[240px] sm:max-w-md">
                {visita.identificacaoProjeto}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                {visita.motivo} • {formatarDataBR(visita.data)}
              </span>
            )}
          </div>
        </div>

        {/* Centro / Direita: Status do GPS e Ações */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Indicador de Sinal GPS */}
          <div
            onClick={() => refreshLocation()}
            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs hover:bg-slate-800 transition-colors"
            title="Clique para forçar sincronização do GPS"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                userLat !== null
                  ? 'bg-[#A3CA33] animate-pulse'
                  : gpsDenied
                  ? 'bg-red-500'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            <div className="flex flex-col text-[10px] leading-tight">
              <span className="font-semibold text-slate-300">
                {userLat !== null
                  ? `GPS Ativo (±${Math.round(userAccuracy || 0)}m)`
                  : gpsDenied
                  ? 'GPS Negado'
                  : 'Buscando GPS...'}
              </span>
              <span className="text-slate-500 hidden sm:inline">
                {registros.length} ponto(s) salvo(s)
              </span>
            </div>
          </div>

          {/* Botão de Histórico / Registros Excluídos */}
          <button
            type="button"
            onClick={() => abrirModalExcluidos('excluidos')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-semibold"
            title="Visualizar histórico do projeto e restaurar registros excluídos"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Excluídos</span>
          </button>

          {/* Botão de Finalizar Visita */}
          <button
            type="button"
            onClick={handleConcluirVisita}
            disabled={finalizando || visita.status === 'concluida'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              visita.status === 'concluida'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-default'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{finalizando ? 'Finalizando...' : visita.status === 'concluida' ? 'Concluída' : 'Finalizar Visita'}</span>
          </button>
          <LogoutButton escuro />
        </div>
      </header>

      {/* 11 & 12. Mapa de Tela Cheia */}
      <main className="flex-1 w-full h-full relative">
        <LeafletMap
          projetoId={visita.projetoId}
          userLat={userLat}
          userLng={userLng}
          userAccuracy={userAccuracy}
          registros={marcadores}
          historicoOperacional={historicoMapa}
          enquadramentoProjeto={focoProjeto?.enquadramento}
          recentralizarProjeto={focoProjeto?.acionamento}
          controles={<MapFilterToolbar historico={historicoMapa} aberto={filtrosMapaAbertos}
            onHistorico={valor => { setHistoricoMapa(valor); setSituacaoMapa(''); }}
            onAbrir={() => setFiltrosMapaAbertos(valor => !valor)} onCentralizar={() => void centralizarNoProjeto()}>
            <CamposFiltrosMapa historico={historicoMapa} meio={meioMapa} gravidade={gravidadeMapa}
              situacao={situacaoMapa} descricao={descricaoMapa} setMeio={setMeioMapa} setGravidade={setGravidadeMapa}
              setSituacao={setSituacaoMapa} setDescricao={setDescricaoMapa} />
            <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
              onClick={() => { setMeioMapa(''); setGravidadeMapa(''); setSituacaoMapa(''); setDescricaoMapa(''); setHistoricoMapa(false); }}>
              Limpar Filtros
            </button>
          </MapFilterToolbar>}
          onSelectMarker={(r) => setMarcadorSelecionado(r)}
          onCenterMapTrigger={centerMapTrigger}
        />

        {/* 14. BOTÃO FLUTUANTE DE OBSERVAÇÃO / OCORRÊNCIA */}
        <div className="absolute bottom-8 right-6 z-30 flex flex-col items-end gap-3">
          <button
            type="button"
            id="btn-novo-registro-campo"
            onClick={handleAbrirNovoRegistro}
            className="group relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#333436] hover:bg-[#252628] text-white flex items-center justify-center shadow-2xl shadow-black/60 border-3 border-[#00AFF0] active:scale-95 transition-all focus:outline-hidden"
            title="Novo Registro de Campo (Observação ou Ocorrência)"
          >
            {/* Ícone de Exclamação Oficial */}
            <AlertTriangle className="w-8 h-8 text-[#00AFF0] group-hover:scale-110 transition-transform" />

            {/* Pulso sutil no botão flutuante */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00AFF0] opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#00AFF0]" />
            </span>
          </button>
        </div>
      </main>

      {/* Modal / Bottom Sheet: Novo Registro de Campo */}
      <FieldRecordModal
        isOpen={modalRegistroAberto}
        onClose={() => setModalRegistroAberto(false)}
        visita={visita}
        capturedLat={userLat}
        capturedLng={userLng}
        capturedAccuracy={userAccuracy}
        onRecordSaved={handleRegistroSalvo}
      />

      {/* Modal: Detalhes do Marcador Selecionado */}
      <MarkerDetailsModal
        isOpen={!!marcadorSelecionado}
        onClose={() => setMarcadorSelecionado(null)}
        registro={marcadorSelecionado}
        onDelete={marcadorSelecionado?.deletedAt ? undefined : handleExcluirRegistro}
        visitaAtualId={visita.id}
        onResolver={id => void mudarSituacao(id, 'resolvido')}
      />

      {/* Modal: Registros Excluídos (Recuperação) */}
      {modalExcluidosAberto && !marcadorSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <History className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#333436]">
                    {modoHistorico === 'historico' ? 'Histórico de Ocorrências' : 'Registros Excluídos'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {visita.identificacaoProjeto ?? 'Registros desta visita'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalExcluidosAberto(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-6 py-2">
              {(['excluidos', 'observacoes_excluidas', 'historico'] as const).map(modo => <button key={modo} type="button"
                aria-pressed={modoHistorico === modo} disabled={carregandoExcluidos}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${modoHistorico === modo ? 'bg-sky-50 text-sky-800' : 'text-slate-600'}`}
                onClick={() => abrirModalExcluidos(modo)}>
                {modo === 'excluidos' ? 'Ocorrências excluídas' : modo === 'observacoes_excluidas' ? 'Observações excluídas desta visita' : 'Histórico do projeto'}
              </button>)}
            </div>
            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-sm">
              {carregandoExcluidos ? (
                <div className="py-8 text-center text-slate-500">
                  <div className="w-8 h-8 border-3 border-[#00AFF0] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Carregando registros...
                </div>
              ) : registrosExcluidos.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="font-semibold text-slate-700">Nenhum registro encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Não há apontamentos nesta listagem.
                  </p>
                </div>
              ) : (
                registrosExcluidos.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            r.tipo === 'Ocorrencia'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {r.tipo}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Meio {r.meio}
                        </span>
                        {r.gravidade && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase">
                            {r.gravidade}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{r.descricao}</p>
                      <p className="text-[10px] text-slate-400">
                        Registrado em {new Date(r.registradoEm).toLocaleString('pt-BR')}
                        {r.fotos && r.fotos.length > 0 && ` • ${r.fotos.length} foto(s)`}
                      </p>
                      <p className="text-xs">Origem: {r.visitaOrigemIdentificacao ?? r.visitaId}</p>
                      <p className="text-xs">{r.tecnicoNome ? `Técnico: ${r.tecnicoNome}` : 'Técnico responsável não identificado'}</p>
                      {r.deletedAt && <p className="text-xs">Excluído em {new Date(r.deletedAt).toLocaleString('pt-BR')}</p>}
                      {r.deletedAt && !!r.fotos?.length && <div className="flex flex-wrap gap-2 py-1">
                        {r.fotos.map(foto => <button type="button" key={foto.id} onClick={() => setMarcadorSelecionado(r)}
                          className="rounded-lg focus-visible:outline-2 focus-visible:outline-sky-600"
                          aria-label="Ver fotografias deste registro">
                          {/* Fotografias locais incorporadas, sem requisição ao otimizador. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={foto.dataUrl} alt="" loading="lazy" className="h-12 w-16 rounded-lg object-cover" />
                        </button>)}
                      </div>}
                      {r.tipo === 'Ocorrencia' && <p className="text-xs">{r.situacao === 'resolvido' ? 'Resolvido' : 'Em aberto'}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setMarcadorSelecionado(r)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Ver detalhes e fotos</button>
                      {modoHistorico !== 'historico' ? <button type="button" onClick={() => handleRestaurarRegistro(r.id)}
                        className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">Restaurar</button> :
                        r.situacao === 'resolvido' && <button type="button" onClick={() => void mudarSituacao(r.id, 'em_aberto')}
                          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Reabrir registro</button>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setModalExcluidosAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitaOperacionalPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
          <div className="w-12 h-12 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-base font-semibold">Carregando Visita Sistemática...</p>
        </div>
      }
    >
      <VisitaOperacionalContent />
    </Suspense>
  );
}
