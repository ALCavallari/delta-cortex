import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { SaxesParser } from 'saxes';
import type { Feature, Geometry, Position } from 'geojson';
import type { LimitesGeograficos, MetadadosGeograficos } from '@/types/geographic';

const MiB = 1024 * 1024;
const maxKml = 128 * MiB;
type Estilo = { stroke?: string; strokeOpacity?: number; width?: number; fill?: string; fillOpacity?: number; outline?: boolean };
type Geometria = { tipo: 'Point' | 'LineString' | 'Polygon'; partes: Position[][] };
type Campo = { nome: string; texto: string; id?: string };

function limites(): LimitesGeograficos { return [Infinity, Infinity, -Infinity, -Infinity]; }
function juntar(a: LimitesGeograficos, b: LimitesGeograficos) {
  a[0] = Math.min(a[0], b[0]); a[1] = Math.min(a[1], b[1]);
  a[2] = Math.max(a[2], b[2]); a[3] = Math.max(a[3], b[3]);
}

function corKml(texto: string) {
  if (!/^[0-9a-f]{8}$/i.test(texto)) return;
  return {
    cor: '#' + texto.slice(6, 8) + texto.slice(4, 6) + texto.slice(2, 4),
    alpha: parseInt(texto.slice(0, 2), 16) / 255,
  };
}

