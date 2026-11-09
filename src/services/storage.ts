import type { ArquivoGeografico } from '@/types/geographic';
import { SEM_TECNICOS } from './technicians';
import { limparCaracteres } from './validation';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Cliente, Profissional, Visita, RegistroCampo, Fotografia, Projeto, RelatorioVisita, SituacaoRegistro } from '@/types';

/**
 * Interface do esquema IndexedDB do Delta CorteX.
 * Camada de dados desacoplada, pronta para futura migração para PostgreSQL / Supabase.
 */
interface DeltaCortexDB extends DBSchema {
  arquivos_geograficos: {
    key: string;
    value: ArquivoGeografico;
    indexes: { 'por-projeto': string };
  };
  relatorios: { key: string; value: RelatorioVisita; indexes: { 'por-visita': string } };
  clientes: {
    key: string;
    value: Cliente;
    indexes: { 'por-nome': string; 'por-cpfCnpj': string };
  };
  profissionais: {
    key: string;
    value: Profissional;
    indexes: { 'por-nome': string };
  };
  projetos: {
    key: string;
    value: Projeto;
    indexes: { 'por-cliente': string; 'por-nome': string };
  };
  visitas: {
    key: string;
    value: Visita;
    indexes: { 'por-cliente': string; 'por-data': string };
  };
  registros_campo: {
    key: string;
    value: RegistroCampo;
    indexes: { 'por-visita': string; 'por-tipo': string };
  };
  fotografias: {
    key: string;
    value: Fotografia;
    indexes: { 'por-registro': string; 'por-visita': string };
  };
}

const DB_NAME = 'delta_cortex_local_db';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<DeltaCortexDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DeltaCortexDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB não está disponível no servidor (SSR).'));
  }

  if (!dbPromise) {
    dbPromise = openDB<DeltaCortexDB>(DB_NAME, DB_VERSION, {
      blocking() { void dbPromise?.then(db => db.close()); dbPromise = null; },
      upgrade(db) {
        if (!db.objectStoreNames.contains('arquivos_geograficos')) {
          db.createObjectStore('arquivos_geograficos', { keyPath: 'id' }).createIndex('por-projeto', 'projetoId');
        }
        if (!db.objectStoreNames.contains('relatorios')) {
          db.createObjectStore('relatorios', { keyPath: 'id' }).createIndex('por-visita', 'visitaId');
        }
        // Store de Clientes
        if (!db.objectStoreNames.contains('clientes')) {
          const clientStore = db.createObjectStore('clientes', { keyPath: 'id' });
          clientStore.createIndex('por-nome', 'nomeRazaoSocial');
          clientStore.createIndex('por-cpfCnpj', 'cpfCnpj', { unique: false });
        }

        // Store de Profissionais (temporários para a Etapa 1)
        if (!db.objectStoreNames.contains('profissionais')) {
          const profStore = db.createObjectStore('profissionais', { keyPath: 'id' });
          profStore.createIndex('por-nome', 'nome');
        }

        // Store de Projetos de Engenharia e Empreendimentos
        if (!db.objectStoreNames.contains('projetos')) {
          const projStore = db.createObjectStore('projetos', { keyPath: 'id' });
          projStore.createIndex('por-cliente', 'clienteId');
          projStore.createIndex('por-nome', 'nome');
        }

        // Store de Visitas de Acompanhamento
        if (!db.objectStoreNames.contains('visitas')) {
          const visitStore = db.createObjectStore('visitas', { keyPath: 'id' });
          visitStore.createIndex('por-cliente', 'clienteId');
          visitStore.createIndex('por-data', 'data');
        }

        // Store de Registros de Campo (Observações e Ocorrências)
        if (!db.objectStoreNames.contains('registros_campo')) {
          const regStore = db.createObjectStore('registros_campo', { keyPath: 'id' });
          regStore.createIndex('por-visita', 'visitaId');
          regStore.createIndex('por-tipo', 'tipo');
        }

        // Store de Fotografias com carimbo Canvas
        if (!db.objectStoreNames.contains('fotografias')) {
          const photoStore = db.createObjectStore('fotografias', { keyPath: 'id' });
          photoStore.createIndex('por-registro', 'registroCampoId');
          photoStore.createIndex('por-visita', 'visitaId');
        }
      },
    });
  }

  return dbPromise;
}

