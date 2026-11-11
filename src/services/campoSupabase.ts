import type { EventoRegistro, Fotografia, RegistroCampo, RelatorioVisita, SituacaoRegistro, Visita } from '@/types';
import { baixarObjeto, BUCKET_VISITAS, enviarObjeto, removerEnvioPendente } from './arquivosSupabase';
import { acessoOperacional, bancoOperacional, confirmarLinha, conferirOperacao, listarPaginas } from './supabaseOperacional';

const visitas = 'visitas_sistematicas';
const registros = 'visitas_sistematicas_registros';
const fotografias = 'visitas_sistematicas_fotografias';
const relatorios = 'visitas_sistematicas_relatorios';
const agora = () => new Date().toISOString();

type LinhaVisita = {
  id: string; identificacao: string; projeto_id: string; cliente_id: string; data_visita: string;
  executor_id: string; executor_nome_snapshot: string; responsavel_tecnico_id: string; responsavel_tecnico_nome_snapshot: string;
  cliente_nome_snapshot: string; projeto_nome_snapshot: string; status: Visita['status']; atividades_realizadas: string[];
  criado_em: string; atualizado_em: string; finalizada_em: string | null; excluido_em: string | null;
};

function visitaDaLinha(v: LinhaVisita): Visita {
  return {
    id: v.id, identificacao: v.identificacao, motivo: 'Visita Sistemática', projetoId: v.projeto_id,
    clienteId: v.cliente_id, data: v.data_visita, executorId: v.executor_id, executorNome: v.executor_nome_snapshot,
    responsavelTecnicoId: v.responsavel_tecnico_id, responsavelTecnicoNome: v.responsavel_tecnico_nome_snapshot,
    clienteNome: v.cliente_nome_snapshot, identificacaoProjeto: v.projeto_nome_snapshot, status: v.status,
    atividadesRealizadas: v.atividades_realizadas, criadoEm: v.criado_em, atualizadoEm: v.atualizado_em,
    finalizadaEm: v.finalizada_em ?? undefined, deletedAt: v.excluido_em,
  };
}

async function listarVisitas(exclusao: 'ativas' | 'excluidas' | 'todas', projetoId?: string) {
  await acessoOperacional();
  const banco = bancoOperacional();
  const lista = await listarPaginas<LinhaVisita>(id => {
    let consulta = banco.from(visitas).select('*').order('id').limit(500);
    if (id) consulta = consulta.gt('id', id);
    if (projetoId) consulta = consulta.eq('projeto_id', projetoId);
    if (exclusao === 'ativas') consulta = consulta.is('excluido_em', null);
    if (exclusao === 'excluidas') consulta = consulta.not('excluido_em', 'is', null);
    return consulta.returns<LinhaVisita[]>();
  }, 'listar visitas');
  return lista.map(visitaDaLinha).sort((a, b) => b.data.localeCompare(a.data));
}

async function atualizarVisita(id: string, alteracoes: Record<string, unknown>, acao: string, versao?: string) {
  let consulta = bancoOperacional().from(visitas).update(alteracoes).eq('id', id);
  if (versao) consulta = consulta.eq('atualizado_em', versao);
  confirmarLinha(await consulta.select('id').maybeSingle(), acao);
}

export const VisitaSupabaseRepository = {
  listar: (incluirExcluidas = false) => listarVisitas(incluirExcluidas ? 'todas' : 'ativas'),
  listarExcluidas: () => listarVisitas('excluidas'),
  listarPorProjeto: (id: string) => listarVisitas('ativas', id),
  async contarPorProjeto(id: string) {
    const { error, count } = await bancoOperacional().from(visitas).select('id', { count: 'exact', head: true })
      .eq('projeto_id', id).is('excluido_em', null);
    conferirOperacao(error, 'contar as visitas');
    return count ?? 0;
  },
  async obterPorId(id: string) {
    await acessoOperacional();
    const { data, error } = await bancoOperacional().from(visitas).select('*').eq('id', id)
      .is('excluido_em', null).maybeSingle<LinhaVisita>();
    conferirOperacao(error, 'consultar a visita');
    return data ? visitaDaLinha(data) : undefined;
  },
  async criar(dados: Omit<Visita, 'identificacao' | 'executorNome' | 'responsavelTecnicoNome'>) {
    if (!dados.projetoId || dados.motivo !== 'Visita Sistemática') throw new Error('Selecione um projeto para o Acompanhamento Sistemático.');
    return visitaDaLinha(confirmarLinha(await bancoOperacional().from(visitas).insert({
      id: dados.id, projeto_id: dados.projetoId, cliente_id: dados.clienteId,
      data_visita: dados.data, executor_id: dados.executorId, responsavel_tecnico_id: dados.responsavelTecnicoId,
    }).select('*').maybeSingle<LinhaVisita>(), 'criar a visita'));
  },
  excluirLogico: (id: string) => atualizarVisita(id, { excluido_em: agora() }, 'excluir a visita'),
  restaurar: (id: string) => atualizarVisita(id, { excluido_em: null }, 'restaurar a visita'),
  atualizarStatus: (id: string, status: Visita['status'], versao?: string) => atualizarVisita(id, {
    status, finalizada_em: status === 'concluida' ? agora() : null,
  }, 'alterar o status da visita', versao),
  async vincularProjeto(): Promise<void> {
    throw new Error('Visitas sem projeto devem ser revisadas no processo de migração dos dados locais.');
  },
};

