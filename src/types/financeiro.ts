import type { PreparacaoEmissaoNFSe } from './nfse';

export const periodicidades = {
  unico: 'Único', faseado: 'Faseado', mensal: 'Mensal', bimensal: 'Bimensal',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
} as const;
export type Periodicidade = keyof typeof periodicidades;
export type SituacaoContrato = 'vigente' | 'encerrado' | 'paralisado';
export const situacoesContrato: Record<SituacaoContrato, string> = {
  vigente: 'Vigente', encerrado: 'Encerrado', paralisado: 'Paralisado',
};
export interface Fatura {
  id: string;
  contrato_id: string;
  numero: number;
  data_faturamento: string;
  valor_centavos: number;
  situacao: 'pendente' | 'emitida';
  emitida_em: string | null;
  competencia_nfse?: string | null;
  periodo_servicos?: string | null;
  descricao_nfse?: string | null;
  preparacao_emissao?: PreparacaoEmissaoNFSe | null;
}
export interface Contrato {
  id: string;
  titulo: string;
  cliente_id: string;
  projeto_id: string;
  vigencia: string;
  parcelas: number;
  faturamento: Periodicidade;
  primeiro_faturamento: string | null;
  valor_total_centavos: number;
  texto_nfse: string;
  situacao: SituacaoContrato;
  criado_em: string;
  atualizado_em: string;
  clientes: { nome_razao_social: string } | null;
  projetos: { nome: string } | null;
  faturas: Fatura[];
}
export type ContratoSalvar = Omit<Contrato, 'clientes' | 'projetos' | 'faturas' | 'criado_em' | 'atualizado_em'>;
