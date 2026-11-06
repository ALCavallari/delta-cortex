'use client';
import { useState } from 'react';
import { Copy, MapPin } from 'lucide-react';
import { LocalizacaoProjeto } from '@/types';
import { linkGoogleMaps } from '@/services/utm';

export function ProjectLocationLink({ localizacao }: { localizacao?: LocalizacaoProjeto }) {
  const [mensagem, setMensagem] = useState('');
  const url = localizacao ? linkGoogleMaps(localizacao.latitude, localizacao.longitude) : '';
  return <div className="space-y-2 text-sm">
    <h4 className="font-semibold text-[#333436]">Localização no Google Maps</h4>
    <div className="flex flex-wrap gap-2">
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00AFF0] text-white"><MapPin size={16} />Abrir no Google Maps</a> :
        <button type="button" disabled className="px-3 py-2 rounded-xl bg-slate-100 text-slate-400">Abrir no Google Maps</button>}
      <button type="button" disabled={!url} aria-label="Copiar link do Google Maps" className="p-2 border border-slate-200 rounded-xl disabled:opacity-40" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setMensagem('Link copiado.'); }
        catch { setMensagem('Não foi possível copiar o link.'); }
      }}><Copy size={16} /></button>
    </div>
    {!url && <p className="text-xs text-slate-500">Preencha uma localização UTM completa e válida para abrir o mapa.</p>}
    <p role="status" className="text-xs text-slate-500">{mensagem}</p>
  </div>;
}
