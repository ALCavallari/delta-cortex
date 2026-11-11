'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, Filter, MapPin, Maximize2 } from 'lucide-react';
import { ArquivoGeograficoRepository, RegistroCampoRepository } from '@/services/repositoriosOperacionais';
import { ocorrenciasPortal } from '@/services/supabaseOperacional';
import { normalizarBusca } from '@/services/technicians';
import { validarCoordenadas } from '@/services/utm';
import type { Cliente, Projeto, RegistroCampo } from '@/types';
import { CamposFiltrosMapa, MapFilterToolbar } from './MapFilterToolbar';
import { MarkerDetailsModal } from './MarkerDetailsModal';
import { RelatoriosEmitidos } from '@/components/RelatoriosEmitidos';
import type { ArquivoGeografico } from '@/types/geographic';
import type { EnquadramentoMapa } from './LeafletMap';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-600">Carregando mapa…</p>,
});
const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const dataBR = (data: string) => new Date(data).toLocaleString('pt-BR');
const resolvida = (r: RegistroCampo) => r.situacao === 'resolvido';
const temCoordenadas = ({ latitude, longitude }: { latitude: number; longitude: number }) =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && validarCoordenadas(latitude, longitude);

export function ProjectOccurrenceMap({ projetos, clientes, carregando, portal = false, restrito = portal, exibirRelatorios = false }: {
  projetos: Projeto[]; clientes: Pick<Cliente, 'id' | 'nomeRazaoSocial'>[]; carregando: boolean;
  portal?: boolean; restrito?: boolean; exibirRelatorios?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const nomes = new Map(clientes.map(cliente => [cliente.id, cliente.nomeRazaoSocial]));
  const selecionado = projetos.find(projeto => projeto.id === projetoId);
  const termo = normalizarBusca(busca);
  const filtrados = projetos.filter(projeto => normalizarBusca(projeto.nome).includes(termo) ||
    normalizarBusca(nomes.get(projeto.clienteId) ?? '').includes(termo));
  const opcoes = projetos.filter(projeto => projeto.id === projetoId || filtrados.includes(projeto));

  if (carregando) return <p role="status" className="p-4 text-sm text-slate-600">Carregando projetos…</p>;
  if (!projetos.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
    {restrito ? 'Nenhum projeto autorizado. Procure a administração.' : 'Nenhum projeto cadastrado.'}
  </p>;

  return <div className="space-y-4">
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-semibold">
        <span>Pesquisar por projeto ou cliente</span>
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)} className={campo} placeholder="Nome do projeto ou cliente" />
      </label>
      <label className="space-y-1 text-sm font-semibold">
        <span>Selecionar Projeto</span>
        <select value={selecionado?.id ?? ''} onChange={e => setProjetoId(e.target.value)} className={campo}>
          <option value="">Selecione um projeto</option>
          {opcoes.map(projeto => <option key={projeto.id} value={projeto.id}>
            {projeto.nome} — {nomes.get(projeto.clienteId) ?? 'Cliente indisponível'}
          </option>)}
        </select>
      </label>
      {!filtrados.length && <p className="text-sm text-slate-600">Nenhum projeto encontrado para essa pesquisa.</p>}
    </div>
    {selecionado ? <>
      <OcorrenciasProjeto key={selecionado.id} projeto={selecionado} cliente={nomes.get(selecionado.clienteId)} portal={portal} />
      {exibirRelatorios && <RelatoriosEmitidos key={`relatorios-${selecionado.id}`} projetoId={selecionado.id} />}
    </>
      : <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <p id="selecionar-projeto-mapa">Selecione um projeto para consultar as ocorrências e expandir o mapa.</p>
        <button type="button" disabled aria-describedby="selecionar-projeto-mapa"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 opacity-50">
          <Maximize2 size={16} aria-hidden /> Mapa Expandido
        </button>
      </div>}
  </div>;
}

const filtrosVazios = { meio: '', gravidade: '', situacao: '', descricao: '' };

