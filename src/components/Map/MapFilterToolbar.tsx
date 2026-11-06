'use client';

import { useId, type ReactNode } from 'react';
import { Crosshair, Filter, History } from 'lucide-react';

export function MapFilterToolbar({ historico, onHistorico, aberto, onAbrir, onCentralizar, children }: {
  historico: boolean; onHistorico: (valor: boolean) => void;
  aberto: boolean; onAbrir: () => void; onCentralizar: () => void; children: ReactNode;
}) {
  const id = useId();
  const botao = 'flex h-7 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-slate-100';
  return <div className="absolute right-14 top-4 z-20 flex flex-col items-end gap-2 text-[#333436]">
    <div className="flex items-center rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-md backdrop-blur-xs">
      <button type="button" role="switch" aria-checked={historico} aria-label="Exibir Histórico" title="Exibir Histórico"
        className={`${botao} ${historico ? 'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300' : ''}`}
        onClick={() => onHistorico(!historico)}>
        <History size={14} aria-hidden /><span className="hidden @min-[460px]:inline">Exibir Histórico</span>
      </button>
      <button type="button" aria-label="Filtros" title="Filtros" aria-expanded={aberto} aria-controls={id}
        className={botao} onClick={onAbrir}><Filter size={14} aria-hidden /><span className="hidden @min-[460px]:inline">Filtros</span></button>
      <button type="button" aria-label="Centralizar no projeto" title="Centralizar no projeto" className={botao}
        onClick={onCentralizar}><Crosshair size={14} aria-hidden /></button>
    </div>
    <div id={id} hidden={!aberto} className="w-[min(16rem,calc(100cqw_-_4rem))] max-h-[min(42dvh,20rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow">
      {aberto && <div className="grid gap-2">{children}</div>}
    </div>
  </div>;
}

export function CamposFiltrosMapa({ historico, meio, gravidade, situacao, descricao, setMeio, setGravidade, setSituacao, setDescricao }: {
  historico: boolean; meio: string; gravidade: string; situacao: string; descricao: string;
  setMeio: (valor: string) => void; setGravidade: (valor: string) => void;
  setSituacao: (valor: string) => void; setDescricao: (valor: string) => void;
}) {
  const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
  return <>
    <label className="space-y-1 text-sm"><span>Meio Ambiental</span>
      <select className={campo} value={meio} onChange={e => setMeio(e.target.value)}>
        <option value="">Todos</option>{['Flora', 'Fauna', 'Físico', 'Social'].map(m => <option key={m}>{m}</option>)}
      </select>
    </label>
    <label className="space-y-1 text-sm"><span>Gravidade</span>
      <select className={campo} value={gravidade} onChange={e => setGravidade(e.target.value)}>
        <option value="">Todas</option>{['Leve', 'Grave', 'Gravíssima'].map(g => <option key={g}>{g}</option>)}
      </select>
    </label>
    {historico && <label className="space-y-1 text-sm"><span>Situação</span>
      <select className={campo} value={situacao} onChange={e => setSituacao(e.target.value)}>
        <option value="">Todas</option><option value="aberta">Em aberto</option><option value="resolvida">Resolvidas</option>
      </select>
    </label>}
    <label className="space-y-1 text-sm"><span>Descrição</span>
      <input type="search" className={campo} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Pesquisar descrição" />
    </label>
  </>;
}