type LinhaEvento = {
  id: number; visita_id: string; nova_situacao: SituacaoRegistro; ocorrido_em: string;
  profissional_id: string; profissional_nome_snapshot: string;
};
type LinhaRegistro = {
  id: string; projeto_id: string; visita_origem_id: string; tipo: RegistroCampo['tipo']; meio_ambiental: RegistroCampo['meio'];
  descricao: string; gravidade: RegistroCampo['gravidade'] | null; situacao: SituacaoRegistro | null;
  latitude: number; longitude: number; precisao_metros: number | null; utm_zona: number;
  utm_hemisferio: 'N' | 'S'; utm_easting: number; utm_northing: number; referencia_geodesica: string;
  tecnico_id: string; tecnico_nome_snapshot: string; registrado_em: string; excluido_em: string | null; versao: number;
  visitas_sistematicas: { identificacao: string } | null;
  visitas_sistematicas_eventos: LinhaEvento[];
};
type LinhaFoto = {
  id: string; registro_id: string; visita_id: string; storage_bucket: string; storage_path: string;
  capturada_em: string; utm_info: string; cliente_projeto_info: string;
};

async function urlDaFoto(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível ler a fotografia.'));
    leitor.readAsDataURL(blob);
  });
}

export const FotografiaSupabaseRepository = {
  async listarPorRegistro(registroId: string): Promise<Fotografia[]> {
    const banco = bancoOperacional();
    const linhas = await listarPaginas<LinhaFoto>(id => {
      let consulta = banco.from(fotografias).select('*').eq('registro_id', registroId)
        .is('excluido_em', null).order('id').limit(500);
      if (id) consulta = consulta.gt('id', id);
      return consulta.returns<LinhaFoto[]>();
    }, 'listar fotografias');
    return Promise.all(linhas.map(async f => ({
      id: f.id, registroCampoId: f.registro_id, visitaId: f.visita_id,
      dataUrl: await urlDaFoto(await baixarObjeto(f.storage_bucket, f.storage_path)),
      capturadaEm: f.capturada_em, utmInfo: f.utm_info, clienteProjetoInfo: f.cliente_projeto_info,
    })));
  },
};

type ConexaoRegistro = { banco: ReturnType<typeof bancoOperacional>; token: string; usuarioId: string };

async function enviarFoto(foto: Fotografia, conexao?: ConexaoRegistro) {
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(foto.dataUrl)) throw new Error('Formato de fotografia inválido.');
  const blob = await (await fetch(foto.dataUrl)).blob();
  const nome = `${foto.id}.${blob.type.split('/')[1]}`;
  const path = `${foto.visitaId}/fotografias/${foto.id}/${crypto.randomUUID()}-${nome}`;
  await enviarObjeto(BUCKET_VISITAS, path, blob, blob.type, undefined, conexao);
  return {
    id: foto.id, registro_id: foto.registroCampoId, visita_id: foto.visitaId, nome_arquivo: nome,
    storage_path: path, tamanho_bytes: blob.size, tipo_mime: blob.type,
    capturada_em: foto.capturadaEm, utm_info: foto.utmInfo, cliente_projeto_info: foto.clienteProjetoInfo,
  };
}

