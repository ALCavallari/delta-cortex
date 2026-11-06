import proj4 from 'proj4';
import { CoordenadasUTM } from '@/types';

// WGS84 geographic system
const WGS84_GEO = '+proj=longlat +datum=WGS84 +no_defs';

/**
 * Converte coordenadas geográficas decimais (WGS84) para coordenadas UTM (Universal Transverse Mercator).
 * Calcula automaticamente o Fuso/Zona UTM e o Hemisfério.
 */
export function converterParaUTM(latitude: number, longitude: number, arredondar = true): CoordenadasUTM {
  if (
    latitude === undefined ||
    latitude === null ||
    isNaN(latitude) ||
    longitude === undefined ||
    longitude === null ||
    isNaN(longitude)
  ) {
    throw new Error('Coordenadas geográficas inválidas para conversão UTM.');
  }

  // Fuso UTM: de 1 a 60 (cada fuso tem 6 graus de longitude)
  const zona = Math.min(60, Math.floor((longitude + 180) / 6) + 1);
  const hemisferio: 'N' | 'S' = latitude >= 0 ? 'N' : 'S';

  // Definição proj4 para a zona UTM correspondente
  const utmDef = `+proj=utm +zone=${zona} ${hemisferio === 'S' ? '+south' : ''} +datum=WGS84 +units=m +no_defs`;

  // proj4 aceita [longitude, latitude] e retorna [easting, northing]
  const [easting, northing] = proj4(WGS84_GEO, utmDef, [longitude, latitude]);

  const eastingFormatado = Math.round(easting);
  const northingFormatado = Math.round(northing);

  const formatado = `Zona ${zona}${hemisferio} | E: ${eastingFormatado.toLocaleString('pt-BR')} m | N: ${northingFormatado.toLocaleString('pt-BR')} m`;

  return {
    zona,
    hemisferio,
    easting: arredondar ? eastingFormatado : easting,
    northing: arredondar ? northingFormatado : northing,
    referenciaGeodesica: 'WGS84',
    formatado,
  };
}

/**
 * Valida se a latitude e longitude estão nos intervalos aceitáveis.
 */
export function validarCoordenadas(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Converte UTM para WGS84, preservando os valores de origem no chamador. */
export function converterUTMParaGeografica(easting: number, northing: number, zona: number, hemisferio: 'N' | 'S', datum: 'SIRGAS 2000' | 'WGS84') {
  if (![easting, northing, zona].every(Number.isFinite) || !Number.isInteger(zona) || zona < 1 || zona > 60 ||
      easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000 ||
      !['N', 'S'].includes(hemisferio) || !['SIRGAS 2000', 'WGS84'].includes(datum)) {
    throw new Error('Informe coordenadas UTM válidas em metros, fuso de 1 a 60, hemisfério e datum.');
  }
  // SIRGAS 2000: elipsoide GRS80 e transformação geocêntrica nula para WGS84.
  const referencia = datum === 'SIRGAS 2000' ? '+ellps=GRS80 +towgs84=0,0,0' : '+datum=WGS84';
  const origem = `+proj=utm +zone=${zona} ${hemisferio === 'S' ? '+south' : ''} ${referencia} +units=m +no_defs`;
  const [longitude, latitude] = proj4(origem, WGS84_GEO, [easting, northing]);
  const oeste = zona * 6 - 186;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -80 || latitude > 84 ||
      (hemisferio === 'S' ? latitude > 1e-8 : latitude < -1e-8) ||
      longitude < oeste - 1e-7 || longitude > oeste + 6 + 1e-7) {
    throw new Error('As coordenadas estão fora da área UTM do fuso ou hemisfério informado.');
  }
  return { latitude, longitude };
}

export function linkGoogleMaps(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function lerMetrosBR(valor: string): number {
  const texto = valor.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(texto)) return NaN;
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}
