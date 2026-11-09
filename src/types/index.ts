export type TipoPessoa = 'PF' | 'PJ';

export interface Cliente {
  id: string;
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  cpfCnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string; // UF: SP, MG, PR, etc.
  inscricaoEstadual?: string;
  telefone: string;
  email: string;
  responsavel: string;
  cargo: string;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt?: string | null;
}

export interface Profissional {
  id: string;
  nome: string;
  origemTemporaria: boolean;
  cargo?: string;
  registroProfissional?: string;
  rg?: string;
  cpf?: string;
  cnpj?: string;
  contato?: string;
  email?: string;
  endereco?: string;
  habilitado?: boolean;
  placaVeiculo?: string;
  chavePix?: string;
  banco?: string;
  agencia?: string;
  contaCorrente?: string;
  atualizadoEm?: string;
  deletedAt?: string | null;
  criadoEm?: string;
}

export interface Projeto {
  id: string;
  clienteId: string;
  nome: string;
  descricao: string;
  localizacao?: LocalizacaoProjeto;
  prazo?: string | null;
  linkGoogleMapsOriginal?: string;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt?: string | null;
}

export interface LocalizacaoProjeto {
  easting: number;
  northing: number;
  zona: number;
  hemisferio: 'N' | 'S';
  datum: 'SIRGAS 2000' | 'WGS84';
  latitude: number;
  longitude: number;
}

export type MotivoVisita = 'Visita Sistemática' | 'Mon. Fauna' | 'Mon. Flora';

export type StatusVisita = 'em_andamento' | 'concluida' | 'cancelada';

export interface Visita {
  id: string;
  identificacao: string;
  motivo: MotivoVisita;
  executorId: string;
  executorNome: string;
  responsavelTecnicoId: string;
  responsavelTecnicoNome: string;
  clienteId: string;
  clienteNome: string;
  projetoId?: string;
  identificacaoProjeto?: string;
  data: string; // YYYY-MM-DD
  status: StatusVisita;
  finalizadaEm?: string;
  atividadesRealizadas?: string[];
  criadoEm: string;
  atualizadoEm: string;
  deletedAt?: string | null;
}

export type TipoRegistro = 'Observacao' | 'Ocorrencia';

export type MeioAmbiental = 'Fauna' | 'Físico' | 'Flora' | 'Social';

export type GravidadeOcorrencia = 'Leve' | 'Grave' | 'Gravíssima';

export interface CoordenadasUTM {
  zona: number;
  hemisferio: 'N' | 'S';
  easting: number;
  northing: number;
  referenciaGeodesica: string; // 'WGS84'
  formatado: string;
}

export type SituacaoRegistro = 'em_aberto' | 'resolvido';
export interface EventoRegistro {
  situacao: SituacaoRegistro;
  data: string;
  visitaId: string;
  profissionalId?: string;
  profissionalNome?: string;
}

export interface RelatorioVisita {
  id: string;
  visitaId: string;
  projetoId?: string;
  nomeArquivo: string;
  geradoEm: string;
  atividades: string[];
  registroIds: string[];
  fotografiaIds: string[];
  pdf: Blob;
}

export interface RegistroCampo {
  versao?: number;
  projetoId?: string;
  visitaOrigemIdentificacao?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  situacao?: SituacaoRegistro;
  eventos?: EventoRegistro[];
  id: string;
  visitaId: string;
  tipo: TipoRegistro;
  meio: MeioAmbiental;
  descricao: string;
  gravidade?: GravidadeOcorrencia;
  latitude: number;
  longitude: number;
  precisaoMetros?: number;
  utmZona: number;
  utmHemisferio: 'N' | 'S';
  utmEasting: number;
  utmNorthing: number;
  referenciaGeodesica: string;
  registradoEm: string;
  fotos?: Fotografia[];
  deletedAt?: string | null;
}

export interface Fotografia {
  id: string;
  registroCampoId: string;
  visitaId: string;
  dataUrl: string; // Imagem com estampa indelével via Canvas
  capturadaEm: string;
  utmInfo: string;
  clienteProjetoInfo: string;
}

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
}
