'use client';

import { useEffect, useState } from 'react';
import { Eye, FileDown, Pencil, Trash2 } from 'lucide-react';
import { RelatorioRepository } from '@/services/repositoriosOperacionais';
import { baixarRelatorio } from '@/services/reportDownload';
import type { RelatorioListado } from '@/services/campoSupabase';
import type { Visita } from '@/types';
import { ReportActivitiesModal } from './ReportActivitiesModal';

const botao = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50';

export function RelatoriosEmitidos({ projetoId, visita, fechar, onAlterado }: {
  projetoId?: string; visita?: Visita; fechar?: () => void; onAlterado?: () => void;
}) {
  const [lista, setLista] = useState<RelatorioListado[]>();
  const [erroCarga, setErroCarga] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [editar, setEditar] = useState<RelatorioListado>();
  const [excluir, setExcluir] = useState<RelatorioListado>();
  const visitaId = visita?.id;

  useEffect(() => {
    if (!visitaId && !projetoId) return;
    let ativo = true;
    void RelatorioRepository.listarMetadados(visitaId ? { visitaId } : { projetoId: projetoId! })
      .then(resultados => { if (ativo) setLista(resultados); })
      .catch(e => { if (ativo) setErroCarga(e instanceof Error ? e.message : 'Não foi possível consultar os relatórios.'); });
    return () => { ativo = false; };
  }, [projetoId, visitaId]);

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErroAcao('');
    try { await acao(); }
    catch (e) { setErroAcao(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); }
    finally { setOcupado(false); }
  }

  if (visita && editar) return <ReportActivitiesModal visita={visita} original={editar}
    onClose={() => setEditar(undefined)} onDone={() => { onAlterado?.(); fechar?.(); }} />;

  const conteudo = <>
    {erroCarga ? <p role="alert" className="p-3 text-sm text-red-700">{erroCarga}</p>
      : !lista ? <p role="status" className="p-3 text-sm text-slate-600">Carregando relatórios…</p>
      : !lista.length ? <p className="p-3 text-sm text-slate-600">Nenhum relatório emitido {visita ? 'para esta visita' : 'para este projeto'}.</p>
      : <ul className="divide-y divide-slate-100">
        {lista.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="break-all text-sm font-semibold text-[#333436]">{r.nomeArquivo}</p>
            <p className="text-xs text-slate-600">
              {r.identificacaoVisita && `${r.identificacaoVisita} · `}{new Date(r.geradoEm).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {projetoId && !visita && <a className={botao}
              href={`/acompanhamento/relatorios/${encodeURIComponent(r.id)}`}
              target="_blank" rel="noopener noreferrer"
              aria-label={`Visualizar ${r.nomeArquivo} em nova aba`}>
              <Eye size={15} aria-hidden /> Visualizar
            </a>}
            <button className={botao} type="button" disabled={ocupado || !!excluir} onClick={() => void executar(async () => {
              baixarRelatorio(await RelatorioRepository.baixarPorId(r.id));
            })}><FileDown size={15} aria-hidden /> Baixar PDF</button>
            {visita && <>
              <button className={botao} type="button" disabled={ocupado || !!excluir} onClick={() => setEditar(r)}>
                <Pencil size={15} aria-hidden /> Editar
              </button>
              <button className={`${botao} text-red-700`} type="button" disabled={ocupado || !!excluir} onClick={() => setExcluir(r)}>
                <Trash2 size={15} aria-hidden /> Excluir
              </button>
            </>}
          </div>
        </li>)}
      </ul>}
    {excluir && <div className="m-3 space-y-2 rounded-xl bg-red-50 p-3 text-sm">
      <p>Excluir <strong className="break-all">{excluir.nomeArquivo}</strong> da lista de relatórios emitidos?</p>
      <div className="flex gap-2">
        <button type="button" className={botao} disabled={ocupado} onClick={() => { setExcluir(undefined); setErroAcao(''); }}>Cancelar</button>
        <button type="button" className={`${botao} text-red-700`} disabled={ocupado} onClick={() => void executar(async () => {
          await RelatorioRepository.excluir(excluir.id);
          setLista(atual => atual?.filter(r => r.id !== excluir.id));
          setExcluir(undefined);
          onAlterado?.();
        })}>Confirmar exclusão</button>
      </div>
    </div>}
    {erroAcao && <p role="alert" className="p-3 text-sm text-red-700">{erroAcao}</p>}
  </>;

  if (!visita) return <section aria-label="Relatórios emitidos" className="rounded-2xl border border-slate-200 bg-white">
    <h3 className="border-b border-slate-100 p-3 text-sm font-bold">Relatórios emitidos</h3>
    {conteudo}
  </section>;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="titulo-gerenciar-relatorios"
      className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
      <h2 id="titulo-gerenciar-relatorios" className="border-b p-4 font-bold">Gerenciar Relatórios</h2>
      {conteudo}
      <div className="flex justify-end border-t p-3">
        <button className={botao} type="button" disabled={ocupado} onClick={fechar}>Fechar</button>
      </div>
    </section>
  </div>;
}