export async function lerDadosLegados() {
  const db = await getDB();
  const tx = db.transaction([
    'clientes', 'profissionais', 'projetos', 'visitas', 'registros_campo',
    'fotografias', 'arquivos_geograficos', 'relatorios',
  ]);
  const [clientes, profissionais, projetos, visitas, registros, fotografias, geograficos, relatorios] =
    await Promise.all([
      tx.objectStore('clientes').getAll(), tx.objectStore('profissionais').getAll(),
      tx.objectStore('projetos').getAll(), tx.objectStore('visitas').getAll(),
      tx.objectStore('registros_campo').getAll(), tx.objectStore('fotografias').getAll(),
      tx.objectStore('arquivos_geograficos').getAll(), tx.objectStore('relatorios').getAll(),
    ]);
  await tx.done;
  return { clientes, profissionais, projetos, visitas, registros, fotografias, geograficos, relatorios };
}

// ==========================================
// REPOSITÓRIO: CLIENTES
// ==========================================
export const ClienteRepository = {
  async listar(): Promise<Cliente[]> {
    const db = await getDB();
    return (await db.getAll('clientes')).filter(c => !c.deletedAt);
  },

  async obterPorId(id: string): Promise<Cliente | undefined> {
    const db = await getDB();
    return db.get('clientes', id);
  },

  async buscarPorCpfCnpj(cpfCnpj: string): Promise<Cliente | undefined> {
    const db = await getDB();
    const clientes = await db.getAll('clientes');
    const limpo = cpfCnpj.replace(/\D/g, '');
    return clientes.find((c) => c.cpfCnpj.replace(/\D/g, '') === limpo);
  },

  async salvar(cliente: Cliente): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('clientes', 'readwrite');
    const atual = await tx.store.get(cliente.id);
    if (atual?.deletedAt) throw new Error('Este cadastro foi excluído.');
    await tx.store.put(cliente);
    await tx.done;
  },

  async excluir(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('clientes', 'readwrite');
    const cliente = await tx.store.get(id);
    if (cliente && !cliente.deletedAt) {
      const agora = new Date().toISOString();
      await tx.store.put({ ...cliente, deletedAt: agora, atualizadoEm: agora });
    }
    await tx.done;
  },
};

// ==========================================
// REPOSITÓRIO: PROJETOS DE ENGENHARIA
// ==========================================
export const ProjetoRepository = {
  async listar(): Promise<Projeto[]> {
    const db = await getDB();
    const projetos = await db.getAll('projetos');
    return projetos.filter(p => !p.deletedAt).sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
  },

  async obterPorId(id: string): Promise<Projeto | undefined> {
    const db = await getDB();
    return db.get('projetos', id);
  },

  async listarPorCliente(clienteId: string): Promise<Projeto[]> {
    const db = await getDB();
    const index = db.transaction('projetos').store.index('por-cliente');
    return (await index.getAll(clienteId)).filter(p => !p.deletedAt);
  },

  async salvar(projeto: Projeto, arquivos?: {
    adicionar: Omit<ArquivoGeografico, 'projetoId'>[];
    remover: string[];
  }): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['projetos', 'clientes', 'arquivos_geograficos'], 'readwrite');
    const conclusao = tx.done;
    // A falha de uma requisição também rejeita tx.done.
    void conclusao.catch(() => {});
    try {
      const projetos = tx.objectStore('projetos');
      const atual = await projetos.get(projeto.id);
      if (atual?.deletedAt) throw new Error('Este cadastro foi excluído.');
      if (!atual || atual.clienteId !== projeto.clienteId) {
        const cliente = await tx.objectStore('clientes').get(projeto.clienteId);
        if (!cliente || cliente.deletedAt) {
          throw new Error('Selecione um cliente contratante disponível no cadastro local.');
        }
      }
      const camadas = tx.objectStore('arquivos_geograficos');
      for (const id of arquivos?.remover ?? []) {
        if ((await camadas.get(id))?.projetoId === projeto.id) await camadas.delete(id);
      }
      for (const arquivo of arquivos?.adicionar ?? []) {
        await camadas.add({ ...arquivo, projetoId: projeto.id });
      }
      await projetos.put(projeto);
      await conclusao;
    } catch (erro) {
      try { tx.abort(); } catch { /* A transação já pode estar encerrada. */ }
      throw erro;
    }
  },
  async excluir(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('projetos', 'readwrite');
    const projeto = await tx.store.get(id);
    if (projeto && !projeto.deletedAt) {
      const agora = new Date().toISOString();
      await tx.store.put({ ...projeto, deletedAt: agora, atualizadoEm: agora });
    }
    await tx.done;
  },
};

