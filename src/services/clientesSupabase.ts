import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cliente } from '@/types';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { limparCaracteres } from './validation';

export type PerfilClientes = 'admin' | 'editor' | 'leitor';

type LinhaCliente = {
  id: string;
  tipo_pessoa: Cliente['tipoPessoa'];
  nome_razao_social: string;
  cpf_cnpj: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  cargo: string | null;
  criado_em: string;
  atualizado_em: string;
  excluido_em: string | null;
};

const colunas = 'id,tipo_pessoa,nome_razao_social,cpf_cnpj,cep,logradouro,numero,complemento,bairro,cidade,estado,inscricao_estadual,telefone,email,responsavel,cargo,criado_em,atualizado_em,excluido_em';
const semPermissao = 'Seu usuário não tem autorização para esta operação no módulo Clientes.';
const sessaoExpirada = 'Sua sessão expirou. Entre novamente no Delta CorteX.';

export class ErroClientes extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroClientes';
  }
}

export function mensagemClientes(erro: unknown, alternativa: string) {
  return erro instanceof ErroClientes ? erro.message : alternativa;
}

function tratarErro(erro: { code?: string; name?: string }, status: number | undefined, alternativa: string): never {
  if (erro.code === '23505') throw new ErroClientes('Já existe um cliente cadastrado com este CPF ou CNPJ.');
  if (status === 401 || erro.code === 'PGRST301' || erro.code === 'PGRST303') throw new ErroClientes(sessaoExpirada);
  if (status === 403 || erro.code === '42501') throw new ErroClientes(semPermissao);
  if (status === 0 || (status !== undefined && status >= 500) || erro.name === 'AuthRetryableFetchError') {
    throw new ErroClientes('Não foi possível conectar ao Supabase. Verifique a conexão e tente novamente.');
  }
  if (erro.code?.startsWith('22') || ['23502', '23514'].includes(erro.code ?? '')) {
    throw new ErroClientes('O banco rejeitou os dados informados. Revise os campos e tente novamente.');
  }
  throw new ErroClientes(alternativa);
}

function paraCliente(linha: LinhaCliente): Cliente {
  return {
    id: linha.id, tipoPessoa: linha.tipo_pessoa, nomeRazaoSocial: linha.nome_razao_social,
    cpfCnpj: linha.cpf_cnpj, cep: linha.cep ?? '', logradouro: linha.logradouro ?? '',
    numero: linha.numero ?? '', complemento: linha.complemento ?? undefined,
    bairro: linha.bairro ?? '', cidade: linha.cidade ?? '', estado: linha.estado ?? '',
    inscricaoEstadual: linha.inscricao_estadual ?? undefined, telefone: linha.telefone ?? '',
    email: linha.email ?? '', responsavel: linha.responsavel ?? '', cargo: linha.cargo ?? '',
    criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em, deletedAt: linha.excluido_em,
  };
}

function paraLinha(cliente: Cliente): LinhaCliente {
  return {
    id: cliente.id, tipo_pessoa: cliente.tipoPessoa, nome_razao_social: cliente.nomeRazaoSocial,
    cpf_cnpj: cliente.cpfCnpj, cep: cliente.cep, logradouro: cliente.logradouro, numero: cliente.numero,
    complemento: cliente.complemento ?? null, bairro: cliente.bairro, cidade: cliente.cidade,
    estado: cliente.estado, inscricao_estadual: cliente.inscricaoEstadual ?? null,
    telefone: cliente.telefone, email: cliente.email, responsavel: cliente.responsavel, cargo: cliente.cargo,
    criado_em: cliente.criadoEm, atualizado_em: cliente.atualizadoEm, excluido_em: cliente.deletedAt ?? null,
  };
}

function clienteSupabase(): SupabaseClient {
  const supabase = criarClienteNavegador();
  if (!supabase) throw new ErroClientes('A integração de clientes com o Supabase não está configurada.');
  return supabase;
}