export async function lerGeografia(
  arquivo: Blob, formato: 'KML' | 'KMZ', progresso: (percentual: number) => void = () => {},
  carregarGeometrias = true,
): Promise<{ metadados: MetadadosGeograficos; features: Feature[] }> {
  if (!arquivo.size || arquivo.size > (formato === 'KMZ' ? 32 * MiB : maxKml)) {
    throw new Error('Arquivo vazio ou acima do limite de tamanho (32 MiB KMZ / 128 MiB KML).');
  }

  const features: Feature[] = [];
  const metadados: MetadadosGeograficos = { pontos: 0, linhas: 0, poligonos: 0, ignorados: 0, limites: limites(), foco: limites() };
  const celulas = new Map<string, { n: number; bounds: LimitesGeograficos }>();
  const estilos = new Map<string, Estilo>();
  const aliases = new Map<string, string>();
  const pilha: Campo[] = [];
  const pastas: string[] = [];
  let placemark: { nome?: string; descricao?: string; estilo?: Estilo; referencia?: string; geometrias: Geometry[] } | undefined;
  let geometria: Geometria | undefined;
  let estilo: Estilo | undefined;
  let posicoes = 0;
  let raizValida = false;

  function coordenadas(texto: string) {
    const partes = texto.trim().split(/\s+/);
    posicoes += partes.length;
    if (posicoes > 3_000_000) throw new Error('Arquivo muito complexo: limite de 3 milhões de coordenadas.');
    return partes.map(parte => {
      const valores = parte.split(',');
      const ponto = valores.map(Number);
      if ((ponto.length !== 2 && ponto.length !== 3) || valores.some(v => !v.trim()) ||
        !ponto.every(Number.isFinite) || Math.abs(ponto[0]) > 180 || Math.abs(ponto[1]) > 90) {
        throw new Error('O KML contém coordenadas geográficas inválidas.');
      }
      return ponto;
    });
  }

  function terminarGeometria() {
    if (!geometria || !placemark) return;
    const { tipo, partes } = geometria;
    const primeira = partes[0];
    if (tipo === 'Polygon') {
      if (!partes.length || partes.some(anel => anel.length < 4 ||
        anel[0][0] !== anel.at(-1)?.[0] || anel[0][1] !== anel.at(-1)?.[1])) {
        throw new Error('O KML contém um polígono com anel inválido.');
      }
      placemark.geometrias.push({ type: 'Polygon', coordinates: partes });
    } else if (tipo === 'LineString' && partes.length === 1 && primeira?.length >= 2) {
      placemark.geometrias.push({ type: 'LineString', coordinates: primeira });
    } else if (tipo === 'Point' && partes.length === 1 && primeira?.length === 1) {
      placemark.geometrias.push({ type: 'Point', coordinates: primeira[0] });
    } else {
      throw new Error('O KML contém ponto ou linha com geometria inválida.');
    }
    geometria = undefined;
  }

  function terminarPlacemark() {
    if (!placemark) return;
    const pasta = pastas.filter(Boolean).join(' / ').slice(0, 1024);
    for (const geometry of placemark.geometrias) {
      const bounds = limites();
      if (geometry.type === 'Point') metadados.pontos++;
      else if (geometry.type === 'LineString') metadados.linhas++;
      else if (geometry.type === 'Polygon') metadados.poligonos++;
      else continue;
      const anelOuLinha = geometry.type === 'Polygon' ? geometry.coordinates.flat() :
        geometry.type === 'LineString' ? geometry.coordinates : [geometry.coordinates];
      for (const [lng, lat] of anelOuLinha) juntar(bounds, [lng, lat, lng, lat]);
      juntar(metadados.limites, bounds);
      const [lng, lat] = anelOuLinha[0];
      const chave = `${Math.floor(lng * 50)},${Math.floor(lat * 50)}`;
      const celula = celulas.get(chave) ?? { n: 0, bounds: limites() };
      celula.n++;
      // Linhas longas e elementos distantes continuam disponíveis no mapa.
      juntar(celula.bounds, [lng, lat, lng, lat]);
      celulas.set(chave, celula);
      if (carregarGeometrias) features.push({
        type: 'Feature', geometry,
        properties: { nome: placemark.nome, descricao: placemark.descricao, pasta, referencia: placemark.referencia, estilo: placemark.estilo },
      });
    }
    placemark = undefined;
  }

  let totalGeometrias = 0;
  const parser = new SaxesParser();
  parser.on('error', () => { throw new Error('XML KML inválido ou incompleto.'); });
  parser.on('doctype', () => { throw new Error('Declarações DTD não são aceitas em KML.'); });
  parser.on('opentag', tag => {
    const nome = tag.name.split(':').at(-1)!;
    if (!pilha.length) {
      if (nome !== 'kml') throw new Error('O documento não possui uma raiz KML válida.');
      raizValida = true;
    }
    if (pilha.length >= 128) throw new Error('XML KML muito complexo.');
    pilha.push({ nome, texto: '', id: tag.attributes.id });
    if (nome === 'Folder') pastas.push('');
    if (nome === 'Placemark') {
      if (placemark) throw new Error('O KML contém marcadores aninhados inválidos.');
      placemark = { geometrias: [] };
    }
    if (nome === 'Style') estilo = {};
    if (['NetworkLink', 'GroundOverlay', 'ScreenOverlay', 'Track', 'MultiTrack', 'Model'].includes(nome)) metadados.ignorados++;
    if (placemark && (nome === 'Point' || nome === 'LineString' || nome === 'Polygon')) {
      if (geometria) throw new Error('O KML contém geometrias aninhadas inválidas.');
      if (++totalGeometrias > 200_000) throw new Error('Arquivo muito complexo: limite de 200 mil geometrias.');
      geometria = { tipo: nome, partes: [] };
    }
  });
  const capturar = new Set(['coordinates', 'name', 'description', 'styleUrl', 'color', 'width', 'fill', 'outline', 'key']);
  function texto(texto: string) {
    const campo = pilha.at(-1);
    if (!campo || !capturar.has(campo.nome)) return;
    if (campo.nome === 'coordinates' && campo.texto.length + texto.length > 32 * MiB) {
      throw new Error('Uma geometria do KML é muito complexa.');
    }
    if (campo.nome === 'coordinates') campo.texto += texto;
    else if (campo.texto.length < 8192) campo.texto += texto.slice(0, 8192 - campo.texto.length);
  }
  parser.on('text', texto);
  parser.on('cdata', texto);
  parser.on('closetag', () => {
    const campo = pilha.pop()!;
    const pai = pilha.at(-1);
    const valor = campo.texto.trim();
    if (campo.nome === 'name' && pai?.nome === 'Folder') pastas[pastas.length - 1] = valor;
    if (placemark && pai?.nome === 'Placemark') {
      if (campo.nome === 'name') placemark.nome = valor;
      if (campo.nome === 'description') placemark.descricao = valor;
      if (campo.nome === 'styleUrl' && valor.startsWith('#')) placemark.referencia = valor.slice(1);
    }
    if (pai?.nome === 'Pair' && (campo.nome === 'key' || campo.nome === 'styleUrl')) {
      pai.texto += campo.nome === 'key' ? valor + ' ' : valor;
    }
    if (campo.nome === 'Pair' && pai?.nome === 'StyleMap' && pai.id && valor.startsWith('normal #')) {
      aliases.set(pai.id, valor.slice(8));
    }
    if (estilo) {
      if (campo.nome === 'color') {
        const cor = corKml(valor);
        if (cor && pai?.nome === 'LineStyle') { estilo.stroke = cor.cor; estilo.strokeOpacity = cor.alpha; }
        if (cor && pai?.nome === 'IconStyle') estilo.fill = cor.cor;
        if (cor && pai?.nome === 'PolyStyle') { estilo.fill = cor.cor; estilo.fillOpacity = cor.alpha; }
      }
      if (campo.nome === 'width' && pai?.nome === 'LineStyle' && Number.isFinite(Number(valor))) estilo.width = Math.max(0, Math.min(16, Number(valor)));
      if (campo.nome === 'fill' && pai?.nome === 'PolyStyle' && valor === '0') estilo.fillOpacity = 0;
      if (campo.nome === 'outline' && pai?.nome === 'PolyStyle') estilo.outline = valor !== '0';
      if (campo.nome === 'Style') {
        if (campo.id) estilos.set(campo.id, estilo);
        if (placemark) placemark.estilo = estilo;
        estilo = undefined;
      }
    }
    if (geometria && campo.nome === 'coordinates') geometria.partes.push(coordenadas(valor));
    if (geometria && campo.nome === geometria.tipo) terminarGeometria();
    if (campo.nome === 'Placemark') terminarPlacemark();
    if (campo.nome === 'Folder') pastas.pop();
  });

  let bytes = 0;
  let totalBytes = arquivo.size;
  let ultimoPercentual = -1;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const destino = new WritableStream<Uint8Array>({
    write(chunk) {
      bytes += chunk.byteLength;
      if (bytes > maxKml || bytes > totalBytes) throw new Error('A descompressão excedeu o limite seguro.');
      parser.write(decoder.decode(chunk, { stream: true }));
      const percentual = Math.min(95, Math.floor(bytes * 95 / totalBytes));
      if (percentual !== ultimoPercentual) { progresso(percentual); ultimoPercentual = percentual; }
    },
  });

  if (formato === 'KMZ') {
    const zip = new ZipReader(new BlobReader(arquivo), { useWebWorkers: false });
    try {
      const candidatos = [];
      const nomes = new Set<string>();
      let entradas = 0, total = 0;
      for await (const entrada of zip.getEntriesGenerator()) {
        total += entrada.uncompressedSize;
        if (++entradas > 2048 || !Number.isSafeInteger(total) || total > 256 * MiB ||
          entrada.uncompressedSize > maxKml) throw new Error('O KMZ excede os limites seguros de descompressão.');
        const nome = entrada.filename.replace(/\\/g, '/').toLowerCase();
        if (nome.startsWith('/') || /[:\u0000]/.test(nome) || nome.split('/').includes('..') || nomes.has(nome)) {
          throw new Error('O KMZ contém caminhos internos inseguros ou duplicados.');
        }
        nomes.add(nome);
        if (!entrada.directory && nome.endsWith('.kml')) candidatos.push(entrada);
      }
      const kml = candidatos.find(e => e.filename.toLowerCase() === 'doc.kml') ??
        candidatos.sort((a, b) => a.filename.split('/').length - b.filename.split('/').length)[0];
      if (!kml || !kml.uncompressedSize || kml.encrypted) throw new Error('O KMZ precisa conter um documento KML válido e sem senha.');
      totalBytes = kml.uncompressedSize;
      await kml.getData(destino, { checkSignature: true, useWebWorkers: false });
      if (bytes !== totalBytes) throw new Error('Tamanho do KML descompactado não corresponde ao arquivo.');
      metadados.ignorados += candidatos.length - 1;
    } finally { await zip.close(); }
  } else {
    await arquivo.stream().pipeTo(destino);
  }

  parser.write(decoder.decode()).close();
  if (!raizValida || !(metadados.pontos + metadados.linhas + metadados.poligonos)) {
    throw new Error('Nenhum ponto, linha ou polígono compatível foi encontrado.');
  }
  let maior = 0;
  for (const celula of celulas.values()) {
    if (celula.n > maior) { maior = celula.n; metadados.foco = celula.bounds; }
  }
  if (maior < 3) metadados.foco = metadados.limites;
  for (const feature of features) {
    const props = feature.properties!;
    const referencia = props.referencia;
    const inline = props.estilo;
    delete props.referencia;
    delete props.estilo;
    Object.assign(props, estilos.get(aliases.get(referencia) ?? referencia), inline);
  }
  return { features, metadados };
}