export const ArquivoGeograficoRepository = {
  async listar(projetoId: string): Promise<ArquivoGeografico[]> {
    const db = await getDB();
    return db.getAllFromIndex('arquivos_geograficos', 'por-projeto', projetoId);
  },

  async definirVisibilidade(id: string, projetoId: string, visivel: boolean) {
    const db = await getDB();
    const tx = db.transaction('arquivos_geograficos', 'readwrite');
    const arquivo = await tx.store.get(id);
    if (arquivo?.projetoId === projetoId) await tx.store.put({ ...arquivo, visivel });
    await tx.done;
  },
};

// ==========================================
// REPOSITÓRIO: PROFISSIONAIS TEMPORÁRIOS
// ==========================================
export const ProfissionalRepository = {
  async listar(): Promise<Profissional[]> {
    const db = await getDB();
    return db.getAll('profissionais');
  },

  async listarHabilitados(): Promise<Profissional[]> {
    return (await ProfissionalRepository.listar())
      .filter(p => p.habilitado === true && !p.deletedAt)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async salvar(profissional: Profissional): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('profissionais', 'readwrite');
    const todos = await tx.store.getAll();
    for (const campo of ['cpf', 'cnpj'] as const) {
      const documento = limparCaracteres(profissional[campo] ?? '');
      if (documento && todos.some(p => p.id !== profissional.id && limparCaracteres(p[campo] ?? '') === documento)) {
        throw new Error(`Já existe um técnico com este ${campo.toUpperCase()}. Confira também os cadastros excluídos.`);
      }
    }
    const existente = todos.find(p => p.id === profissional.id);
    if (existente?.deletedAt) throw new Error('Restaure o técnico antes de editar.');
    await tx.store.put({ ...existente, ...profissional });
    await tx.done;
  },

  async definirExclusao(id: string, excluir: boolean): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('profissionais', 'readwrite');
    const atual = await tx.store.get(id);
    if (!atual) throw new Error('Técnico não encontrado.');
    const agora = new Date().toISOString();
    await tx.store.put({ ...atual, deletedAt: excluir ? agora : null, atualizadoEm: agora });
    await tx.done;
  },
};

// ==========================================
// REPOSITÓRIO: VISITAS DE ACOMPANHAMENTO
// ==========================================
export const VisitaRepository = {
  async listar(incluirExcluidas: boolean = false): Promise<Visita[]> {
    const db = await getDB();
    const visitas = await db.getAll('visitas');
    const filtradas = incluirExcluidas
      ? visitas
      : visitas.filter((v) => !v.deletedAt);
    return filtradas.sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
  },

  async listarExcluidas(): Promise<Visita[]> {
    const db = await getDB();
    const visitas = await db.getAll('visitas');
    return visitas
      .filter((v) => !!v.deletedAt)
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.atualizadoEm).getTime() -
          new Date(a.deletedAt || a.atualizadoEm).getTime()
      );
  },

  async obterPorId(id: string): Promise<Visita | undefined> {
    const db = await getDB();
    return db.get('visitas', id);
  },

  async criar(dados: Omit<Visita, 'executorNome' | 'responsavelTecnicoNome'>): Promise<Visita> {
    const db = await getDB();
    const tx = db.transaction(['visitas', 'profissionais', 'projetos', 'clientes'], 'readwrite');
    const cadastro = tx.objectStore('profissionais');
    const [executor, responsavel] = await Promise.all([
      cadastro.get(dados.executorId), cadastro.get(dados.responsavelTecnicoId),
    ]);
    if (executor?.habilitado !== true || executor.deletedAt || responsavel?.habilitado !== true || responsavel.deletedAt) {
      const habilitados = (await cadastro.getAll()).some(p => p.habilitado === true && !p.deletedAt);
      throw new Error(habilitados ? 'O executor ou responsável técnico não está mais habilitado. Reabra o formulário e selecione novamente.' : SEM_TECNICOS);
    }
    const projeto = dados.projetoId && await tx.objectStore('projetos').get(dados.projetoId);
    if (!projeto || projeto.deletedAt) throw new Error('Selecione um projeto disponível no cadastro local.');
    const cliente = await tx.objectStore('clientes').get(projeto.clienteId);
    if (!cliente || cliente.deletedAt || cliente.id !== dados.clienteId) {
      throw new Error('O contratante do projeto mudou ou está indisponível localmente. Revise o vínculo em Projetos.');
    }
    const visita = {
      ...dados,
      identificacaoProjeto: projeto.nome,
      clienteNome: cliente.nomeRazaoSocial,
      executorNome: executor.nome,
      responsavelTecnicoNome: responsavel.nome,
    };
    await tx.objectStore('visitas').add(visita);
    await tx.done;
    return visita;
  },

  async excluirLogico(id: string): Promise<void> {
    const db = await getDB();
    const visita = await db.get('visitas', id);
    if (visita) {
      visita.deletedAt = new Date().toISOString();
      visita.atualizadoEm = new Date().toISOString();
      await db.put('visitas', visita);
    }
  },

  async restaurar(id: string): Promise<void> {
    const db = await getDB();
    const visita = await db.get('visitas', id);
    if (visita) {
      visita.deletedAt = null;
      visita.atualizadoEm = new Date().toISOString();
      await db.put('visitas', visita);
    }
  },

  async contarPorProjeto(projetoId: string): Promise<number> {
    const db = await getDB();
    const visitas = await db.getAll('visitas');
    return visitas.filter((v) => v.projetoId === projetoId && !v.deletedAt).length;
  },

  async listarPorProjeto(projetoId: string): Promise<Visita[]> {
    const db = await getDB();
    const visitas = await db.getAll('visitas');
    return visitas.filter((v) => v.projetoId === projetoId && !v.deletedAt);
  },

  async vincularProjeto(
    visitaId: string,
    projetoId: string
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['visitas', 'projetos', 'clientes'], 'readwrite');
    const visitas = tx.objectStore('visitas');
    const visita = await visitas.get(visitaId);
    if (!visita || visita.deletedAt || visita.projetoId) {
      throw new Error('A visita não está mais disponível para vinculação.');
    }
    const projeto = await tx.objectStore('projetos').get(projetoId);
    if (!projeto || projeto.deletedAt) throw new Error('Selecione um projeto disponível no cadastro local.');
    const cliente = await tx.objectStore('clientes').get(projeto.clienteId);
    if (!cliente || cliente.deletedAt) {
      throw new Error('O contratante deste projeto está indisponível no cadastro local. Revise o vínculo em Projetos.');
    }
    await visitas.put({
      ...visita,
      projetoId,
      identificacaoProjeto: projeto.nome,
      clienteId: cliente.id,
      clienteNome: cliente.nomeRazaoSocial,
      atualizadoEm: new Date().toISOString(),
    });
    await tx.done;
  },

  async atualizarStatus(id: string, status: Visita['status']): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('visitas', 'readwrite');
    const visita = await tx.store.get(id);
    if (!visita) throw new Error('Visita não encontrada no armazenamento local.');
    const agora = new Date().toISOString();
    await tx.store.put({
      ...visita,
      status,
      atualizadoEm: agora,
      finalizadaEm: status === 'concluida' ? visita.finalizadaEm ?? agora : undefined,
    });
    await tx.done;
  },
};

