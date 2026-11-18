import type { Contrato, ContratoSalvar, Fatura } from '@/types/financeiro';
import { acessoOperacional, bancoOperacional, confirmarLinha, listarPaginas } from './supabaseOperacional';

export const FinanceiroRepository = {
  async listar(): Promise<Contrato[]> {
    await acessoOperacional();
    const banco = bancoOperacional();
    const [contratos, faturas] = await Promise.all([
      listarPaginas<Omit<Contrato, 'faturas'>>(id => {
        let q = banco.from('financeiro_contratos').select('*,clientes(nome_razao_social),projetos(nome)').order('id').limit(500);
        if (id) q = q.gt('id', id);
        return q.returns<Omit<Contrato, 'faturas'>[]>();
      }, 'listar contratos (confira se a migração do Financeiro foi aplicada)'),
      listarPaginas<Fatura>(id => {
        let q = banco.from('financeiro_faturas').select('*').is('cancelada_em', null).order('id').limit(500);
        if (id) q = q.gt('id', id);
        return q.returns<Fatura[]>();
      }, 'listar faturamentos'),
    ]);
    const porContrato = new Map<string, Fatura[]>();
    for (const fatura of faturas) {
      const grupo = porContrato.get(fatura.contrato_id) ?? [];
      grupo.push(fatura);
      porContrato.set(fatura.contrato_id, grupo);
    }
    return contratos.map(c => ({ ...c, faturas: (porContrato.get(c.id) ?? []).sort((a, b) => a.numero - b.numero) }))
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  },
  async salvar(contrato: ContratoSalvar, faturas: Fatura[], atualizadoEm: string | null) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_salvar_contrato', {
      p_contrato: contrato, p_faturas: faturas, p_atualizado_em: atualizadoEm,
    }), 'salvar o contrato');
  },
  async registrarEmissao(contrato: Contrato, fatura: Fatura, emitida: boolean, data: string) {
    confirmarLinha(await bancoOperacional().rpc('delta_cortex_emissao_fatura', {
      p_fatura: fatura.id, p_emitida: emitida, p_data: data, p_atualizado_em: contrato.atualizado_em,
    }), 'registrar a situação da fatura');
  },
};
