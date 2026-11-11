'use client';

import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapGeographicLayers } from './MapGeographicLayers';
import type { ArquivoGeografico } from '@/types/geographic';
import { attachFieldMarkers } from './fieldMarkers';
import { EnvironmentalIcon, environmentalIcons } from './EnvironmentalIcon';
import { MeioAmbiental } from '@/types';
import { RegistroCampo } from '@/types';
import { Check, Layers, Crosshair } from 'lucide-react';

type PontoMapa = [latitude: number, longitude: number];
export type EnquadramentoMapa = { centro: PontoMapa } | { pontos: PontoMapa[] };
const creditosSatelite = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

function enquadrarProjeto(map: L.Map, enquadramento: EnquadramentoMapa) {
  if ('centro' in enquadramento) {
    map.setView(enquadramento.centro, 16);
  } else if (enquadramento.pontos.length > 1) {
    map.fitBounds(L.latLngBounds(enquadramento.pontos), { padding: [48, 48], maxZoom: 16 });
  } else if (enquadramento.pontos[0]) {
    map.setView(enquadramento.pontos[0], 16);
  }
}

interface LeafletMapProps {
  creditosCompactos?: boolean;
  controles?: React.ReactNode;
  enquadramentoProjeto?: EnquadramentoMapa;
  historicoOperacional?: boolean;
  projetoId?: string;
  arquivosGeograficos?: ArquivoGeografico[];
  recentralizarProjeto?: number;
  consulta?: { enquadramento: EnquadramentoMapa; exibirHistorico: boolean };
  foco?: { ponto: PontoMapa };
  userLat: number | null;
  userLng: number | null;
  userAccuracy: number | null;
  registros: RegistroCampo[];
  onSelectMarker: (registro: RegistroCampo) => void;
  onCenterMapTrigger?: number;
}

