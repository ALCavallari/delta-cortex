'use client';
import { LocalizacaoProjeto } from '@/types';
import { lerLinkGoogleMaps } from '@/services/googleMaps';
import { converterParaUTM, converterUTMParaGeografica, lerMetrosBR } from '@/services/utm';
import { ProjectLocationLink } from './ProjectLocationLink';
export interface LocationDraft { e: string; n: string; zona: string; hemisferio: 'S' | 'N'; datum: LocalizacaoProjeto['datum']; }
export function locationDraft(loc?: LocalizacaoProjeto): LocationDraft {
  const fmt = (n: number) => n.toLocaleString('pt-BR', {maximumFractionDigits: 10});
  return {e: loc ? fmt(loc.easting) : '', n: loc ? fmt(loc.northing) : '', zona: loc ? String(loc.zona) : '', hemisferio: loc?.hemisferio ?? 'S', datum: loc?.datum ?? 'SIRGAS 2000'};
}
export function resolveLocation(d: LocationDraft): LocalizacaoProjeto | undefined {
  if (!d.e.trim() && !d.n.trim() && !d.zona) return undefined;
  if (!d.e.trim() || !d.n.trim() || !d.zona) throw new Error('Preencha E, N e fuso e confira o hemisfério e datum.');
  const easting = lerMetrosBR(d.e), northing = lerMetrosBR(d.n), zona = Number(d.zona);
  return {easting, northing, zona, hemisferio: d.hemisferio, datum: d.datum, ...converterUTMParaGeografica(easting, northing, zona, d.hemisferio, d.datum)};
}
export function ProjectLocationFields({value, onChange, link, onLinkChange}: {
  value: LocationDraft;
  onChange: (d: LocationDraft) => void;
  link: string;
  onLinkChange: (link: string) => void;
}) {
  let loc: LocalizacaoProjeto | undefined, erro = '';
  try { loc = resolveLocation(value); } catch (e) { erro = (e as Error).message; }
  const parsed = lerLinkGoogleMaps(link);
  const point = parsed && 'latitude' in parsed ? parsed : null;
  const outsideUTM = point && (point.latitude < -80 || point.latitude > 84);
  const matches = point && loc && Math.abs(loc.latitude - point.latitude) < 1e-7 &&
    Math.abs(((loc.longitude - point.longitude + 540) % 360) - 180) < 1e-7;

  function preencher(latitude: number, longitude: number) {
    if (latitude < -80 || latitude > 84) return;
    const utm = converterParaUTM(latitude, longitude, false);
    onChange(locationDraft({ ...utm, datum: 'WGS84', latitude, longitude }));
  }

  const cls = 'mt-1 w-full border border-slate-300 rounded-xl p-2.5 bg-white';
  return <section className="space-y-3 border-t border-slate-200 pt-4">
    <h3 className="font-bold text-[#333436]">Localização do Projeto</h3>
    <p className="text-xs text-slate-500">Opcional. Coordenadas UTM em metros; use vírgula para decimais.</p>
    <label className="block min-w-0 text-xs font-semibold">
      Link do Google Maps
      <input type="text" inputMode="url" value={link} aria-describedby="projeto-maps-orientacao"
        placeholder="Cole aqui o link da localização no Google Maps" className={cls}
        onChange={e => {
          const next = e.target.value;
          onLinkChange(next);
          const result = lerLinkGoogleMaps(next);
          if (result?.tipo === 'ponto') preencher(result.latitude, result.longitude);
        }} />
    </label>
    <p id="projeto-maps-orientacao" className="text-xs text-slate-500">Cole um link do Google Maps para preencher automaticamente as coordenadas do projeto.</p>
    {link.trim() && <div role="status" className="text-xs text-slate-600">
      {!parsed ? 'Informe um link HTTPS válido do Google Maps.' :
        !point ? 'Não foi possível identificar automaticamente as coordenadas neste link. Tente copiar o endereço completo do Google Maps ou informe as coordenadas manualmente.' :
        outsideUTM ? 'O ponto está fora da faixa de latitudes do sistema UTM.' :
        matches ? 'Coordenadas do link identificadas.' :
        point.tipo === 'ponto' ? 'A localização atual difere das coordenadas do link original.' :
        <>
          <p>O link informa o centro da visualização. Confirme se este é o ponto do projeto: {point.latitude}, {point.longitude}.</p>
          {loc && <p>A localização atual é diferente do centro informado no link original.</p>}
          <button type="button" className="mt-2 rounded-lg border border-slate-300 px-3 py-2 font-semibold"
            onClick={() => preencher(point.latitude, point.longitude)}>Usar este ponto</button>
        </>}
    </div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(['e', 'n'] as const).map(k => <label key={k} className="text-xs font-semibold">{k === 'e' ? 'Coordenada E (Easting)' : 'Coordenada N (Northing)'}
        <input inputMode="decimal" value={value[k]} onChange={e => onChange({...value, [k]: e.target.value})} onBlur={() => {const n = lerMetrosBR(value[k]); if (Number.isFinite(n)) onChange({...value, [k]: n.toLocaleString('pt-BR', {maximumFractionDigits: 10})});}} className={cls} />
      </label>)}
      <label className="text-xs font-semibold">Fuso UTM<select value={value.zona} onChange={e => onChange({...value, zona: e.target.value})} className={cls}><option value="">Selecione...</option>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
      <label className="text-xs font-semibold">Hemisfério<select value={value.hemisferio} onChange={e => onChange({...value, hemisferio: e.target.value as 'S'|'N'})} className={cls}><option value="S">Sul</option><option value="N">Norte</option></select></label>
      <label className="text-xs font-semibold">Sistema de Referência (Datum)<select value={value.datum} onChange={e => onChange({...value, datum: e.target.value as LocationDraft['datum']})} className={cls}><option>SIRGAS 2000</option><option>WGS84</option></select></label>
    </div>
    {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
    <ProjectLocationLink localizacao={loc} />
  </section>;
}