async function registroDaLinha(r: LinhaRegistro, incluirFotos: boolean): Promise<RegistroCampo> {
  const eventos: EventoRegistro[] = [...r.visitas_sistematicas_eventos]
    .sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em) || a.id - b.id).map(e => ({
      visitaId: e.visita_id, situacao: e.nova_situacao, data: e.ocorrido_em,
      profissionalId: e.profissional_id, profissionalNome: e.profissional_nome_snapshot,
    }));
  return {
    id: r.id, projetoId: r.projeto_id, visitaId: r.visita_origem_id, tipo: r.tipo, meio: r.meio_ambiental,
    descricao: r.descricao, gravidade: r.gravidade ?? undefined, situacao: r.situacao ?? undefined, eventos,
    latitude: r.latitude, longitude: r.longitude, precisaoMetros: r.precisao_metros ?? undefined, utmZona: r.utm_zona,
    utmHemisferio: r.utm_hemisferio, utmEasting: r.utm_easting, utmNorthing: r.utm_northing,
    referenciaGeodesica: r.referencia_geodesica, tecnicoId: r.tecnico_id, tecnicoNome: r.tecnico_nome_snapshot,
    visitaOrigemIdentificacao: r.visitas_sistematicas?.identificacao, registradoEm: r.registrado_em,
    deletedAt: r.excluido_em, versao: r.versao,
    fotos: incluirFotos ? await FotografiaSupabaseRepository.listarPorRegistro(r.id) : undefined,
  };
}

const camposRegistro = '*,visitas_sistematicas(identificacao),visitas_sistematicas_eventos(*)';

async function listarRegistros(filtro: { visitaId?: string; projetoId?: string; excluidos?: boolean }, fotos: boolean) {
  await acessoOperacional();
  const banco = bancoOperacional();
  const consultar = (coluna: 'visita_origem_id' | 'projeto_id', valor: string) =>
    listarPaginas<LinhaRegistro>(id => {
      let consulta = banco.from(registros).select(camposRegistro).eq(coluna, valor).order('id').limit(500);
      if (id) consulta = consulta.gt('id', id);
      if (coluna === 'projeto_id') {
        consulta = consulta.eq('tipo', 'Ocorrencia');
        if (filtro.visitaId) consulta = consulta.neq('visita_origem_id', filtro.visitaId);
      }
      if (filtro.excluidos === true) consulta = consulta.not('excluido_em', 'is', null);
      if (filtro.excluidos === false) consulta = consulta.is('excluido_em', null);
      return consulta.returns<LinhaRegistro[]>();
    }, 'listar registros de campo');
  const lista = (await Promise.all([
    filtro.visitaId ? consultar('visita_origem_id', filtro.visitaId) : [],
    filtro.projetoId ? consultar('projeto_id', filtro.projetoId) : [],
  ])).flat();
  return Promise.all(lista.map(r => registroDaLinha(r, fotos)));
}

async function excluirRegistro(id: string, excluido: boolean) {
  confirmarLinha(await bancoOperacional().from(registros).update({ excluido_em: excluido ? agora() : null })
    .eq('id', id).select('id').maybeSingle(), excluido ? 'excluir o registro' : 'restaurar o registro');
}

