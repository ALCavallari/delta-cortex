'use client';

import { useEffect, useState } from 'react';
import type { RegistroCampo, Visita } from '@/types';
import { RegistroCampoRepository, RelatorioRepository, VisitaRepository } from '@/services/repositoriosOperacionais';
import { registrosDoRelatorio } from '@/services/fieldHistory';
import { ATIVIDADES } from '@/services/rasActivities';
import { baixarRelatorio } from '@/services/reportDownload';
import type { RelatorioListado, TextoRegistroRelatorio } from '@/services/campoSupabase';

export function ReportActivitiesModal({ visita, original, atualizarRegistros = false, onClose, onDone }: {
  visita: Visita; original?: RelatorioListado; atualizarRegistros?: boolean; onClose: () => void; onDone: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState(original?.atividades ?? visita.atividadesRealizadas ?? []);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [registrosOriginais, setRegistrosOriginais] = useState<RegistroCampo[]>();
  const [descricoes, setDescricoes] = useState<Record<string, string>>({});
  const revisarTextos = original && !atualizarRegistros;

  useEffect(() => {
    if (!original || atualizarRegistros) return;
    const ids = original.registroIds;
    let cancelado = false;
    async function carregar() {
      try {
        const registros = await RegistroCampoRepository.listarNoContexto(visita, false);
        if (cancelado) return;
        const porId = new Map(registros.map(registro => [registro.id, registro]));
        const vinculados = ids.map(id => {
          const registro = porId.get(id);
          if (!registro) throw new Error('Um registro vinculado ao relatório está indisponível.');
          return registro;
        });
        setRegistrosOriginais(vinculados);
      } catch (error) {
        if (!cancelado) setErro(error instanceof Error ? error.message : 'Não foi possível carregar os registros do relatório.');
      }
    }
    void carregar();
    return () => { cancelado = true; };
  }, [original, atualizarRegistros, visita]);

  const descricaoVazia = registrosOriginais?.some(registro => descricoes[registro.id]?.trim() === '');
  const podeSalvar = !ocupado && !salvo && selecionadas.length > 0 &&
    (!revisarTextos || (registrosOriginais !== undefined && !descricaoVazia));

  async function gerar() {
    if (!podeSalvar) return;
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
      let textos: TextoRegistroRelatorio[] | undefined;
      if (original && revisarTextos && registrosOriginais) {
        const revisoes: TextoRegistroRelatorio[] = [];
        const porId = new Map(registros.map(r => [r.id, r]));
        const fotosOriginais = new Set(original.fotografiaIds);
        incluidos = registrosOriginais.map(inicial => {
          const registro = porId.get(inicial.id);
          if (!registro) throw new Error('Um registro do relatório original está indisponível. O PDF anterior foi preservado.');
          const rascunho = descricoes[inicial.id]?.trim();
          const alterado = rascunho !== undefined && rascunho !== inicial.descricao.trim();
          const descricao = alterado ? rascunho : registro.descricao;
          revisoes.push({ id: registro.id, anterior: alterado ? inicial.descricao : registro.descricao, descricao });
          return { ...registro, descricao, fotos: registro.fotos?.filter(foto => fotosOriginais.has(foto.id)) };
        });
        const fotosDisponiveis = new Set(incluidos.flatMap(registro => registro.fotos?.map(foto => foto.id) ?? []));
        if (original.fotografiaIds.some(id => !fotosDisponiveis.has(id))) {
          throw new Error('Uma fotografia do relatório original está indisponível. O PDF anterior foi preservado.');
        }
        textos = revisoes;
      }
      const relatorio = await gerarRelatorio(atual, atividades, incluidos);
      if (!relatorio.pdf.size) throw new Error('O PDF gerado está vazio.');
      await RelatorioRepository.adicionar(relatorio, original?.id, atualizarRegistros, textos);
      setSalvo(true);
      baixarRelatorio(relatorio);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível emitir o relatório. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="ras-atividades" className={`flex max-h-[90dvh] w-full flex-col rounded-2xl bg-white p-5 shadow-2xl ${revisarTextos ? 'max-w-4xl' : 'max-w-xl'}`}>
      <h2 id="ras-atividades" className="text-lg font-bold text-[#333436]">{original ? 'Editar Relatório' : 'Atividades Realizadas'}</h2>
      {salvo ? <p className="my-4 text-sm">Relatório salvo. Você também pode baixá-lo na lista de trabalhos.</p> : <>
        <p className="mb-3 text-sm text-slate-600">{original
          ? 'Corrija as atividades para gerar uma nova versão do relatório. O PDF anterior será arquivado.'
          : 'Selecione as atividades executadas durante esta visita.'}</p>
        <div className="min-h-0 overflow-y-auto">
          <fieldset disabled={ocupado} className="space-y-1">
            <legend className="sr-only">Atividades executadas</legend>
            {ATIVIDADES.map(a => <label key={a} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selecionadas.includes(a)} className="h-4 w-4 shrink-0 accent-[#00AFF0]"
                onChange={e => setSelecionadas(e.target.checked ? [...selecionadas, a] : selecionadas.filter(v => v !== a))} />
              {a}
            </label>)}
          </fieldset>
          {revisarTextos && <fieldset disabled={ocupado} className="mt-4 space-y-3">
            <legend className="font-semibold text-[#333436]">Descrições dos registros de campo</legend>
            <p className="text-sm text-slate-600">Ao salvar, as correções também serão aplicadas aos registros de campo e ao Mapa de Ocorrências.</p>
            {!registrosOriginais && !erro && <p role="status" className="text-sm">Carregando registros…</p>}
            {registrosOriginais?.length === 0 && <p className="text-sm">Este relatório não tem registros vinculados.</p>}
            {registrosOriginais?.map(registro => <label key={registro.id} className="block rounded-lg border border-slate-200 p-3 text-sm">
              <span className="font-semibold">{registro.tipo === 'Ocorrencia' ? 'Ocorrência' : 'Observação'} · {registro.meio} · {new Date(registro.registradoEm).toLocaleString('pt-BR')}</span>
              {registro.deletedAt && <span className="ml-2 text-slate-600">(excluído)</span>}
              <textarea lang="pt-BR" spellCheck rows={3} required readOnly={!!registro.deletedAt}
                value={descricoes[registro.id] ?? registro.descricao}
                onChange={e => setDescricoes(anteriores => ({ ...anteriores, [registro.id]: e.target.value }))}
                className="mt-2 block w-full rounded-lg border border-slate-300 p-2 read-only:bg-slate-50" />
            </label>)}
            {descricaoVazia && <p role="alert" className="text-sm text-red-700">Preencha a descrição de todos os registros editados.</p>}
          </fieldset>}
        </div>
      </>}
      {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {salvo ? <button type="button" onClick={onDone} className="rounded-xl bg-[#00AFF0] px-4 py-2 font-semibold text-white">Concluir</button> : <>
          <button type="button" disabled={ocupado} onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">Cancelar</button>
          <button type="button" disabled={!podeSalvar} onClick={gerar} className="rounded-xl bg-[#00AFF0] px-4 py-2 font-semibold text-white disabled:opacity-50">
            {ocupado ? 'Gerando relatório…' : original ? 'Salvar Revisão' : 'Gerar Relatório'}
          </button>
        </>}
      </div>
    </section>
  </div>;
}
