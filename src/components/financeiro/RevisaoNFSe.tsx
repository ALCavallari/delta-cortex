'use client';

import { useEffect, useState } from 'react';
import type { ContextoNFSe } from '@/types/nfse';
import type { Cliente } from '@/types';
import type { Contrato, Fatura } from '@/types/financeiro';
import { NFSeRepository } from '@/services/nfseSupabase';
import { FinanceiroRepository } from '@/services/financeiroSupabase';
import { ClienteRepository } from '@/services/repositoriosOperacionais';
import { formatarPercentual, revisarFaturaNFSe } from '@/services/nfse';
import { dataBr, moeda } from '@/services/faturamento';
import { botaoFinanceiro, botaoSecundarioFinanceiro, FinanceiroDialog } from './FinanceiroDialog';

type Revisao = { contexto: ContextoNFSe; clientes: Cliente[]; linhas: { contrato: Contrato; fatura: Fatura }[] };
export function RevisaoNFSe({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [dados, setDados] = useState<Revisao | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    void Promise.all([NFSeRepository.carregar(), FinanceiroRepository.listar(), ClienteRepository.listar()])
      .then(([contexto, contratos, clientes]) => {
        const selecionados = new Set(ids);
        const linhas = contratos.flatMap(contrato => contrato.faturas.filter(f => selecionados.has(f.id)).map(fatura => ({ contrato, fatura })));
        if (linhas.length !== selecionados.size) throw new Error('Uma das faturas selecionadas está indisponível. Atualize a listagem e revise a seleção.');
        if (ativo) setDados({ contexto, clientes, linhas });
      }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível revisar as faturas.'); });
    return () => { ativo = false; };
  }, [ids]);
  return <FinanceiroDialog titulo="Revisar preparação das NFS-e" onClose={onClose}>
    <div className="space-y-4 p-5">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Prévia de conferência. Nenhuma nota será transmitida ou emitida. A assinatura, o certificado e a integração fiscal ainda não estão habilitados.</p>
      {erro && <p role="alert" className="text-sm text-red-700">{erro} Verifique também se a migração de preparação de NFS-e foi aplicada.</p>}
      {!dados && !erro && <p role="status" className="text-sm text-slate-500">Consultando os dados atuais das faturas, clientes e parâmetros fiscais…</p>}
      {dados && <>
        <div className="text-sm"><p><strong>Emitente:</strong> {dados.contexto.configuracao?.razao_social ?? 'Não configurado'}</p><p><strong>Serviço padrão:</strong> {dados.contexto.configuracao?.descricao_servico ?? 'Não configurado'} · {dados.contexto.configuracao?.codigo_tributacao_nacional ?? '—'}</p></div>
        {dados.linhas.map(({ contrato, fatura }) => {
          const cliente = dados.clientes.find(c => c.id === contrato.cliente_id);
          const { percentual, pendencias } = revisarFaturaNFSe(contrato, fatura, cliente, dados.contexto);
          return <article key={fatura.id} className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{contrato.titulo} · Parcela {fatura.numero}</h3><strong>{moeda(fatura.valor_centavos)}</strong></div>
            <dl className="space-y-1"><div><dt className="inline font-semibold">Tomador: </dt><dd className="inline">{cliente?.nomeRazaoSocial ?? 'Indisponível'} · {cliente?.cpfCnpj ?? 'Documento indisponível'}</dd></div>
              <div><dt className="inline font-semibold">Projeto: </dt><dd className="inline">{contrato.projetos?.nome ?? 'Indisponível'}</dd></div>
              <div><dt className="inline font-semibold">Competência fiscal: </dt><dd className="inline">{fatura.competencia_nfse ? dataBr(fatura.competencia_nfse) : 'Não definida'}</dd></div>
              <div><dt className="inline font-semibold">Período dos serviços: </dt><dd className="inline">{fatura.periodo_servicos ?? 'Não informado'}</dd></div>
              <div><dt className="inline font-semibold">Percentual aproximado do Simples: </dt><dd className="inline">{percentual ? formatarPercentual(percentual.percentual_centesimos) : 'Não cadastrado para a competência'}</dd></div>
            </dl>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3">{fatura.descricao_nfse ?? 'Descrição individual não salva. Utilize “Dados da NFS-e” na fatura para prepará-la.'}</p>
            {pendencias.length ? <div className="rounded-lg bg-amber-50 p-3 text-amber-900"><p className="font-semibold">Pendências de preenchimento</p><ul className="mt-1 list-inside list-disc">{pendencias.map(p => <li key={p}>{p}</li>)}</ul></div>
              : <p className="text-emerald-700">Dados básicos preenchidos para conferência. A validação fiscal e a autorização pela API ainda estão pendentes.</p>}
          </article>;
        })}
        <p className="text-xs text-slate-500">O percentual aproximado não desconta o valor da fatura e não substitui a alíquota de ISS. ISS, retenções, local de prestação e demais regras fiscais serão validados na etapa de integração. Esta prévia não é um documento fiscal.</p>
      </>}
      <footer className="flex flex-wrap justify-end gap-3"><button type="button" className={botaoSecundarioFinanceiro} onClick={onClose}>Fechar revisão</button><button type="button" disabled className={botaoFinanceiro} title="Transmissão indisponível até configurar certificado e validar a integração">Emitir NFse</button></footer>
    </div>
  </FinanceiroDialog>;
}