export const RegistroCampoSupabaseRepository = {
  listarNoContexto: (visita: Visita, incluirFotos = true) =>
    listarRegistros({ visitaId: visita.id, projetoId: visita.projetoId }, incluirFotos),
  listarOcorrenciasDoProjeto: (projetoId: string) => listarRegistros({ projetoId, excluidos: false }, false),
  listarExcluidosPorVisita: (visitaId: string) => listarRegistros({ visitaId, excluidos: true }, true),
  excluirLogico: (id: string) => excluirRegistro(id, true),
  restaurar: (id: string) => excluirRegistro(id, false),
  async mudarSituacao(id: string, situacao: SituacaoRegistro, visita: Visita, versao?: number) {
    if (versao == null) throw new Error('Atualize a consulta antes de mudar a situação da ocorrência.');
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_mudar_situacao_ocorrencia', {
      p_registro_id: id, p_visita_id: visita.id, p_situacao: situacao, p_versao: versao,
    }), 'alterar a situação da ocorrência');
  },
  async obterPorId(id: string) {
    await acessoOperacional();
    const { data, error } = await bancoOperacional().from(registros).select(camposRegistro)
      .eq('id', id).maybeSingle<LinhaRegistro>();
    conferirOperacao(error, 'consultar o registro');
    return data ? registroDaLinha(data, true) : undefined;
  },
  async editar(visitaId: string, original: RegistroCampo, atualizado: RegistroCampo) {
    if (original.versao == null) throw new Error('Atualize a consulta antes de editar o registro.');
    const fotosOriginais = new Set(original.fotos?.map(foto => foto.id));
    const fotosAtuais = new Set(atualizado.fotos?.map(foto => foto.id));
    const enviadas: Awaited<ReturnType<typeof enviarFoto>>[] = [];
    try {
      for (const foto of atualizado.fotos ?? []) {
        if (!fotosOriginais.has(foto.id)) enviadas.push(await enviarFoto(foto));
      }
      const resultado = await bancoOperacional().rpc('delta_cortex_editar_registro', {
        p_visita_id: visitaId,
        p_registro_id: original.id,
        p_versao: original.versao,
        p_descricao_anterior: original.descricao,
        p_alteracoes: {
          tipo: atualizado.tipo, meio_ambiental: atualizado.meio, descricao: atualizado.descricao,
          gravidade: atualizado.gravidade ?? null, latitude: atualizado.latitude, longitude: atualizado.longitude,
          precisao_metros: atualizado.precisaoMetros ?? null, utm_zona: atualizado.utmZona,
          utm_hemisferio: atualizado.utmHemisferio, utm_easting: atualizado.utmEasting,
          utm_northing: atualizado.utmNorthing, referencia_geodesica: atualizado.referenciaGeodesica,
        },
        p_fotos_novas: enviadas,
        p_fotos_removidas: [...fotosOriginais].filter(id => !fotosAtuais.has(id)),
      });
      if (resultado.error?.code === 'PDC01') throw new Error('O tipo do registro é usado no histórico e precisa ser mantido.');
      if (resultado.error?.code === 'PDC02') throw new Error('Uma das fotos removidas integra um relatório emitido. Mantenha essa foto e salve novamente.');
      const versao = confirmarLinha(resultado, 'editar o registro de campo');
      if (typeof versao !== 'number') throw new Error('O Supabase não confirmou a versão atualizada do registro.');
      return versao;
    } catch (erro) {
      await Promise.allSettled(enviadas.map(f => removerEnvioPendente(BUCKET_VISITAS, f.storage_path)));
      throw erro;
    }
  },
  async salvar(r: RegistroCampo, conexao: ConexaoRegistro) {
    const { banco, usuarioId } = conexao;
    // O registro e seus vínculos de fotos são gravados pela mesma RPC.
    const anterior = await banco.from(registros).select('id')
      .eq('id', r.id).eq('visita_origem_id', r.visitaId).eq('criado_por', usuarioId).maybeSingle();
    conferirOperacao(anterior.error, 'confirmar o registro de campo');
    if (anterior.data) return;
    const enviadas: Awaited<ReturnType<typeof enviarFoto>>[] = [];
    try {
      for (const foto of r.fotos ?? []) enviadas.push(await enviarFoto(foto, conexao));
      confirmarLinha(await banco.rpc('delta_cortex_salvar_registro', {
        p_registro: {
          id: r.id, projeto_id: r.projetoId, visita_origem_id: r.visitaId, tipo: r.tipo, meio_ambiental: r.meio,
          descricao: r.descricao, gravidade: r.gravidade ?? null, latitude: r.latitude, longitude: r.longitude,
          precisao_metros: r.precisaoMetros ?? null, utm_zona: r.utmZona, utm_hemisferio: r.utmHemisferio,
          utm_easting: r.utmEasting, utm_northing: r.utmNorthing, referencia_geodesica: r.referenciaGeodesica,
          registrado_em: r.registradoEm,
        },
        p_fotografias: enviadas,
      }), 'salvar o registro de campo');
    } catch (erro) {
      await Promise.allSettled(enviadas.map(f => removerEnvioPendente(BUCKET_VISITAS, f.storage_path, banco)));
      throw erro;
    }
  },
};

type LinhaRelatorio = {
  id: string; visita_id: string; nome_arquivo: string; gerado_em: string; atividades: string[];
  registro_ids: string[]; fotografia_ids: string[]; storage_bucket: string; storage_path: string;
};

export type RelatorioListado = Omit<RelatorioVisita, 'pdf'> & { identificacaoVisita?: string };
export type TextoRegistroRelatorio = { id: string; anterior: string; descricao: string };
type LinhaRelatorioComVisita = LinhaRelatorio & { visitas_sistematicas?: { identificacao: string } };

function resumoRelatorio(r: LinhaRelatorioComVisita): RelatorioListado {
  return {
    id: r.id, visitaId: r.visita_id, nomeArquivo: r.nome_arquivo, geradoEm: r.gerado_em,
    atividades: r.atividades, registroIds: r.registro_ids, fotografiaIds: r.fotografia_ids,
    identificacaoVisita: r.visitas_sistematicas?.identificacao,
  };
}

