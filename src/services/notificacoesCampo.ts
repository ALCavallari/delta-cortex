import { bancoOperacional, confirmarLinha } from './supabaseOperacional';

type ProjetoNotificado = { id: string; nome: string };
export type DestinatarioCampo = { id: string; nome: string; projetos: ProjetoNotificado[] };
export type NotificacaoCampo = {
  id: string; remetente: string; destinatario: string; destinatarioId: string;
  enviada: boolean; nova: boolean; permanente: boolean; mensagem: string;
  criadaEm: string; projetos: ProjetoNotificado[];
};

export async function notificacoesCampo<T>(acao: 'listar' | 'destinos' | 'salvar' | 'excluir' | 'ler' | 'visita', dados: {
  p_id?: string; p_visita?: string; p_destinatario?: string; p_projetos?: string[];
  p_mensagem?: string; p_permanente?: boolean;
} = {}) {
  const resultado = await bancoOperacional().rpc('delta_cortex_notificacoes_campo', { p_acao: acao, ...dados });
  return confirmarLinha(resultado, 'consultar ou atualizar notificações') as T;
}