function OcorrenciasProjeto({ projeto, cliente, portal }: { projeto: Projeto; cliente?: string; portal: boolean }) {
  const [arquivos, setArquivos] = useState<ArquivoGeografico[]>([]);
  const [falhaArquivos, setFalhaArquivos] = useState(false);
  const [registros, setRegistros] = useState<RegistroCampo[] | null>(null);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [historico, setHistorico] = useState(false);
  const [rascunho, setRascunho] = useState(filtrosVazios);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosVazios);
  const { meio, gravidade, situacao, descricao } = filtrosAplicados;
  const [expandido, setExpandido] = useState(false);
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
  const [recentralizar, setRecentralizar] = useState(0);
  const botaoExpandir = useRef<HTMLButtonElement>(null);
  const botaoVoltar = useRef<HTMLButtonElement>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [foco, setFoco] = useState<{ ponto: [number, number] }>();
  const [selecionado, setSelecionado] = useState<RegistroCampo | null>(null);
  const [detalhes, setDetalhes] = useState<RegistroCampo | null>(null);
  const [falhaDetalhes, setFalhaDetalhes] = useState(false);

  useEffect(() => {
    if (!expandido) return;
    const origemFoco = botaoExpandir.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botaoVoltar.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      origemFoco?.focus({ preventScroll: true });
    };
  }, [expandido]);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      portal ? ocorrenciasPortal(projeto.id) : RegistroCampoRepository.listarOcorrenciasDoProjeto(projeto.id),
      portal ? [] : ArquivoGeograficoRepository.listar(projeto.id).catch(() => {
        if (ativo) setFalhaArquivos(true);
        return [];
      }),
    ]).then(([lista, camadas]) => {
      if (ativo) {
        setArquivos(camadas);
        setRegistros(lista.sort((a, b) => b.registradoEm.localeCompare(a.registradoEm)));
      }
    }).catch(() => { if (ativo) setFalha(true); });
    return () => { ativo = false; };
  }, [projeto.id, tentativa, portal]);

  useEffect(() => {
    if (!selecionado || portal) return;
    let ativo = true;
    void RegistroCampoRepository.obterPorId(selecionado.id).then(registro => {
      if (!ativo) return;
      if (!registro || registro.deletedAt) { setFalhaDetalhes(true); return; }
      setDetalhes({ ...selecionado, fotos: registro.fotos });
    }).catch(() => { if (ativo) setFalhaDetalhes(true); });
    return () => { ativo = false; };
  }, [selecionado, portal]);
  const detalheAtual = portal ? selecionado : detalhes;

  const enquadramento = useMemo<EnquadramentoMapa | undefined>(() => {
    const local = projeto.localizacao;
    if (local && temCoordenadas(local)) return { centro: [local.latitude, local.longitude] };
    const camada = arquivos.find(a => a.visivel) ?? arquivos[0];
    if (camada) {
      const [oeste, sul, leste, norte] = camada.metadados.foco;
      return { pontos: [[sul, oeste], [norte, leste]] };
    }
    const pontos = (registros ?? []).filter(temCoordenadas)
      .map(r => [r.latitude, r.longitude] as [number, number]);
    return pontos.length ? { pontos } : undefined;
  }, [projeto.localizacao, registros, arquivos]);

  const exibidos = useMemo(() => (registros ?? []).filter(r =>
    (historico || !resolvida(r)) &&
    (!meio || r.meio === meio) &&
    (!gravidade || r.gravidade === gravidade) &&
    (!historico || !situacao || resolvida(r) === (situacao === 'resolvida')) &&
    normalizarBusca(r.descricao).includes(normalizarBusca(descricao))),
  [registros, historico, meio, gravidade, situacao, descricao]);
  const marcadores = useMemo(() => exibidos.filter(temCoordenadas), [exibidos]);

  function abrirDetalhes(registro: RegistroCampo) {
    setDetalhes(null);
    setFalhaDetalhes(false);
    setSelecionado({ ...registro });
  }

  function irAoRegistro(registro: RegistroCampo) {
    if (temCoordenadas(registro)) setFoco({ ponto: [registro.latitude, registro.longitude] });
    abrirDetalhes(registro);
  }

  if (falha) return <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
    <p>Não foi possível carregar as ocorrências deste projeto.</p>
    <button type="button" className="rounded-lg border border-red-300 px-3 py-2" onClick={() => { setFalha(false); setTentativa(n => n + 1); }}>Tentar novamente</button>
  </div>;
  if (!registros) return <p role="status" className="p-4 text-sm text-slate-600">Carregando ocorrências…</p>;
  const resolvidas = registros.filter(resolvida).length;
  function alterarHistorico(valor: boolean) {
    setHistorico(valor);
    setRascunho(atual => ({ ...atual, situacao: '' }));
    setFiltrosAplicados(atual => ({ ...atual, situacao: '' }));
  }

  const controleHistorico = (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" role="switch" checked={historico} className="h-5 w-5 accent-[#00AFF0]" onChange={e => alterarHistorico(e.target.checked)} />
      Exibir Histórico
    </label>
  );
  const limparFiltros = (
    <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
      onClick={() => { setRascunho(filtrosVazios); setFiltrosAplicados(filtrosVazios); setHistorico(false); }}>Limpar Filtros</button>
  );
  const camposFiltros = <CamposFiltrosMapa historico={historico} {...rascunho}
    setMeio={valor => setRascunho(atual => ({ ...atual, meio: valor }))}
    setGravidade={valor => setRascunho(atual => ({ ...atual, gravidade: valor }))}
    setSituacao={valor => setRascunho(atual => ({ ...atual, situacao: valor }))}
    setDescricao={valor => setRascunho(atual => ({ ...atual, descricao: valor }))} />;
  const aplicarFiltros = <button type="button" className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800"
    onClick={() => {
      setFiltrosAplicados(rascunho);
      setMostrarFiltros(false);
      setFiltrosExpandidos(false);
    }}>Aplicar filtros</button>;

  return <div className="space-y-3">
    {falhaArquivos && <p role="alert" className="text-sm text-red-700">Não foi possível carregar as camadas geográficas.</p>}
    <section hidden={expandido} aria-label="Filtros das ocorrências" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        {controleHistorico}
        <button type="button" aria-expanded={mostrarFiltros} aria-controls="filtros-ocorrencias"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden"
          onClick={() => setMostrarFiltros(!mostrarFiltros)}><Filter size={16} /> Filtros</button>
        {limparFiltros}
      </div>
      <div id="filtros-ocorrencias" className={`${mostrarFiltros ? 'grid' : 'hidden'} gap-2 sm:grid-cols-2 lg:grid lg:grid-cols-4`}>
        {camposFiltros}
        <div className="flex justify-end sm:col-span-2 lg:col-span-4">{aplicarFiltros}</div>
      </div>
    </section>
    <div aria-live="polite" className={expandido ? 'hidden' : 'flex flex-wrap gap-2 text-xs text-slate-700'}>
      <span className="rounded-full bg-red-50 px-3 py-1.5">Ocorrências em aberto <strong>{registros.length - resolvidas}</strong></span>
      {historico && <span className="rounded-full bg-slate-200 px-3 py-1.5">Ocorrências resolvidas <strong>{resolvidas}</strong></span>}
      <span className="rounded-full bg-sky-50 px-3 py-1.5">Total exibido <strong>{exibidos.length}</strong></span>
    </div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-[55dvh] min-h-88 lg:h-144">
        <div className={expandido
          ? 'fixed inset-0 z-40 flex h-dvh flex-col bg-slate-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'
          : 'flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white'}>
          {expandido && <header className="flex shrink-0 items-center gap-3 bg-[#333436] px-3 py-2 text-white sm:px-5">
            <button ref={botaoVoltar} type="button" onClick={() => setExpandido(false)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold hover:bg-white/20">
              <ArrowLeft size={16} aria-hidden /> Voltar
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sky-200">Mapa de Ocorrências</p>
              <h2 className="truncate text-sm font-bold" title={projeto.nome}>{projeto.nome}</h2>
              <p className="truncate text-xs text-slate-300" title={cliente}>Cliente Contratante · {cliente ?? 'Indisponível'}</p>
            </div>
          </header>}
          <div className="@container relative isolate min-h-0 flex-1">
            {enquadramento ? <LeafletMap projetoId={projeto.id} arquivosGeograficos={arquivos} consulta={{ enquadramento, exibirHistorico: historico }} foco={foco}
              recentralizarProjeto={recentralizar} userLat={null} userLng={null} userAccuracy={null}
              registros={marcadores} onSelectMarker={abrirDetalhes}
              controles={expandido ? <MapFilterToolbar historico={historico} aberto={filtrosExpandidos}
                onHistorico={alterarHistorico}
                onAbrir={() => setFiltrosExpandidos(valor => !valor)} onCentralizar={() => setRecentralizar(valor => valor + 1)}>
                {camposFiltros}<div className="flex flex-wrap justify-end gap-2">{limparFiltros}{aplicarFiltros}</div>
              </MapFilterToolbar> : undefined} />
              : <div className="flex h-full flex-col items-center justify-center gap-3 bg-white p-6 pt-20 text-center text-sm text-slate-600">
                <MapPin aria-hidden /> Este projeto não tem localização cadastrada nem ocorrências com coordenadas válidas.
              </div>}
            {expandido && selecionado && !detalheAtual && <p role={falhaDetalhes ? 'alert' : 'status'}
              className="absolute bottom-6 right-3 z-20 rounded-lg bg-white p-2 text-xs shadow">
              {falhaDetalhes ? 'Não foi possível abrir os detalhes.' : 'Carregando detalhes…'}
            </p>}
            <div className={expandido ? 'hidden' : 'absolute right-14 top-4 z-20 flex items-center rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-xs'}>
              <button ref={botaoExpandir} type="button" title="Mapa Expandido" aria-label="Mapa Expandido"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100"
                onClick={() => { setFiltrosExpandidos(false); setExpandido(true); }}>
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden @min-[365px]:inline">Mapa Expandido</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <section aria-label="Lista de ocorrências" className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:flex lg:h-144 lg:flex-col">
        <h3 className="border-b border-slate-100 p-3 text-sm font-bold">Ocorrências</h3>
        {exibidos.length > marcadores.length && <p className="p-3 text-xs text-slate-600">Registros sem coordenadas válidas aparecem apenas na lista.</p>}
        {selecionado && !detalheAtual && <p role={falhaDetalhes ? 'alert' : 'status'} className="p-3 text-sm text-slate-600">
          {falhaDetalhes ? 'Não foi possível abrir os detalhes. Selecione o registro novamente.' : 'Carregando detalhes…'}
        </p>}
        {!exibidos.length ? <p className="p-3 text-sm text-slate-600">Nenhuma ocorrência corresponde à visualização atual.</p>
          : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto lg:max-h-none lg:flex-1">
            {exibidos.map(r => {
              const resolucao = resolvida(r) ? r.eventos?.filter(evento => evento.situacao === 'resolvido').at(-1) : undefined;
              return <li key={r.id}>
                <button type="button" onClick={() => irAoRegistro(r)} className="block w-full space-y-1 p-3 text-left hover:bg-sky-50 focus-visible:bg-sky-50">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {r.meio}{r.gravidade && ` · ${r.gravidade}`}
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                      {resolvida(r) ? <><Check size={13} aria-hidden /> Resolvida</> : 'Em aberto'}
                    </span>
                  </span>
                  <span className="line-clamp-2 break-words text-sm text-[#333436]">{r.descricao}</span>
                  <span className="block text-xs text-slate-600">Registro {dataBR(r.registradoEm)}</span>
                  {resolucao && <span className="block text-xs text-slate-600">Resolução {dataBR(resolucao.data)}</span>}
                </button>
              </li>;
            })}
          </ul>}
      </section>
    </div>
    {detalheAtual && <MarkerDetailsModal registro={detalheAtual} isOpen readOnly onClose={() => { setDetalhes(null); setSelecionado(null); }} />}
  </div>;
}
