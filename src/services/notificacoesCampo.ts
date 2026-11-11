import { bancoOperacional, confirmarLinha } from './supabaseOperacional';
import { baixarObjeto, enviarObjeto, removerEnvioPendente } from './arquivosSupabase';

type ProjetoNotificado = { id: string; nome: string };
export type AnexoNotificacao = { path: string; nome: string };
type ResultadoNotificacao = { anexoAnterior?: string | null };
export type DestinatarioCampo = { id: string; nome: string; papel?: 'admin' | 'tecnico'; projetos: ProjetoNotificado[] };
export type NotificacaoCampo = {
  id: string; remetente: string; destinatario: string; destinatarioId: string;
  enviada: boolean; nova: boolean; permanente: boolean; mensagem: string;
  visaoAdministrativa?: boolean; podeGerenciar?: boolean;
  criadaEm: string; projetos: ProjetoNotificado[];
  anexo?: AnexoNotificacao | null;
};

export async function notificacoesCampo<T>(acao: 'listar' | 'destinos' | 'salvar' | 'excluir' | 'ler' | 'visita', dados: {
  p_id?: string; p_visita?: string; p_destinatario?: string; p_projetos?: string[];
  p_mensagem?: string; p_permanente?: boolean;
  p_anexo?: AnexoNotificacao | Record<string, never>;
} = {}) {
  const resultado = await bancoOperacional().rpc('delta_cortex_notificacoes_campo', { p_acao: acao, ...dados });
  return confirmarLinha(resultado, 'consultar ou atualizar notificações') as T;
}

const bucketAnexos = 'delta-cortex-notificacoes';
const tiposAnexo: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};
export const extensoesAnexoNotificacao = Object.keys(tiposAnexo).map(tipo => `.${tipo}`).join(',');

function limparAnexo(usuarioId: string | undefined, path?: string | null) {
  if (usuarioId && path?.startsWith(`${usuarioId}/`)) {
    void removerEnvioPendente(bucketAnexos, path).catch(() => {});
  }
}

export async function salvarNotificacaoCampo(usuarioId: string | undefined, dados: {
  p_id?: string; p_destinatario: string; p_projetos: string[]; p_mensagem: string; p_permanente: boolean;
}, arquivo: File | undefined, removerAnexo: boolean) {
  if (!usuarioId) throw new Error('Entre novamente para salvar a notificação.');
  let anexo: AnexoNotificacao | undefined;
  try {
    if (arquivo) {
      const nome = arquivo.name.trim();
      const extensao = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
      const tipo = Object.hasOwn(tiposAnexo, extensao) ? tiposAnexo[extensao] : undefined;
      if (!tipo || nome.length > 180 || !arquivo.size || arquivo.size > 6 * 1024 * 1024) {
        throw new Error('Selecione um documento compatível, com nome de até 180 caracteres e tamanho de até 6 MB.');
      }
      anexo = { path: `${usuarioId}/${crypto.randomUUID()}`, nome };
      await enviarObjeto(bucketAnexos, anexo.path, arquivo, tipo);
    }
    const resultado = await notificacoesCampo<ResultadoNotificacao>('salvar', {
      ...dados, p_anexo: anexo ?? (removerAnexo ? {} : undefined),
    });
    limparAnexo(usuarioId, resultado.anexoAnterior);
  } catch (erro) {
    limparAnexo(usuarioId, anexo?.path);
    throw erro;
  }
}

export async function excluirNotificacaoCampo(usuarioId: string | undefined, id: string) {
  const resultado = await notificacoesCampo<ResultadoNotificacao>('excluir', { p_id: id });
  limparAnexo(usuarioId, resultado.anexoAnterior);
}

export async function baixarAnexoNotificacao(anexo: AnexoNotificacao) {
  const arquivo = await baixarObjeto(bucketAnexos, anexo.path);
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = anexo.nome;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
