import GeoJSONVT from 'geojson-vt';
import { lerGeografia } from './geographicParser';

let indice: GeoJSONVT | undefined;

self.onmessage = async ({ data }) => {
  if (data.tipo === 'tile') {
    try {
      const tile = indice?.getTile(data.z, data.x, data.y);
      self.postMessage({ tipo: 'tile', id: data.id, features: tile?.features ?? [] });
    } catch {
      self.postMessage({ tipo: 'erro', mensagem: 'Não foi possível renderizar esta camada neste dispositivo.' });
    }
    return;
  }
  try {
    const { metadados, features } = await lerGeografia(data.arquivo, data.formato,
      percentual => self.postMessage({ tipo: 'progresso', percentual }), data.mapa);
    if (data.mapa) {
      indice = new GeoJSONVT({ type: 'FeatureCollection', features }, {
        maxZoom: 19, indexMaxZoom: 4, indexMaxPoints: 30_000, extent: 4096, buffer: 64, tolerance: 3,
      });
    }
    self.postMessage({ tipo: 'pronto', metadados });
  } catch (error) {
    self.postMessage({ tipo: 'erro', mensagem: error instanceof Error ? error.message : 'Não foi possível ler o arquivo geográfico.' });
  }
};
