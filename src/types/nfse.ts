export interface ConfiguracaoNFSe {
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  codigo_municipio: string;
  uf: string;
  codigo_tributacao_nacional: string;
  codigo_tributacao_municipal: string;
  codigo_nbs: string;
  descricao_servico: string;
  atualizado_em: string;
}
export interface PercentualMensalNFSe {
  id: string; // Primeiro dia do mês (YYYY-MM-01).
  percentual_centesimos: number; // 14,23% = 1423. Não é alíquota de ISS.
  atualizado_em: string;
}
export interface ContextoNFSe {
  configuracao: ConfiguracaoNFSe | null;
  percentuais: PercentualMensalNFSe[];
}
export interface PreparacaoEmissaoNFSe {
  origem: 'registro_manual';
  competencia: string | null;
  periodo: string | null;
  descricao: string | null;
  valor_centavos: number;
  emitente: ConfiguracaoNFSe | null;
  percentual: PercentualMensalNFSe | null;
  tomador: { nome: string; cpf_cnpj: string } | null;
}
