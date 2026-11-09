'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { ProjectOccurrenceMap } from '@/components/Map/ProjectOccurrenceMap';
import { NewVisitModal } from '@/components/NewVisitModal';
import { ProjetoRepository, VisitaRepository } from '@/services/repositoriosOperacionais';
import { contextoRestrito, type ContextoRestrito } from '@/services/supabaseOperacional';
import type { Projeto, Visita } from '@/types';

export function ProjetosDesignados({ portal }: { portal: boolean }) {
  const [dados, setDados] = useState<{ projetos: Projeto[]; contexto: ContextoRestrito; visitas: Visita[] }>();
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState(false);
  useEffect(() => {
    let ativo = true;
    void Promise.all([ProjetoRepository.listar(), contextoRestrito(), portal ? [] : VisitaRepository.listar()])
      .then(([projetos, contexto, visitas]) => { if (ativo) setDados({ projetos, contexto, visitas }); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [portal]);
  return <><Header /><main className="mx-auto max-w-7xl space-y-5 p-5 sm:p-8">
    <h1 className="text-2xl font-bold text-[#333436]">{portal ? 'Portal do Cliente' : 'Meus Trabalhos'}</h1>
    {erro ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">Não foi possível consultar os projetos. Confira seu acesso com a administração.</p>
      : !dados ? <p role="status">Carregando projetos…</p>
      : !dados.projetos.length ? <p className="rounded-xl border bg-white p-4">Nenhum projeto autorizado. Procure a administração.</p>
      : <>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{portal ? 'Meus Projetos' : 'Projetos designados'}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{dados.projetos.map(p => <li key={p.id} className="rounded-xl border bg-white p-3">
            <p className="font-semibold">{p.nome}</p>
            <p className="text-sm text-slate-600">{dados.contexto.clientes.find(c => c.id === p.clienteId)?.nomeRazaoSocial}</p>
          </li>)}</ul>
        </section>
        {portal ? <section className="space-y-2">
          <h2 className="text-lg font-semibold">Mapa de Ocorrências</h2>
          <ProjectOccurrenceMap portal carregando={false} projetos={dados.projetos} clientes={dados.contexto.clientes} />
        </section> : <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Visitas Sistemáticas</h2>
            <button type="button" onClick={() => setNovo(true)} className="rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-bold">Novo Trabalho</button>
          </div>
          {!dados.visitas.length && <p className="text-sm text-slate-600">Nenhuma visita cadastrada para os projetos designados.</p>}
          <ul className="space-y-2">{dados.visitas.map(v => <li key={v.id}>
            <Link href={`/acompanhamento/visita/${encodeURIComponent(v.id)}`} className="block rounded-xl border bg-white p-3 hover:border-sky-500">
              <p className="font-semibold">{v.identificacao}</p>
              <p className="text-sm text-slate-600">{v.identificacaoProjeto} · {v.data.split('-').reverse().join('/')} · {v.status.replaceAll('_', ' ')}</p>
            </Link>
          </li>)}</ul>
          {novo && <NewVisitModal isOpen tecnicoDesignado onClose={() => setNovo(false)} />}
        </section>}
      </>}
  </main></>;
}
