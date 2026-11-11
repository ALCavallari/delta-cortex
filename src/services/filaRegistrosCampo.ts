import { createClient } from '@supabase/supabase-js';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { supabaseConfig } from '@/lib/supabase/config';
import type { RegistroCampo } from '@/types';
import { RegistroCampoSupabaseRepository } from './campoSupabase';
import { bancoOperacional } from './supabaseOperacional';

type Pendente = { usuarioId: string; visitaId: string; registro: RegistroCampo };
interface BancoFila extends DBSchema {
  registros: {
    key: [string, string];
    value: Pendente;
    indexes: { usuario: string; visita: [string, string] };
  };
}
type MudancaFila = {
  tipo: 'incluido' | 'enviado' | 'falhou';
  usuarioId: string;
  visitaId: string;
  registroId: string;
  registro?: RegistroCampo;
};

let bancoLocal: Promise<IDBPDatabase<BancoFila>> | undefined;
function abrirFila() {
  if (!bancoLocal) {
    bancoLocal = openDB<BancoFila>('delta-cortex-fila-campo', 1, {
      upgrade(banco) {
        const registros = banco.createObjectStore('registros', { keyPath: ['usuarioId', 'registro.id'] });
        registros.createIndex('usuario', 'usuarioId');
        registros.createIndex('visita', ['usuarioId', 'visitaId']);
      },
    }).catch(erro => {
      bancoLocal = undefined;
      throw erro;
    });
  }
  return bancoLocal;
}

const ouvintes = new Set<(mudanca: MudancaFila) => void>();
let canal: BroadcastChannel | undefined;
function canalFila() {
  if (!canal && typeof BroadcastChannel !== 'undefined') {
    try { canal = new BroadcastChannel('delta-cortex-fila-campo'); }
    catch { return undefined; }
    canal.onmessage = (evento: MessageEvent<MudancaFila>) => {
      ouvintes.forEach(ouvinte => ouvinte(evento.data));
    };
  }
  return canal;
}

function publicar(mudanca: MudancaFila) {
  const { tipo, usuarioId, visitaId, registroId } = mudanca;
  try { canalFila()?.postMessage({ tipo, usuarioId, visitaId, registroId }); }
  catch { /* A fila já foi persistida e continua acessível nesta aba. */ }
  ouvintes.forEach(ouvinte => ouvinte(mudanca));
}

export function observarFilaCampo(ouvinte: (mudanca: MudancaFila) => void) {
  canalFila();
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

export async function guardarRegistroCampo(usuarioId: string, registro: RegistroCampo) {
  try {
    await (await abrirFila()).add('registros', { usuarioId, visitaId: registro.visitaId, registro });
  } catch {
    throw new Error('O dispositivo não conseguiu guardar o registro. Mantenha o formulário aberto, verifique o espaço disponível e tente novamente.');
  }
  publicar({ tipo: 'incluido', usuarioId, visitaId: registro.visitaId, registroId: registro.id });
}

export async function registrosPendentes(usuarioId: string, visitaId: string) {
  const itens = await (await abrirFila()).getAllFromIndex('registros', 'visita', [usuarioId, visitaId]);
  return itens.map(item => item.registro);
}

export async function exigirEnvioDosRegistros(usuarioId: string | undefined, visitaId: string) {
  if (!usuarioId) throw new Error('Identifique sua conta antes de continuar.');
  const total = await (await abrirFila()).countFromIndex('registros', 'visita', [usuarioId, visitaId]);
  if (total) throw new Error('Esta visita tem registros salvos neste dispositivo. Conecte-se e aguarde a sincronização para continuar.');
}

async function conexaoDaConta(usuarioId: string) {
  const supabase = bancoOperacional();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) return null;
  const verificacao = await supabase.auth.getClaims(token);
  if (verificacao.error || verificacao.data?.claims.sub !== usuarioId) return null;
  const config = supabaseConfig();
  if (!config) return null;

  // Fixa o token no envio para que uma troca de conta durante o upload não mude a autoria.
  const banco = createClient(config.url, config.key, {
    accessToken: async () => token,
    global: {
      fetch: (input, init) => {
        const prazo = AbortSignal.timeout(60000);
        const signal = init?.signal ? AbortSignal.any([init.signal, prazo]) : prazo;
        return fetch(input, { ...init, signal });
      },
    },
  });
  return { banco, token, usuarioId };
}

const envios = new Map<string, Promise<void>>();
export function sincronizarFilaCampo(usuarioId: string) {
  const emCurso = envios.get(usuarioId);
  if (emCurso) return emCurso;
  if (!navigator.onLine) return Promise.resolve();

  const enviar = async () => {
    const local = await abrirFila();
    const chaves = await local.getAllKeysFromIndex('registros', 'usuario', usuarioId);
    for (const chave of chaves) {
      if (!navigator.onLine) break;
      const item = await local.get('registros', chave);
      if (!item) continue;
      const { registro, visitaId } = item;
      try {
        const conexao = await conexaoDaConta(usuarioId);
        if (!conexao) break;
        await RegistroCampoSupabaseRepository.salvar(registro, conexao);
        await local.delete('registros', chave);
      } catch {
        publicar({ tipo: 'falhou', usuarioId, visitaId, registroId: registro.id });
        continue;
      }
      publicar({ tipo: 'enviado', usuarioId, visitaId, registroId: registro.id, registro });
    }
  };
  const executar = async () => {
    if (navigator.locks) {
      await navigator.locks.request(`delta-campo:${usuarioId}`, { ifAvailable: true }, async lock => {
        if (lock) await enviar();
      });
    } else await enviar();
  };
  const promessa = executar().finally(() => { envios.delete(usuarioId); });
  envios.set(usuarioId, promessa);
  return promessa;
}
