import L from 'leaflet';
import type { LegacyFeature } from 'geojson-vt';
import type { ArquivoGeografico, LimitesGeograficos } from '@/types/geographic';
import { criarWorkerGeografico } from '@/services/geographicWorker';

export function localizarLimites(map: L.Map, [oeste, sul, leste, norte]: LimitesGeograficos) {
  map.fitBounds([[sul, oeste], [norte, leste]], { padding: [32, 32], maxZoom: 17 });
}

const escala = 256 / 4096;
type Feature = LegacyFeature & { tags: {
  nome?: string; descricao?: string; pasta?: string; fill?: string; fillOpacity?: number;
  outline?: boolean; stroke?: string; strokeOpacity?: number; width?: number;
} | null };
type TilePendente = { desenhar: (features: Feature[]) => void; falhar: () => void };

function caminho(f: Feature): Path2D {
  const p = new Path2D();
  if (f.type === 1) {
    for (const [x, y] of f.geometry) {
      p.moveTo(x * escala + 3, y * escala);
      p.arc(x * escala, y * escala, 3, 0, 2 * Math.PI);
    }
  } else {
    // geojson-vt representa linhas e polígonos por conjuntos de partes.
    for (const parte of f.geometry) {
      if (!parte.length) continue;
      p.moveTo(parte[0][0] * escala, parte[0][1] * escala);
      for (let i = 1; i < parte.length; i++) p.lineTo(parte[i][0] * escala, parte[i][1] * escala);
      if (f.type === 3) p.closePath();
    }
  }
  return p;
}

function rotuloElemento(f: Feature, camada: string) {
  const div = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = f.tags?.nome || 'Elemento geográfico';
  div.append(titulo);
  for (const texto of [camada, f.tags?.pasta, f.tags?.descricao]) {
    if (!texto) continue;
    const linha = document.createElement('div');
    linha.textContent = String(texto);
    linha.style.whiteSpace = 'pre-wrap';
    linha.style.overflowWrap = 'anywhere';
    div.append(linha);
  }
  return div;
}

export function iniciarCamadaGeografica(
  map: L.Map, arquivo: ArquivoGeografico, opacidade: number,
  status: (mensagem: string, pronto: boolean) => void,
) {
  const worker = criarWorkerGeografico();
  const tiles = new Map<number, TilePendente>();
  const ids = new WeakMap<HTMLElement, number>();
  const frames = new Map<number, number>();
  let proximo = 0;
  let encerrada = false;
  let popup: L.Popup | undefined;
  const layer = new class extends L.GridLayer {
    protected override createTile(coords: L.Coords, done: L.DoneCallback) {
      return criarTile(coords, done);
    }
  }({ pane: 'arquivos-geograficos', maxNativeZoom: 19, maxZoom: 19, noWrap: true, opacity: opacidade, keepBuffer: 1 });
  const consultas = new Map<HTMLElement, (evento: MouseEvent) => boolean>();
  function consultar({ originalEvent }: L.LeafletMouseEvent) {
    for (const testar of consultas.values()) {
      if (testar(originalEvent)) break;
    }
  }
  let canvasDisponivel = true;

  function remover() {
    if (encerrada) return;
    encerrada = true;
    popup?.remove();
    map.off('click', consultar);
    consultas.clear();
    layer.remove();
    worker.terminate();
    for (const frame of frames.values()) cancelAnimationFrame(frame);
    frames.clear();
    tiles.clear();
  }

  function criarTile(coords: L.Coords, done: L.DoneCallback) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvasDisponivel = false;
      queueMicrotask(() => {
        status('Canvas indisponível neste dispositivo.', false);
        remover();
      });
      return canvas;
    }
    const id = ++proximo;
    ids.set(canvas, id);
    tiles.set(id, {
      falhar: () => done?.(new Error('Não foi possível carregar o bloco geográfico.'), canvas),
      desenhar(features) {
        let i = 0;
        const interativos: Feature[] = [];
        const quadro = () => {
          frames.delete(id);
          if (encerrada) return;
          const fim = performance.now() + 7;
          while (i < features.length && performance.now() < fim) {
            const feature = features[i++];
            const tags = feature.tags;
            const path = caminho(feature);
            if (feature.type === 1 || feature.type === 3) {
              ctx.fillStyle = tags?.fill || '#A3CA33';
              ctx.globalAlpha = feature.type === 1 ? 0.95 : tags?.fillOpacity ?? 0.24;
              ctx.fill(path, 'evenodd');
            }
            if (feature.type !== 3 || tags?.outline !== false) {
              ctx.globalAlpha = tags?.strokeOpacity ?? 1;
              ctx.strokeStyle = tags?.stroke || '#00AFF0';
              ctx.lineWidth = tags?.width ?? (feature.type === 1 ? 1 : 2);
              if (ctx.lineWidth > 0 && tags?.width !== 0) ctx.stroke(path);
            }
            if (tags?.nome || tags?.descricao) interativos.push(feature);
          }
          if (i < features.length) frames.set(id, requestAnimationFrame(quadro));
          else done?.(undefined, canvas);
        };
        frames.set(id, requestAnimationFrame(quadro));
        consultas.set(canvas, event => {
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX >= rect.right ||
            event.clientY < rect.top || event.clientY >= rect.bottom) return false;
          const x = (event.clientX - rect.left) * 256 / rect.width;
          const y = (event.clientY - rect.top) * 256 / rect.height;
          for (let j = interativos.length - 1; j >= 0; j--) {
            const f = interativos[j];
            const p = caminho(f);
            ctx.lineWidth = Math.max(7, f.tags?.width ?? 2);
            if ((f.type !== 2 && ctx.isPointInPath(p, x, y, 'evenodd')) || ctx.isPointInStroke(p, x, y)) {
              popup = L.popup().setLatLng(map.mouseEventToLatLng(event))
                .setContent(rotuloElemento(f, arquivo.nome)).openOn(map);
              return true;
            }
          }
          return false;
        });
      },
    });
    worker.postMessage({ tipo: 'tile', id, x: coords.x, y: coords.y, z: coords.z });
    return canvas;
  }

  layer.on('tileunload', (evento: L.TileEvent) => {
    consultas.delete(evento.tile);
    const id = ids.get(evento.tile);
    if (id === undefined) return;
    tiles.delete(id);
    const frame = frames.get(id);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frames.delete(id);
  });

  worker.onmessage = ({ data }) => {
    if (encerrada) return;
    if (data.tipo === 'progresso') status(`Preparando · ${data.percentual}%`, false);
    if (data.tipo === 'pronto') {
      layer.addTo(map);
      map.on('click', consultar);
      if (canvasDisponivel) status('Pronta', true);
    }
    if (data.tipo === 'tile') {
      const tile = tiles.get(data.id);
      tiles.delete(data.id);
      if (data.erro) tile?.falhar();
      else tile?.desenhar(data.features);
    }
    if (data.tipo === 'erro') {
      status(data.mensagem, false);
      remover();
    }
  };
  worker.onerror = () => {
    status('Não foi possível carregar esta camada neste dispositivo.', false);
    remover();
  };
  worker.postMessage({ arquivo: arquivo.original, formato: arquivo.formato, mapa: true });
  return { remover, definirOpacidade: (valor: number) => layer.setOpacity(valor) };
}
