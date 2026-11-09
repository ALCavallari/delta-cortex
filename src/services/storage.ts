import type { ArquivoGeografico } from '@/types/geographic';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Cliente, Profissional, Visita, RegistroCampo, Fotografia, Projeto, RelatorioVisita } from '@/types';
import { catalogarLegado, classificarLegado, preservarDependencias, protegerConjuntos, retrato } from './revisarLegado';
import { exigirAdminLegado } from '@/app/(privado)/legado-actions';

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

const stores = ['clientes', 'profissionais', 'projetos', 'visitas', 'registros_campo',
  'fotografias', 'arquivos_geograficos', 'relatorios'] as const;

type TransacaoLegada = import('idb').IDBPTransaction<DeltaCortexDB, typeof stores, 'readonly' | 'readwrite'>;

async function lerTransacao(tx: TransacaoLegada) {
  const [clientes, profissionais, projetos, visitas, registros, fotografias, geograficos, relatorios] =
    await Promise.all([
      tx.objectStore('clientes').getAll(), tx.objectStore('profissionais').getAll(),
      tx.objectStore('projetos').getAll(), tx.objectStore('visitas').getAll(),
      tx.objectStore('registros_campo').getAll(), tx.objectStore('fotografias').getAll(),
      tx.objectStore('arquivos_geograficos').getAll(), tx.objectStore('relatorios').getAll(),
    ]);
  return { clientes, profissionais, projetos, visitas, registros, fotografias, geograficos, relatorios };
}

export async function lerDadosLegados() {
  const db = await getDB();
  const tx = db.transaction(stores);
  const dados = await lerTransacao(tx);
  await tx.done;
  return dados;
}

export async function removerDemonstracoesLegadas(selecao: ReadonlyMap<string, string>) {
  await exigirAdminLegado();
  const dados = await lerDadosLegados();
  const { candidatos } = await classificarLegado(dados);
  const anterior = catalogarLegado(dados).existentes;
  const comprovados = new Map(candidatos.map(item => [item.chave, retrato(anterior.get(item.chave)!.linha)]));
  if ([...selecao.keys()].some(chave => !comprovados.has(chave))) {
    throw new Error('A seleção mudou ou contém registros que precisam ser preservados. Atualize o inventário.');
  }
  const db = await getDB();
  const tx = db.transaction(stores, 'readwrite');
  const conclusao = tx.done;
  void conclusao.catch(() => {});
  try {
    const catalogo = catalogarLegado(await lerTransacao(tx));
    const { existentes, vinculos } = catalogo;
    const inalterados = new Set([...comprovados].flatMap(([chave, original]) => {
      const atual = existentes.get(chave);
      return atual && retrato(atual.linha) === original ? [chave] : [];
    }));
    const protegidos = protegerConjuntos(inalterados, catalogo);
    const aptos = preservarDependencias(new Set(selecao.keys()), vinculos);
    if (aptos.size !== selecao.size) {
      throw new Error('A seleção deixaria vínculos sem referência. Inclua os itens dependentes aptos ou preserve os cadastros vinculados.');
    }
    for (const [chave, original] of selecao) {
      const atual = existentes.get(chave);
      if (!atual || !protegidos.has(chave) || retrato(atual.linha) !== original) {
        throw new Error('Os dados locais mudaram. Atualize o inventário e gere outro backup.');
      }
      await tx.objectStore(atual.tabela).delete(atual.id);
    }
    await conclusao;
    return selecao.size;
  } catch (erro) {
    try { tx.abort(); } catch { /* A transação pode já ter sido abortada. */ }
    throw erro;
  }
}