// ==========================================
// REPOSITÓRIO: REGISTROS DE CAMPO
// ==========================================
async function listarRegistrosComOrigem(
  incluir: (registro: RegistroCampo, origem?: Visita) => boolean,
  incluirFotos: boolean,
): Promise<RegistroCampo[]> {
  const db = await getDB();
  const tx = db.transaction(['visitas', 'registros_campo', 'fotografias']);
  const [visitas, registros] = await Promise.all([
    tx.objectStore('visitas').getAll(),
    tx.objectStore('registros_campo').getAll(),
  ]);
  const origens = new Map(visitas.map(v => [v.id, v]));
  const fotos = tx.objectStore('fotografias').index('por-registro');
  return Promise.all(registros.filter(r => incluir(r, origens.get(r.visitaId))).map(async r => {
    const origem = origens.get(r.visitaId);
    return {
      ...r,
      visitaOrigemIdentificacao: r.visitaOrigemIdentificacao ?? origem?.identificacao,
      tecnicoNome: r.tecnicoNome ?? origem?.executorNome,
      tecnicoId: r.tecnicoId ?? origem?.executorId,
      fotos: incluirFotos ? await fotos.getAll(r.id) : undefined,
    };
  }));
}

export const RegistroCampoRepository = {
  async listarNoContexto(visita: Visita): Promise<RegistroCampo[]> {
    return listarRegistrosComOrigem((r, origem) => r.visitaId === visita.id ||
      (r.tipo === 'Ocorrencia' && !!visita.projetoId && (r.projetoId ?? origem?.projetoId) === visita.projetoId), true);
  },

  async listarOcorrenciasDoProjeto(projetoId: string): Promise<RegistroCampo[]> {
    if (!projetoId) return [];
    return listarRegistrosComOrigem((r, origem) => r.tipo === 'Ocorrencia' && !r.deletedAt &&
      (r.projetoId ?? origem?.projetoId) === projetoId, false);
  },

  async mudarSituacao(id: string, situacao: SituacaoRegistro, visita: Visita): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('registros_campo', 'readwrite');
    const r = await tx.store.get(id);
    if (!r || r.deletedAt || r.tipo !== 'Ocorrencia') throw new Error('Ocorrência indisponível para acompanhamento.');
    if ((r.situacao ?? 'em_aberto') !== situacao) {
      await tx.store.put({ ...r, situacao, eventos: [...(r.eventos ?? []), {
        situacao, data: new Date().toISOString(), visitaId: visita.id,
        profissionalId: visita.executorId, profissionalNome: visita.executorNome,
      }] });
    }
    await tx.done;
  },

  async listarPorVisita(visitaId: string, incluirExcluidos: boolean = false): Promise<RegistroCampo[]> {
    const db = await getDB();
    const index = db.transaction('registros_campo').store.index('por-visita');
    const registros = await index.getAll(visitaId);

    // Carrega também as fotos associadas
    const fotoIndex = db.transaction('fotografias').store.index('por-visita');
    const fotos = await fotoIndex.getAll(visitaId);

    const filtrados = incluirExcluidos
      ? registros
      : registros.filter((r) => !r.deletedAt);

    return filtrados.map((r) => ({
      ...r,
      fotos: fotos.filter((f) => f.registroCampoId === r.id),
    }));
  },

  async listarExcluidosPorVisita(visitaId: string): Promise<RegistroCampo[]> {
    const db = await getDB();
    const index = db.transaction('registros_campo').store.index('por-visita');
    const registros = await index.getAll(visitaId);

    const fotoIndex = db.transaction('fotografias').store.index('por-visita');
    const fotos = await fotoIndex.getAll(visitaId);

    return registros
      .filter((r) => !!r.deletedAt)
      .map((r) => ({
        ...r,
        fotos: fotos.filter((f) => f.registroCampoId === r.id),
      }));
  },

  async excluirLogico(id: string): Promise<void> {
    const db = await getDB();
    const reg = await db.get('registros_campo', id);
    if (reg) {
      reg.deletedAt = new Date().toISOString();
      await db.put('registros_campo', reg);
    }
  },

  async restaurar(id: string): Promise<void> {
    const db = await getDB();
    const reg = await db.get('registros_campo', id);
    if (reg) {
      reg.deletedAt = null;
      await db.put('registros_campo', reg);
    }
  },

  async salvar(registro: RegistroCampo): Promise<void> {
    const db = await getDB();
    const { fotos, ...dadosRegistro } = registro;
    await db.put('registros_campo', dadosRegistro as RegistroCampo);

    if (fotos && fotos.length > 0) {
      const tx = db.transaction('fotografias', 'readwrite');
      for (const foto of fotos) {
        await tx.store.put(foto);
      }
      await tx.done;
    }
  },

  async obterPorId(id: string): Promise<RegistroCampo | undefined> {
    const db = await getDB();
    const reg = await db.get('registros_campo', id);
    if (!reg) return undefined;

    const fotoIndex = db.transaction('fotografias').store.index('por-registro');
    const fotos = await fotoIndex.getAll(id);
    return {
      ...reg,
      fotos,
    };
  },
};

