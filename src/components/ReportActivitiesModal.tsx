'use client';

import { useState } from 'react';
import { Visita } from '@/types';
import { RegistroCampoRepository, RelatorioRepository, VisitaRepository } from '@/services/repositoriosOperacionais';
import { registrosDoRelatorio } from '@/services/fieldHistory';
import { ATIVIDADES } from '@/services/rasActivities';
import { baixarRelatorio } from '@/services/reportDownload';
import type { RelatorioListado } from '@/services/campoSupabase';

export function ReportActivitiesModal({ visita, original, atualizarRegistros = false, onClose, onDone }: {
  visita: Visita; original?: RelatorioListado; atualizarRegistros?: boolean; onClose: () => void; onDone: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState(original?.atividades ?? visita.atividadesRealizadas ?? []);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  async function gerar() {
    if (ocupado || salvo || !selecionadas.length) return;
    setOcupado(true);
    setErro('');
    try {
      const atividades = ATIVIDADES.filter(a => selecionadas.includes(a));
      const atual = await VisitaRepository.obterPorId(visita.id);
      if (!atual || (atual.status !== 'em_andamento' && atual.status !== 'concluida')) {
        throw new Error('A visita está indisponível para emitir o relatório.');
      }
      const [registros, { gerarRelatorio }] = await Promise.all([
        RegistroCampoRepository.listarNoContexto(atual),
        import('@/services/rasPdf'),
      ]);
      let incluidos = registrosDoRelatorio(registros, atual);
      if (original && !atualizarRegistros) {
        const porId = new Map(registros.map(r => [r.id, r]));
        const fotosOriginais = new Set(original.fotografiaIds);
        incluidos = original.registroIds.map(id => {
          const registro = porId.get(id);
          if (!registro) throw new Error('Um registro do relatório original está indisponível. O PDF anterior foi preservado.');
          return { ...registro, fotos: registro.fotos?.filter(foto => fotosOriginais.has(foto.id)) };
        });
        const fotosDisponiveis = new Set(incluidos.flatMap(registro => registro.fotos?.map(foto => foto.id) ?? []));
        if (original.fotografiaIds.some(id => !fotosDisponiveis.has(id))) {
          throw new Error('Uma fotografia do relatório original está indisponível. O PDF anterior foi preservado.');
        }
      }
      const relatorio = await gerarRelatorio(atual, atividades, incluidos);
      if (!relatorio.pdf.size) throw new Error('O PDF gerado está vazio.');
      await RelatorioRepository.adicionar(relatorio, original?.id, atualizarRegistros);
      setSalvo(true);
      baixarRelatorio(relatorio);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível emitir o relatório. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="ras-atividades" className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-2xl">
      <h2 id="ras-atividades" className="text-lg font-bold text-[#333436]">{original ? 'Editar Relatório' : 'Atividades Realizadas'}</h2>
      {salvo ? <p className="my-4 text-sm">Relatório salvo. Você também pode baixá-lo na lista de trabalhos.</p> : <>
        <p className="mb-3 text-sm text-slate-600">{original
          ? 'Corrija as atividades para gerar uma nova versão do relatório. O PDF anterior será arquivado.'
          : 'Selecione as atividades executadas durante esta visita.'}</p>
        <fieldset disabled={ocupado} className="min-h-0 overflow-y-auto space-y-1">
          <legend className="sr-only">Atividades executadas</legend>
          {ATIVIDADES.map(a => <label key={a} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selecionadas.includes(a)} className="h-4 w-4 shrink-0 accent-[#00AFF0]"
              onChange={e => setSelecionadas(e.target.checked ? [...selecionadas, a] : selecionadas.filter(v => v !== a))} />
            {a}
          </label>)}
        </fieldset>
      </>}
      {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {salvo ? <button type="button" onClick={onDone} className="rounded-xl bg-[#00AFF0] px-4 py-2 font-semibold text-white">Concluir</button> : <>
          <button type="button" disabled={ocupado} onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">Cancelar</button>
          <button type="button" disabled={ocupado || !selecionadas.length} onClick={gerar} className="rounded-xl bg-[#00AFF0] px-4 py-2 font-semibold text-white disabled:opacity-50">
            {ocupado ? 'Gerando relatório…' : original ? 'Salvar Revisão' : 'Gerar Relatório'}
          </button>
        </>}
      </div>
    </section>
  </div>;
}