async function verificarAcesso(supabase: SupabaseClient, escrita = false): Promise<PerfilClientes> {
  let sessao: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
  try { sessao = await supabase.auth.getClaims(); }
  catch { throw new ErroClientes('Não foi possível conectar ao Supabase. Verifique a conexão e tente novamente.'); }
  if (sessao.error) {
    tratarErro(sessao.error, sessao.error.status, sessaoExpirada);
  }
  const id = sessao.data?.claims?.sub;
  if (!id) throw new ErroClientes(sessaoExpirada);
  const { data, error, status } = await supabase.from('acessos_usuarios').select('papel')
    .eq('user_id', id).eq('ativo', true).maybeSingle<{ papel: unknown }>();
  if (error) tratarErro(error, status, 'Não foi possível verificar sua autorização no módulo Clientes.');
  const perfil = data?.papel;
  if (perfil !== 'admin' && perfil !== 'editor' && perfil !== 'leitor') throw new ErroClientes(semPermissao);
  if (escrita && perfil === 'leitor') throw new ErroClientes(semPermissao);
  return perfil;
}

async function consultarLinhas(supabase: SupabaseClient, documento?: string): Promise<LinhaCliente[]> {
  const linhas: LinhaCliente[] = [];
  let ultimoId: string | undefined;
  for (;;) {
    let consulta = supabase.from('clientes').select(colunas).order('id').limit(500);
    if (ultimoId !== undefined) consulta = consulta.gt('id', ultimoId);
    consulta = documento ? consulta.like('cpf_cnpj', '%' + documento.split('').join('%') + '%') : consulta.is('excluido_em', null);
    const { data, error, status } = await consulta.returns<LinhaCliente[]>();
    if (error) tratarErro(error, status, 'Não foi possível consultar os clientes no Supabase.');
    if (!data?.length) return linhas;
    if (documento) {
      const correspondente = data.find(linha => limparCaracteres(linha.cpf_cnpj) === documento);
      if (correspondente) return [correspondente];
    } else linhas.push(...data);
    const proximo = data[data.length - 1].id;
    if (proximo === ultimoId) throw new ErroClientes('Não foi possível concluir a consulta de clientes.');
    ultimoId = proximo;
  }
}

export const ClienteSupabaseRepository = {
  obterAcesso: () => verificarAcesso(clienteSupabase()),

  async listar(): Promise<Cliente[]> {
    const supabase = clienteSupabase();
    await verificarAcesso(supabase);
    return (await consultarLinhas(supabase)).map(paraCliente);
  },

  async obterPorId(id: string): Promise<Cliente | undefined> {
    const supabase = clienteSupabase();
    await verificarAcesso(supabase);
    const { data, error, status } = await supabase.from('clientes').select(colunas)
      .eq('id', id).is('excluido_em', null).maybeSingle<LinhaCliente>();
    if (error) tratarErro(error, status, 'Não foi possível consultar o cliente.');
    return data ? paraCliente(data) : undefined;
  },

  async buscarPorCpfCnpj(cpfCnpj: string): Promise<Cliente | undefined> {
    const documento = limparCaracteres(cpfCnpj);
    if (documento.length !== 11 && documento.length !== 14) return undefined;
    const supabase = clienteSupabase();
    await verificarAcesso(supabase);
    const [linha] = await consultarLinhas(supabase, documento);
    return linha ? paraCliente(linha) : undefined;
  },

  async salvar(cliente: Cliente, editar: boolean): Promise<Cliente> {
    const supabase = clienteSupabase();
    await verificarAcesso(supabase, true);
    const { id, criado_em, excluido_em, ...alteracoes } = paraLinha(cliente);
    const tabela = supabase.from('clientes');
    const operacao = editar
      ? tabela.update(alteracoes).eq('id', id).is('excluido_em', null)
      : tabela.insert({ ...alteracoes, id, criado_em, excluido_em });
    const { data, error, status } = await operacao.select(colunas).maybeSingle<LinhaCliente>();
    if (error) tratarErro(error, status, 'Não foi possível gravar o cliente no Supabase.');
    if (!data) throw new ErroClientes('A gravação não foi confirmada. Verifique a permissão ou recarregue a listagem.');
    return paraCliente(data);
  },

  async excluir(id: string): Promise<void> {
    const supabase = clienteSupabase();
    await verificarAcesso(supabase, true);
    const agora = new Date().toISOString();
    const { count, error, status } = await supabase.from('clientes')
      .update({ excluido_em: agora, atualizado_em: agora }, { count: 'exact' }).eq('id', id).is('excluido_em', null);
    if (error) tratarErro(error, status, 'Não foi possível excluir o cliente no Supabase.');
    if (count !== 1) throw new ErroClientes('A exclusão não foi confirmada. Verifique a permissão ou recarregue a listagem.');
  },
};