// ==========================================
// REPOSITÓRIO: FOTOGRAFIAS
// ==========================================
export const FotografiaRepository = {
  async salvar(foto: Fotografia): Promise<void> {
    const db = await getDB();
    await db.put('fotografias', foto);
  },

  async listarPorRegistro(registroCampoId: string): Promise<Fotografia[]> {
    const db = await getDB();
    const index = db.transaction('fotografias').store.index('por-registro');
    return index.getAll(registroCampoId);
  },
};

export const RelatorioRepository = {
  async salvarAtividades(visitaId: string, atividades: string[]) {
    const db = await getDB();
    const tx = db.transaction('visitas', 'readwrite');
    const visita = await tx.store.get(visitaId);
    if (!visita) throw new Error('Visita não encontrada.');
    await tx.store.put({ ...visita, atividadesRealizadas: atividades });
    await tx.done;
  },
  async adicionar(relatorio: RelatorioVisita) {
    const db = await getDB();
    await db.add('relatorios', relatorio);
  },
  async listarPorVisita(visitaId: string) {
    const db = await getDB();
    return (await db.getAllFromIndex('relatorios', 'por-visita', visitaId))
      .sort((a,b) => b.geradoEm.localeCompare(a.geradoEm));
  },
  async visitasComRelatorio() {
    const db = await getDB();
    const visitas = new Set<string>();
    const index = db.transaction('relatorios').store.index('por-visita');
    for (let cursor = await index.openKeyCursor(null, 'nextunique'); cursor; cursor = await cursor.continue()) {
      visitas.add(cursor.key);
    }
    return visitas;
  },
};
