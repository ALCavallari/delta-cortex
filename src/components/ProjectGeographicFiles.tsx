'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ArquivoGeograficoRepository } from '@/services/repositoriosOperacionais';
import { criarWorkerGeografico } from '@/services/geographicWorker';
import type { ArquivoGeografico, MetadadosGeograficos } from '@/types/geographic';

type NovoArquivo = Omit<ArquivoGeografico, 'projetoId'>;
export interface ArquivosGeograficosDraft {
  alteracoes(): { adicionar: NovoArquivo[]; remover: string[]; progresso: (id: string, valor: number) => void };
}
type Linha = {
  id: string;
  nome: string;
  tamanho: number;
  formato: string;
  progresso?: number;
  erro?: string;
  arquivo?: NovoArquivo;
  existente?: boolean;
};
const total = (m: MetadadosGeograficos) => m.pontos + m.linhas + m.poligonos;

export function ProjectGeographicFiles({ projetoId, desabilitado, ref }: {
  projetoId?: string;
  desabilitado: boolean;
  ref: Ref<ArquivosGeograficosDraft>;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [remover, setRemover] = useState<string[]>([]);
  const [envios, setEnvios] = useState<Record<string, number>>({});
  const [falha, setFalha] = useState(false);
  const [carregando, setCarregando] = useState(!!projetoId);
  const input = useRef<HTMLInputElement>(null);
  const lote = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    void ArquivoGeograficoRepository.listar(projetoId).then(arquivos => {
      if (ativo) setLinhas(arquivos.map(arquivo => ({ ...arquivo, arquivo, existente: true })));
    }).catch(() => { if (ativo) setFalha(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [projetoId]);

  useEffect(() => () => lote.current?.abort(), []);
  useImperativeHandle(ref, () => ({
    alteracoes() {
      if (lote.current) throw new Error('Aguarde ou cancele o processamento dos arquivos geográficos.');
      return {
        adicionar: linhas.flatMap(linha => !linha.existente && linha.arquivo ? [linha.arquivo] : []),
        remover,
        progresso: (id, valor) => setEnvios(atual => ({ ...atual, [id]: valor })),
      };
    },
  }), [linhas, remover]);

  async function importar(arquivos: File[]) {
    if (!arquivos.length || lote.current) return;
    const controlador = new AbortController();
    lote.current = controlador;
    const fila = arquivos.map(arquivo => ({
      id: crypto.randomUUID(), arquivo, formato: arquivo.name.split('.').at(-1)?.toUpperCase() ?? '',
    }));
    setLinhas(lista => [...lista, ...fila.map(item => ({
      id: item.id, nome: item.arquivo.name, tamanho: item.arquivo.size, formato: item.formato, progresso: 0,
    }))]);
    try {
      for (const { id, arquivo, formato } of fila) {
        if (controlador.signal.aborted) break;
        const atualizar = (dados: Partial<Linha>) => {
          setLinhas(lista => lista.map(linha => linha.id === id ? { ...linha, ...dados } : linha));
        };
        try {
          if (formato !== 'KMZ' && formato !== 'KML') throw new Error('Formato não suportado. Selecione um KMZ ou KML.');
          const metadados = await processar(arquivo, formato, controlador.signal, progresso => atualizar({ progresso }));
          atualizar({ progresso: undefined, arquivo: {
            id, nome: arquivo.name, tamanho: arquivo.size, original: arquivo, formato, metadados,
            importadoEm: new Date().toISOString(), estado: 'pronto', visivel: true,
          } });
        } catch (erro) {
          if (!controlador.signal.aborted) atualizar({ progresso: undefined, erro: erro instanceof Error ? erro.message : 'Falha ao processar o arquivo.' });
        }
      }
    } finally {
      lote.current = null;
    }
  }

  const processando = linhas.some(linha => linha.progresso !== undefined);
  return <section className="space-y-3 border-t border-slate-200 pt-4">
    <h3 className="font-bold text-[#333436]">Arquivos Geográficos</h3>
    <input ref={input} type="file" multiple accept=".kmz,.kml" className="hidden" onChange={e => {
      const arquivos = Array.from(e.currentTarget.files ?? []);
      e.currentTarget.value = '';
      void importar(arquivos);
    }} />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={desabilitado || processando || carregando} onClick={() => input.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
        <Plus size={16} aria-hidden /> Adicionar Arquivos KMZ
      </button>
      {processando && <button type="button" className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700" onClick={() => {
        lote.current?.abort();
        setLinhas(lista => lista.filter(linha => linha.progresso === undefined));
      }}>Cancelar processamento</button>}
    </div>
    {carregando && <p role="status" className="text-xs text-slate-600">Carregando arquivos…</p>}
    {falha && <p role="alert" className="text-xs text-red-700">Não foi possível listar os arquivos já associados.</p>}
    {linhas.length > 0 && <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {linhas.map(linha => <li key={linha.id} className="flex items-start justify-between gap-2 p-3 text-sm">
        <div className="min-w-0">
          <p className="break-words font-semibold">{linha.nome}</p>
          <p className="text-xs text-slate-600">{linha.formato} · {(linha.tamanho / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KiB</p>
          {linha.progresso !== undefined && <p role="status" className="text-xs text-slate-600">Processando · {linha.progresso}%</p>}
          {desabilitado && envios[linha.id] !== undefined && <p role="status" className="text-xs text-slate-600">
            {envios[linha.id] === 99 ? 'Aguardando confirmação do servidor…' : `Enviando · ${envios[linha.id]}%`}
          </p>}
          {linha.erro && <p role="alert" className="text-xs text-red-700">{linha.erro}</p>}
          {linha.arquivo && <p className="text-xs text-emerald-800">
            Pronto · {total(linha.arquivo.metadados).toLocaleString('pt-BR')} elementos
            {linha.arquivo.metadados.ignorados > 0 && ` · ${linha.arquivo.metadados.ignorados} recursos sem visualização`}
          </p>}
        </div>
        <button type="button" aria-label={`Remover ${linha.nome}`} title="Remover arquivo"
          disabled={desabilitado || linha.progresso !== undefined} className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          onClick={() => {
            if (linha.existente && !window.confirm('Remover este arquivo geográfico ao salvar o projeto?')) return;
            if (linha.existente) setRemover(lista => [...lista, linha.id]);
            setLinhas(lista => lista.filter(item => item.id !== linha.id));
          }}><Trash2 size={16} aria-hidden /></button>
      </li>)}
    </ul>}
  </section>;
}

function processar(arquivo: File, formato: 'KMZ' | 'KML', signal: AbortSignal, progresso: (n: number) => void) {
  return new Promise<MetadadosGeograficos>((resolve, reject) => {
    const worker = criarWorkerGeografico();
    function concluir(erro?: string, metadados?: MetadadosGeograficos) {
      signal.removeEventListener('abort', cancelar);
      worker.terminate();
      if (metadados) resolve(metadados);
      else reject(new Error(erro));
    }
    const cancelar = () => concluir('Processamento cancelado.');
    signal.addEventListener('abort', cancelar, { once: true });
    worker.onerror = () => concluir('Não foi possível processar o arquivo neste dispositivo.');
    worker.onmessage = ({ data }) => {
      if (data.tipo === 'progresso') progresso(data.percentual);
      if (data.tipo === 'pronto') concluir(undefined, data.metadados);
      if (data.tipo === 'erro') concluir(data.mensagem);
    };
    worker.postMessage({ arquivo, formato, mapa: false });
  });
}
