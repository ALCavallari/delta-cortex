import type { Profissional, Projeto } from '@/types';
import type { ArquivoGeografico } from '@/types/geographic';
import { ClienteSupabaseRepository } from './clientesSupabase';
import { acessoOperacional, bancoOperacional, confirmarLinha, conferirOperacao, listarPaginas } from './supabaseOperacional';
import { enviarGeografico, removerEnvioPendente } from './arquivosSupabase';

type LinhaProjeto = {
  id: string; cliente_id: string; nome: string; descricao: string; prazo: string | null;
  link_google_maps_original: string | null; criado_em: string; atualizado_em: string; excluido_em: string | null;
  utm_easting: number | null; utm_northing: number | null; utm_zona: number | null;
  utm_hemisferio: 'N' | 'S' | null; datum: 'SIRGAS 2000' | 'WGS84' | null;
  latitude: number | null; longitude: number | null;
};

function projetoDaLinha(r: LinhaProjeto): Projeto {
  const { utm_easting: easting, utm_northing: northing, utm_zona: zona, utm_hemisferio: hemisferio, datum, latitude, longitude } = r;
  return {
    id: r.id, clienteId: r.cliente_id, nome: r.nome, descricao: r.descricao, prazo: r.prazo,
    linkGoogleMapsOriginal: r.link_google_maps_original ?? undefined,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em, deletedAt: r.excluido_em,
    localizacao: easting !== null && northing !== null && zona !== null && hemisferio && datum && latitude !== null && longitude !== null
      ? { easting, northing, zona, hemisferio, datum, latitude, longitude } : undefined,
  };
}

async function listarProjetos(clienteId?: string) {
  await acessoOperacional();
  const banco = bancoOperacional();
  const linhas = await listarPaginas<LinhaProjeto>(id => {
    let consulta = banco.from('projetos').select('*').is('excluido_em', null).order('id').limit(500);
    if (clienteId) consulta = consulta.eq('cliente_id', clienteId);
    if (id) consulta = consulta.gt('id', id);
    return consulta.returns<LinhaProjeto[]>();
  }, 'listar projetos');
  return linhas.map(projetoDaLinha).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const ProjetoSupabaseRepository = {
  listar: () => listarProjetos(),
  listarPorCliente: listarProjetos,
  async obterPorId(id: string) {
    await acessoOperacional();
    const { data, error } = await bancoOperacional().from('projetos').select('*').eq('id', id)
      .is('excluido_em', null).maybeSingle<LinhaProjeto>();
    conferirOperacao(error, 'consultar o projeto');
    return data ? projetoDaLinha(data) : undefined;
  },
  async salvar(projeto: Projeto, arquivos?: { adicionar: Omit<ArquivoGeografico, 'projetoId'>[]; remover: string[]; progresso?: (id: string, valor: number) => void }, original?: Projeto) {
    const papel = await ClienteSupabaseRepository.obterAcesso();
    if (papel === 'leitor') throw new Error('Seu usuário não pode gravar projetos.');
    const enviados: Awaited<ReturnType<typeof enviarGeografico>>[] = [];
    const l = projeto.localizacao;
    try {
      for (const arquivo of arquivos?.adicionar ?? []) {
        enviados.push(await enviarGeografico(projeto.id, arquivo, valor => arquivos?.progresso?.(arquivo.id, valor)));
      }
      const linha = confirmarLinha(await bancoOperacional().rpc('delta_cortex_salvar_projeto', {
        p_editar: !!original,
        p_atualizado_em: original?.atualizadoEm ?? null,
        p_projeto: {
          id: projeto.id, cliente_id: projeto.clienteId, nome: projeto.nome, descricao: projeto.descricao,
          prazo: projeto.prazo ?? null, link_google_maps_original: projeto.linkGoogleMapsOriginal ?? null,
          utm_easting: l?.easting ?? null, utm_northing: l?.northing ?? null, utm_zona: l?.zona ?? null,
          utm_hemisferio: l?.hemisferio ?? null, datum: l?.datum ?? null, latitude: l?.latitude ?? null, longitude: l?.longitude ?? null,
        },
        p_adicionar: enviados, p_remover: arquivos?.remover ?? [],
      }), 'salvar o projeto') as unknown as LinhaProjeto;
      return projetoDaLinha(linha);
    } catch (erro) {
      // A política impede apagar um objeto que já tenha metadados confirmados.
      await Promise.allSettled(enviados.map(a => removerEnvioPendente(a.storage_bucket, a.storage_path)));
      throw erro;
    }
  },
  async excluir(id: string) {
    confirmarLinha(await bancoOperacional().from('projetos').update({ excluido_em: new Date().toISOString() })
      .eq('id', id).is('excluido_em', null).select('id').maybeSingle(), 'excluir o projeto');
  },
};

type LinhaProfissional = {
  id: string; nome: string; origem_temporaria: boolean; cargo: string | null;
  registro_profissional: string | null; rg: string | null; cpf: string | null; cnpj: string | null;
  contato: string | null; email: string | null; endereco: string | null; atribuicao: Profissional['atribuicao'] | null;
  placa_veiculo: string | null; criado_em: string; atualizado_em: string; excluido_em: string | null;
};

const colunasTecnico = 'id,nome,origem_temporaria,cargo,registro_profissional,rg,cpf,cnpj,contato,email,endereco,atribuicao,placa_veiculo,criado_em,atualizado_em,excluido_em';

function profissionalDaLinha(r: LinhaProfissional): Profissional {
  return {
    id: r.id, nome: r.nome, origemTemporaria: r.origem_temporaria, cargo: r.cargo ?? undefined,
    registroProfissional: r.registro_profissional ?? undefined, rg: r.rg ?? undefined, cpf: r.cpf ?? undefined,
    cnpj: r.cnpj ?? undefined, contato: r.contato ?? undefined, email: r.email ?? undefined,
    endereco: r.endereco ?? undefined, atribuicao: r.atribuicao ?? undefined, placaVeiculo: r.placa_veiculo ?? undefined,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em, deletedAt: r.excluido_em,
  };
}

type LinhaBanco = { profissional_id: string; chave_pix: string | null; banco: string | null; agencia: string | null; conta_corrente: string | null };

async function listarProfissionais(ativos: boolean, incluirDadosBancarios = false) {
  const perfil = await ClienteSupabaseRepository.obterAcesso();
  const banco = bancoOperacional();
  const linhas = await listarPaginas<LinhaProfissional>(id => {
    let consulta = banco.from('profissionais').select(colunasTecnico).order('id').limit(500);
    if (id) consulta = consulta.gt('id', id);
    if (ativos) consulta = consulta.is('excluido_em', null);
    return consulta.returns<LinhaProfissional[]>();
  }, 'listar profissionais');
  const profissionais = linhas.map(profissionalDaLinha).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!incluirDadosBancarios || perfil !== 'admin') return profissionais;

  const dados = await listarPaginas<LinhaBanco & { id: string }>(id => {
    let consulta = banco.from('profissionais_dados_bancarios').select('id:profissional_id,chave_pix,banco,agencia,conta_corrente')
      .order('profissional_id').limit(500);
    if (id) consulta = consulta.gt('profissional_id', id);
    return consulta.returns<(LinhaBanco & { id: string })[]>();
  }, 'consultar os dados bancários');
  const porId = new Map(dados.map(r => [r.id, r]));
  return profissionais.map(p => {
    const r = porId.get(p.id);
    return r ? { ...p, chavePix: r.chave_pix ?? undefined, banco: r.banco ?? undefined,
      agencia: r.agencia ?? undefined, contaCorrente: r.conta_corrente ?? undefined } : p;
  });
}

