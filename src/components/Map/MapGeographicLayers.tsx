'use client';

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { Layers3, MapPin } from 'lucide-react';
import type L from 'leaflet';
import { ArquivoGeograficoRepository, ProjetoRepository } from '@/services/repositoriosOperacionais';
import type { ArquivoGeografico } from '@/types/geographic';
import { iniciarCamadaGeografica, localizarLimites } from './geographicCanvasLayer';

export function MapGeographicLayers({ projetoId, arquivos, mapa, consulta }: {
  projetoId: string;
  arquivos?: ArquivoGeografico[];
  mapa: RefObject<L.Map | null>;
  consulta: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregados, setCarregados] = useState<ArquivoGeografico[]>([]);
  const [falha, setFalha] = useState(false);
  useEffect(() => {
    if (arquivos) return;
    let ativo = true;
    void Promise.all([ArquivoGeograficoRepository.listar(projetoId), ProjetoRepository.obterPorId(projetoId)])
      .then(([lista, projeto]) => {
        if (!ativo) return;
        setCarregados(lista);
        const camada = lista.find(a => a.visivel);
        const map = mapa.current;
        if (!consulta && camada && map) {
          const local = projeto?.localizacao;
          if (local && Number.isFinite(local.latitude) && Number.isFinite(local.longitude) &&
            Math.abs(local.latitude) <= 90 && Math.abs(local.longitude) <= 180) {
            map.setView([local.latitude, local.longitude], 16);
          } else localizarLimites(map, camada.metadados.foco);
        }
      }).catch(() => { if (ativo) setFalha(true); });
    return () => { ativo = false; };
  }, [arquivos, consulta, mapa, projetoId]);
  const lista = arquivos ?? carregados;
  if (!lista.length && !falha) return null;
  return <div className="absolute left-4 top-16 z-20 max-w-[calc(100%_-_2rem)]">
    <button type="button" aria-expanded={aberto} onClick={() => setAberto(v => !v)}
      className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-md hover:bg-slate-100">
      <Layers3 size={16} aria-hidden /> Camadas
    </button>
    <section hidden={!aberto} aria-label="Camadas geográficas"
      className="mt-2 max-h-[min(40dvh,20rem)] w-64 max-w-full overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <h3 className="mb-2 font-bold text-[#333436]">Camadas geográficas</h3>
      {falha && <p role="alert" className="text-red-700">Não foi possível carregar os arquivos do projeto.</p>}
      <ul className="divide-y divide-slate-200">
        {lista.map(arquivo => <Camada key={arquivo.id} arquivo={arquivo} mapa={mapa} />)}
      </ul>
    </section>
  </div>;
}

function Camada({ arquivo, mapa }: { arquivo: ArquivoGeografico; mapa: RefObject<L.Map | null> }) {
  const [visivel, setVisivel] = useState(arquivo.visivel);
  const [opacidade, setOpacidade] = useState(1);
  const [situacao, setSituacao] = useState<{ mensagem: string; pronto: boolean }>();
  const [falhaPersistencia, setFalhaPersistencia] = useState(false);
  const controle = useRef<ReturnType<typeof iniciarCamadaGeografica> | null>(null);

  const opacidadeAtual = useEffectEvent(() => opacidade);
  useEffect(() => {
    if (!visivel) return;
    // Os filhos montam antes do efeito que inicializa o Leaflet.
    const frame = requestAnimationFrame(() => {
      const map = mapa.current;
      if (!map) return;
      try {
        controle.current = iniciarCamadaGeografica(map, arquivo, opacidadeAtual(),
          (mensagem, pronto) => setSituacao({ mensagem, pronto }));
      } catch {
        setSituacao({ mensagem: 'Camada indisponível neste dispositivo.', pronto: false });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      controle.current?.remover();
      controle.current = null;
    };
  }, [arquivo, mapa, visivel]);

  useEffect(() => { controle.current?.definirOpacidade(opacidade); }, [opacidade, visivel]);

  return <li className="space-y-1 py-2">
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={visivel} className="mt-1 h-4 w-4 shrink-0 accent-[#00AFF0]"
        onChange={e => {
          const valor = e.target.checked;
          setSituacao(undefined);
          setVisivel(valor);
          setFalhaPersistencia(false);
          void ArquivoGeograficoRepository.definirVisibilidade(arquivo.id, arquivo.projetoId, valor)
            .catch(() => setFalhaPersistencia(true));
        }} />
      <span className="min-w-0 break-words font-semibold">{arquivo.nome}</span>
    </label>
    <p className="text-xs text-slate-600">{visivel ? situacao?.mensagem ?? 'Carregando…' : 'Oculta'}</p>
    {falhaPersistencia && <p role="alert" className="text-xs text-red-700">A preferência de visibilidade não pôde ser salva.</p>}
    <button type="button" className="inline-flex items-center gap-1 py-1 text-xs font-semibold text-sky-800 hover:underline"
      onClick={() => { if (mapa.current) localizarLimites(mapa.current, arquivo.metadados.foco); }}>
      <MapPin size={14} aria-hidden /> Localizar Camada
    </button>
    {visivel && situacao?.pronto && <label className="flex items-center gap-2 text-xs text-slate-700">
      Opacidade <input type="range" min={0.15} max={1} step={0.05} value={opacidade} className="w-24 accent-[#00AFF0]"
        onChange={e => setOpacidade(Number(e.target.value))} />
    </label>}
  </li>;
}