async function listarLinhasRelatorio(filtro: { visitaId: string } | { projetoId: string }) {
  const banco = bancoOperacional();
  const linhas = await listarPaginas<LinhaRelatorioComVisita>(id => {
    let consulta = banco.from(relatorios)
      .select('id,visita_id,nome_arquivo,gerado_em,atividades,registro_ids,fotografia_ids,storage_bucket,storage_path,visitas_sistematicas!inner(identificacao)')
      .is('excluido_em', null).is('visitas_sistematicas.excluido_em', null).order('id').limit(500);
    consulta = 'visitaId' in filtro ? consulta.eq('visita_id', filtro.visitaId)
      : consulta.eq('visitas_sistematicas.projeto_id', filtro.projetoId);
    if (id) consulta = consulta.gt('id', id);
    return consulta.returns<LinhaRelatorioComVisita[]>();
  }, 'listar relatórios');
  return linhas.sort((a, b) => Date.parse(b.gerado_em) - Date.parse(a.gerado_em));
}

async function baixarLinhaRelatorio(r: LinhaRelatorio): Promise<RelatorioVisita> {
  return { ...resumoRelatorio(r), pdf: await baixarObjeto(r.storage_bucket, r.storage_path) };
}

export const RelatorioSupabaseRepository = {
  salvarAtividades: (id: string, atividades: string[]) => atualizarVisita(id, { atividades_realizadas: atividades }, 'salvar as atividades'),
  async adicionar(r: RelatorioVisita, originalId?: string, verificarRelatorioAtual = false, textos?: TextoRegistroRelatorio[]) {
    const path = `${r.visitaId}/relatorios/${r.id}/${crypto.randomUUID()}.pdf`;
    await enviarObjeto(BUCKET_VISITAS, path, r.pdf, 'application/pdf');
    try {
      const p_relatorio = {
        id: r.id, visita_id: r.visitaId, nome_arquivo: r.nomeArquivo, storage_path: path, gerado_em: r.geradoEm,
        atividades: r.atividades, registro_ids: r.registroIds, fotografia_ids: r.fotografiaIds,
      };
      const banco = bancoOperacional();
      const resultado = originalId && textos
        ? await banco.rpc('delta_cortex_revisar_relatorio', { p_original: originalId, p_relatorio, p_textos: textos })
        : verificarRelatorioAtual
        ? await banco.rpc('delta_cortex_emitir_relatorio_visita', { p_original: originalId ?? null, p_relatorio })
        : originalId
        ? await banco.rpc('delta_cortex_substituir_relatorio', { p_original: originalId, p_relatorio })
        : await banco.rpc('delta_cortex_adicionar_relatorio', { p_relatorio });
      if (textos && resultado.error?.code === '40001') {
        throw new Error('O relatório ou um registro mudou durante a edição. Reabra o editor para carregar a versão atual.');
      }
      confirmarLinha(resultado, 'publicar o relatório');
    } catch (erro) {
      await removerEnvioPendente(BUCKET_VISITAS, path).catch(() => {});
      throw erro;
    }
  },
  async listarPorVisita(visitaId: string): Promise<RelatorioVisita[]> {
    return Promise.all((await listarLinhasRelatorio({ visitaId })).map(baixarLinhaRelatorio));
  },
  async listarMetadados(filtro: { visitaId: string } | { projetoId: string }) {
    return (await listarLinhasRelatorio(filtro)).map(resumoRelatorio);
  },
  async baixarPorId(id: string) {
    const linha = confirmarLinha(await bancoOperacional().from(relatorios).select('*')
      .eq('id', id).is('excluido_em', null).maybeSingle<LinhaRelatorio>(), 'consultar o relatório');
    return baixarLinhaRelatorio(linha);
  },
  async excluir(id: string) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_excluir_relatorio', { p_id: id }), 'excluir o relatório');
  },
  async visitasComRelatorio() {
    const banco = bancoOperacional();
    const linhas = await listarPaginas<{ id: string; visita_id: string }>(id => {
      let consulta = banco.from(relatorios).select('id,visita_id').is('excluido_em', null).order('id').limit(500);
      if (id) consulta = consulta.gt('id', id);
      return consulta.returns<{ id: string; visita_id: string }[]>();
    }, 'identificar visitas com relatório');
    return new Set(linhas.map(r => r.visita_id));
  },
};
