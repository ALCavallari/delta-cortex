'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RelatorioRepository } from '@/services/repositoriosOperacionais';

type Estado = { nome: string; url: string } | { erro: string };

function CarregandoRelatorio() {
  return <p role="status" className="p-6 text-sm text-slate-600">Carregando relatório…</p>;
}

function Visualizador({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>();

  useEffect(() => {
    let ativo = true;
    let url: string | undefined;
    void RelatorioRepository.baixarPorId(id).then(relatorio => {
      if (!ativo) return;
      if (!relatorio.pdf.size) throw new Error('O PDF salvo está vazio.');
      const pdf = relatorio.pdf.type === 'application/pdf'
        ? relatorio.pdf
        : new Blob([relatorio.pdf], { type: 'application/pdf' });
      url = URL.createObjectURL(pdf);
      setEstado({ nome: relatorio.nomeArquivo, url });
    }).catch(erro => {
      if (ativo) setEstado({ erro: erro instanceof Error ? erro.message : 'Não foi possível visualizar o relatório.' });
    });
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  return <main className="flex h-dvh flex-col bg-slate-100">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-base font-bold text-[#333436]">Visualizar relatório</h1>
        {estado && 'nome' in estado && <p className="break-all text-sm text-slate-600">{estado.nome}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        <Link href="/acompanhamento" className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">Trabalho de Campo</Link>
        {estado && 'url' in estado && <a href={estado.url} target="_blank" rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Abrir PDF no navegador</a>}
      </div>
    </header>
    {!estado ? <CarregandoRelatorio /> : 'erro' in estado
      ? <p role="alert" className="p-6 text-sm text-red-700">{estado.erro}</p>
      : <iframe src={estado.url} title={`Relatório ${estado.nome}`} className="min-h-0 w-full flex-1 border-0" />}
  </main>;
}

function RelatorioSelecionado() {
  const { id } = useParams<{ id: string }>();
  return <Visualizador key={id} id={id} />;
}

export default function VisualizarRelatorioPage() {
  return <Suspense fallback={<CarregandoRelatorio />}><RelatorioSelecionado /></Suspense>;
}