export const ProfissionalSupabaseRepository = {
  listar: () => listarProfissionais(false),
  listarComDadosBancarios: () => listarProfissionais(false, true),
  listarAtivos: () => listarProfissionais(true),
  async salvar(p: Profissional, original?: Profissional) {
    const perfil = await ClienteSupabaseRepository.obterAcesso();
    const bancarios = perfil === 'admin'
      ? { chave_pix: p.chavePix ?? null, banco: p.banco ?? null, agencia: p.agencia ?? null, conta_corrente: p.contaCorrente ?? null }
      : null;
    const linha = confirmarLinha(await bancoOperacional().rpc('delta_cortex_salvar_profissional', {
      p_atualizado_em: original?.atualizadoEm ?? null,
      p_profissional: {
        id: p.id, nome: p.nome, origem_temporaria: p.origemTemporaria, cargo: p.cargo ?? null,
        registro_profissional: p.registroProfissional ?? null, rg: p.rg ?? null, cpf: p.cpf ?? null, cnpj: p.cnpj ?? null,
        contato: p.contato ?? null, email: p.email ?? null, endereco: p.endereco ?? null,
        atribuicao: p.atribuicao ?? null, placa_veiculo: p.placaVeiculo ?? null,
      },
      p_bancarios: bancarios,
    }), 'salvar o profissional') as unknown as LinhaProfissional;
    const confirmado = profissionalDaLinha(linha);
    return bancarios ? { ...confirmado, chavePix: p.chavePix, banco: p.banco, agencia: p.agencia, contaCorrente: p.contaCorrente } : confirmado;
  },
  async definirExclusao(id: string, excluir: boolean) {
    confirmarLinha(await bancoOperacional().from('profissionais')
      .update({ excluido_em: excluir ? new Date().toISOString() : null }).eq('id', id).select('id').maybeSingle(),
    excluir ? 'excluir o profissional' : 'restaurar o profissional');
  },
};
