import type { ConfiguracaoNFSe, ContextoNFSe, PercentualMensalNFSe } from '@/types/nfse';
import type { Contrato, Fatura } from '@/types/financeiro';
import { acessoOperacional, bancoOperacional, confirmarLinha, conferirOperacao, listarPaginas } from './supabaseOperacional';

export const NFSeRepository = {
  async carregar(): Promise<ContextoNFSe> {
    await acessoOperacional();
    const banco = bancoOperacional();
    const [configuracao, percentuais] = await Promise.all([
      banco.from('financeiro_configuracao_nfse').select('*').eq('id', true).maybeSingle<ConfiguracaoNFSe>(),
      listarPaginas<PercentualMensalNFSe>(id => {
        let q = banco.from('financeiro_percentuais_nfse').select('*').order('id').limit(500);
        if (id) q = q.gt('id', id);
        return q.returns<PercentualMensalNFSe[]>();
      }, 'carregar os percentuais mensais (confira a migração de NFS-e)'),
    ]);
    conferirOperacao(configuracao.error, 'carregar a configuração fiscal (confira a migração de NFS-e)');
    return { configuracao: configuracao.data, percentuais };
  },
  async salvarConfiguracao(dados: Omit<ConfiguracaoNFSe, 'atualizado_em'>, versao: string | null) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_configurar_nfse', {
      p_dados: dados, p_atualizado_em: versao,
    }), 'salvar a configuração fiscal');
  },
  async salvarPercentual(mes: string, centesimos: number, versao: string | null) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_percentual_nfse', {
      p_mes: `${mes}-01`, p_percentual: centesimos, p_atualizado_em: versao,
    }), 'salvar o percentual mensal');
  },
  async salvarFatura(contrato: Contrato, fatura: Fatura, dados: { competencia: string; periodo: string; descricao: string }) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_preparar_fatura_nfse', {
      p_fatura: fatura.id, p_competencia: dados.competencia, p_periodo: dados.periodo,
      p_descricao: dados.descricao, p_atualizado_em: contrato.atualizado_em,
    }), 'salvar os dados fiscais da fatura');
  },
};
