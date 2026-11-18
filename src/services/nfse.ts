import type { Cliente } from '@/types';
import type { Contrato, Fatura } from '@/types/financeiro';
import type { ConfiguracaoNFSe, ContextoNFSe } from '@/types/nfse';
import { dataValida } from './faturamento';
import { validarCNPJ, validarCPF, validarEmail } from './validation';

export const configuracaoInicialNFSe: Omit<ConfiguracaoNFSe, 'atualizado_em'> = {
  razao_social: '', cnpj: '', inscricao_municipal: '', email: '', telefone: '', cep: '',
  logradouro: '', numero: '', complemento: '', bairro: '', municipio: 'Guarapuava',
  codigo_municipio: '4109401', uf: 'PR', codigo_tributacao_nacional: '070101',
  codigo_tributacao_municipal: '002', codigo_nbs: '114031000', descricao_servico: 'Engenharia e congêneres.',
};
export const formatarPercentual = (centesimos: number) => `${(centesimos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export function lerPercentual(texto: string): number | null {
  if (!/^\d{1,3}(?:,\d{1,2})?$/.test(texto.trim())) return null;
  const [inteiro, fracao = ''] = texto.trim().split(',');
  const valor = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return valor <= 10000 ? valor : null;
}
export function pendenciasConfiguracao(config: Omit<ConfiguracaoNFSe, 'atualizado_em'> | null): string[] {
  if (!config) return ['Cadastre os dados fiscais da Delta S em Configurações de NFS-e.'];
  const erros: string[] = [];
  if (!config.razao_social.trim() || !validarCNPJ(config.cnpj)) erros.push('Informe razão social e CNPJ válido do emitente.');
  if (!validarEmail(config.email) || config.telefone.replace(/\D/g, '').length < 10) erros.push('Informe e-mail e telefone válidos do emitente.');
  if (!/^\d{8}$/.test(config.cep) || !config.logradouro.trim() || !config.numero.trim() || !config.bairro.trim()) erros.push('Complete o endereço do emitente.');
  if (!config.municipio.trim() || !/^\d{7}$/.test(config.codigo_municipio) || !/^[A-Z]{2}$/.test(config.uf)) erros.push('Revise município, código IBGE e UF do emitente.');
  if (!/^\d{6}$/.test(config.codigo_tributacao_nacional) || !/^\d{3}$/.test(config.codigo_tributacao_municipal)
    || !/^\d{9}$/.test(config.codigo_nbs) || !config.descricao_servico.trim()) erros.push('Revise os códigos e a descrição do serviço.');
  return erros;
}
export function revisarFaturaNFSe(contrato: Contrato, fatura: Fatura, cliente: Cliente | undefined, contexto: ContextoNFSe) {
  const pendencias = pendenciasConfiguracao(contexto.configuracao);
  if (contrato.situacao !== 'vigente' || fatura.situacao !== 'pendente') pendencias.push('A fatura deve estar pendente e o contrato vigente.');
  if (!cliente) pendencias.push('O cliente vinculado está indisponível ou inativo.');
  else {
    if (!(cliente.tipoPessoa === 'PJ' ? validarCNPJ(cliente.cpfCnpj) : validarCPF(cliente.cpfCnpj))) pendencias.push('Revise o CPF/CNPJ do tomador no cadastro de Clientes.');
    if (!cliente.nomeRazaoSocial.trim() || !cliente.logradouro.trim() || !cliente.numero.trim() || !cliente.bairro.trim()
      || !cliente.cidade.trim() || !cliente.estado.trim() || cliente.cep.replace(/\D/g, '').length !== 8) pendencias.push('Complete o nome e endereço do tomador no cadastro de Clientes.');
  }
  const competencia = fatura.competencia_nfse;
  if (!competencia || !dataValida(competencia)) pendencias.push('Defina e salve a competência fiscal da fatura.');
  const percentual = competencia ? contexto.percentuais.find(p => p.id === `${competencia.slice(0, 7)}-01`) : undefined;
  if (competencia && !percentual) pendencias.push(`Cadastre o percentual do Simples Nacional para ${competencia.slice(0, 7).split('-').reverse().join('/')}.`);
  if (!fatura.descricao_nfse?.trim()) pendencias.push('Defina e salve a descrição individual da nota.');
  if (!fatura.periodo_servicos?.trim()) pendencias.push('Informe o período dos serviços.');
  return { percentual, pendencias };
}