export default function LeafletMap({
  creditosCompactos = false,
  userLat,
  userLng,
  userAccuracy,
  registros,
  onSelectMarker,
  onCenterMapTrigger,
  consulta,
  controles,
  enquadramentoProjeto,
  historicoOperacional,
  foco,
  recentralizarProjeto,
  projetoId,
  arquivosGeograficos,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [camadaAtual, setCamadaAtual] = useState<'satelite' | 'mapa'>('satelite');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const inicio = useRef({ enquadramento: consulta?.enquadramento, userLat, userLng });

  // Inicializa o Mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Posição inicial (se usuário tiver posição, usa ela; senão, centro do Brasil)
    const { enquadramento, userLat, userLng } = inicio.current;
    const centro = enquadramento && ('centro' in enquadramento ? enquadramento.centro : enquadramento.pontos[0]);
    const initialLat = centro?.[0] ?? userLat ?? -15.793889;
    const initialLng = centro?.[1] ?? userLng ?? -47.882778;
    const initialZoom = centro || (userLat !== null && userLng !== null) ? 16 : 4;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false, // reposicionado para melhor ergonomia
    });

    // Controle de zoom no canto superior direito para não colidir com cabeçalhos
    L.control.zoom({ position: 'topright' }).addTo(map);
    const pane = map.createPane('arquivos-geograficos');
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';

    // Layer de Satélite de Alta Resolução (Esri World Imagery)
    const sateliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: creditosSatelite,
      }
    );

    sateliteLayer.addTo(map);
    tileLayerRef.current = sateliteLayer;

    // Grupo para marcadores de registros
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = markersGroup;

    if (enquadramento) enquadrarProjeto(map, enquadramento);
    const observarTamanho = enquadramento ? new ResizeObserver(() => {
      map.invalidateSize({ animate: false, debounceMoveend: true });
    }) : undefined;
    observarTamanho?.observe(mapContainerRef.current);
    mapInstanceRef.current = map;

    return () => {
      observarTamanho?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controle = mapInstanceRef.current?.attributionControl;
    if (!creditosCompactos || !controle) return;
    const prefixo = controle.options.prefix;
    controle.setPrefix(false);
    return () => { controle.setPrefix(typeof prefixo === 'string' ? prefixo : false); };
  }, [creditosCompactos]);

  // Alterna entre Satélite e Cartografia (OpenStreetMap)
  const alternarCamada = (novaCamada: 'satelite' | 'mapa') => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let novoTile: L.TileLayer;
    if (novaCamada === 'satelite') {
      novoTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: creditosCompactos ? creditosSatelite : 'Tiles &copy; Esri &mdash; World Imagery',
        }
      );
    } else {
      novoTile = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }
      );
    }

    novoTile.addTo(mapInstanceRef.current);
    tileLayerRef.current = novoTile;
    setCamadaAtual(novaCamada);
  };

  // Atualiza Marcador do Usuário e Raio de Precisão
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLat !== null && userLng !== null) {
      const userLatLng = L.latLng(userLat, userLng);

      // Ícone do Usuário (Círculo azul pulsante)
      const userIcon = L.divIcon({
        className: 'custom-pulsing-marker',
        html: `
          <div class="pulsing-circle"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }

      // Círculo de Precisão em Metros
      if (userAccuracy && userAccuracy > 0) {
        if (!userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current = L.circle(userLatLng, {
            radius: userAccuracy,
            color: '#00AFF0',
            fillColor: '#00AFF0',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(map);
        } else {
          userAccuracyCircleRef.current.setLatLng(userLatLng);
          userAccuracyCircleRef.current.setRadius(userAccuracy);
        }
      }
    }
  }, [userLat, userLng, userAccuracy]);

  // Recentralizar no usuário quando acionado
  const recentralizarUsuario = () => {
    if (mapInstanceRef.current && userLat !== null && userLng !== null) {
      mapInstanceRef.current.setView([userLat, userLng], 17, {
        animate: true,
      });
    }
  };

  const recentralizarPorAcionamento = useEffectEvent(() => recentralizarUsuario());
  useEffect(() => {
    if (onCenterMapTrigger) recentralizarPorAcionamento();
  }, [onCenterMapTrigger]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && foco) map.setView(foco.ponto, Math.max(map.getZoom(), 17));
  }, [foco]);

  const enquadramento = consulta?.enquadramento ?? enquadramentoProjeto;
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && enquadramento && recentralizarProjeto) enquadrarProjeto(map, enquadramento);
  }, [enquadramento, recentralizarProjeto]);

  const distinguirResolvidas = !!consulta || !!historicoOperacional;
  // Atualiza Marcadores de Registros de Campo
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerGroupRef.current;
    if (!map || !group) return;

    return attachFieldMarkers(map, group, registros, onSelectMarker, distinguirResolvidas);
  }, [registros, onSelectMarker, distinguirResolvidas]);

  return (
    <div className="@container relative w-full h-full flex-1">
      {/* Contêiner Leaflet */}
      <div ref={mapContainerRef} className={`w-full h-full ${creditosCompactos ? '[&_.leaflet-control-attribution]:max-w-[78vw] [&_.leaflet-control-attribution]:text-[9px]! [&_.leaflet-control-attribution]:leading-tight!' : ''}`} />

      {/* Controles Flutuantes: Alternador de Camada e Recentralizar */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* Alternador de Camadas (Satélite / Cartografia) */}
        <div className="bg-white/95 backdrop-blur-xs rounded-xl shadow-md border border-slate-200/90 p-1 flex items-center">
          <button
            type="button"
            onClick={() => alternarCamada('satelite')}
            className={`${controles ? 'px-2 @min-[460px]:px-3' : 'px-3'} py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              camadaAtual === 'satelite'
                ? 'bg-[#333436] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Satélite</span>
          </button>
          <button
            type="button"
            onClick={() => alternarCamada('mapa')}
            className={`${controles ? 'px-2 @min-[460px]:px-3' : 'px-3'} py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              camadaAtual === 'mapa'
                ? 'bg-[#333436] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{controles ? <><span className="hidden @min-[460px]:inline">Mapa </span>Vetorial</> : 'Mapa Vetorial'}</span>
          </button>
        </div>
      </div>

      {/* Botão Flutuante: Recentralizar Minha Localização */}
      {controles}
      {!consulta && <div className={`absolute z-20 ${controles ? 'right-2 top-24' : 'right-14 top-4'}`}>
        <button
          type="button"
          onClick={recentralizarUsuario}
          disabled={userLat === null}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md border transition-all ${
            userLat !== null
              ? 'bg-white/95 backdrop-blur-xs text-[#00AFF0] border-slate-200 hover:bg-blue-50 active:scale-95'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
          }`}
          title="Recentralizar na minha localização GPS"
        >
          <Crosshair className={`w-4 h-4 ${userLat !== null ? 'animate-spin-slow' : ''}`} />
          {!controles && <span className="hidden sm:inline">Minha Localização</span>}
        </button>
      </div>}

      {projetoId && <MapGeographicLayers key={projetoId} projetoId={projetoId}
        arquivos={arquivosGeograficos} mapa={mapInstanceRef} consulta={!!consulta} />}

      {/* Legenda do Mapa (Canto Inferior Esquerdo) */}
      <div className="absolute bottom-6 left-4 z-20 bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-lg border border-slate-200 text-xs text-[#333436] max-w-xs space-y-1.5">
        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
          Tipos e Meios Ambientais
        </span>
        {consulta ? <>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#E53E3E]" /> Ocorrência em aberto</div>
          {consulta.exibirHistorico && <div className="flex items-center gap-2">
            <Check size={13} className="rounded-full bg-[#935757] text-white" aria-hidden /> Ocorrência resolvida
          </div>}
        </> : <>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#00AFF0] border border-white shadow-xs" />
          <span>Observação</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#E53E3E] border border-white shadow-xs" />
          <span>Ocorrência</span>
        </div>
        {historicoOperacional && <div className="flex items-center gap-2">
          <Check size={13} className="rounded-full bg-[#935757] text-white" aria-hidden /> Ocorrência resolvida
        </div>}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00AFF0] border-2 border-white ring-2 ring-blue-300" />
          <span>Minha Localização</span>
        </div>
        </>}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2">
          {(Object.keys(environmentalIcons) as MeioAmbiental[]).map(meio => <div key={meio} className="flex items-center gap-1.5"><EnvironmentalIcon meio={meio} size={15} /><span>{meio}</span></div>)}
        </div>
        <p className="text-[10px] text-slate-500">Toque no número para separar os pontos.</p>
      </div>
    </div>
  );
}
