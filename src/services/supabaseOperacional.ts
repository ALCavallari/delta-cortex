import { criarClienteNavegador } from '@/lib/supabase/client';
import { lerPerfil } from '@/lib/supabase/perfil';
import { sessaoVerificada } from '@/lib/supabase/session';
import type { RegistroCampo } from '@/types';

export function bancoOperacional() {
  const banco = criarClienteNavegador();
  if (!banco) throw new Error('A conexão com o Supabase não está configurada.');
  return banco;
}

export async function acessoOperacional() {
  const banco = bancoOperacional();
  const sessao = await sessaoVerificada(banco);
  const perfil = sessao && await lerPerfil(banco, sessao.sub);
  if (!perfil) throw new Error('Seu acesso operacional está indisponível.');
  return perfil;
}

export type ContextoRestrito = {
  clientes: { id: string; nomeRazaoSocial: string }[];
  profissionalId: string | null;
  profissionais: { id: string; nome: string }[];
};

export async function contextoRestrito() {
  return confirmarLinha(await bancoOperacional().rpc('delta_cortex_contexto_restrito'), 'carregar os vínculos') as unknown as ContextoRestrito;
}

export async function ocorrenciasPortal(projetoId: string) {
  return confirmarLinha(await bancoOperacional().rpc('delta_cortex_ocorrencias_portal', { p_projeto: projetoId }),
    'listar ocorrências do portal') as unknown as RegistroCampo[];
}

export function conferirOperacao(erro: { code?: string } | null, acao: string) {
  if (!erro) return;
  if (erro.code === '42501' || erro.code === 'PGRST301') {
    throw new Error('Seu usuário não tem permissão para esta operação.');
  }
  if (erro.code === '40001') throw new Error('O registro mudou em outro dispositivo. Atualize a consulta.');
  if (erro.code === '23505') throw new Error('Já existe um cadastro com este identificador ou documento.');
  if (erro.code === '23503' || erro.code === '23514') {
    throw new Error('Os dados ou vínculos informados são inválidos. Revise o cadastro.');
  }
  throw new Error(`Não foi possível ${acao} no Supabase. Verifique a conexão e tente novamente.`);
}

export function confirmarLinha<T>(resultado: { data: T | null; error: { code?: string } | null }, acao: string): T {
  conferirOperacao(resultado.error, acao);
  if (resultado.data === null) throw new Error(`O Supabase não confirmou a operação de ${acao}.`);
  return resultado.data;
}

export async function listarPaginas<T>(
  consultar: (ultimoId?: string) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
  acao: string,
): Promise<T[]> {
  const itens: T[] = [];
  let ultimoId: string | undefined;
  for (;;) {
    const resultado = await consultar(ultimoId);
    const pagina = confirmarLinha(resultado, acao);
    if (!pagina.length) return itens;
    itens.push(...pagina);
    const proximo = (pagina.at(-1) as { id?: string | number }).id;
    if (proximo == null || String(proximo) === ultimoId) throw new Error('A paginação da consulta não avançou.');
    ultimoId = String(proximo);
  }
}
