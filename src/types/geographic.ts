export type LimitesGeograficos = [oeste: number, sul: number, leste: number, norte: number];

export interface MetadadosGeograficos {
  pontos: number;
  linhas: number;
  poligonos: number;
  ignorados: number;
  limites: LimitesGeograficos;
  foco: LimitesGeograficos;
}

export interface ArquivoGeografico {
  id: string;
  projetoId: string;
  nome: string;
  tamanho: number;
  formato: 'KMZ' | 'KML';
  importadoEm: string;
  original: Blob;
  metadados: MetadadosGeograficos;
  estado: 'pronto';
  visivel: boolean;
}
