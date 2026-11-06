import { Check, TreePine, PawPrint, Mountain, UserRound } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeioAmbiental, RegistroCampo } from '@/types';
export const environmentalIcons = { Flora: TreePine, Fauna: PawPrint, 'Físico': Mountain, Social: UserRound };
export function EnvironmentalIcon({ meio, size = 18 }: { meio: MeioAmbiental; size?: number }) {
  const Icon = environmentalIcons[meio];
  return <Icon size={size} aria-hidden="true" />;
}
export function fieldMarkerHtml(reg: RegistroCampo, distinguirResolvidas = false) {
  const resolvida = distinguirResolvidas && reg.situacao === 'resolvido';
  const fundo = resolvida ? '#935757' : reg.tipo === 'Ocorrencia' ? '#E53E3E' : '#00AFF0';
  const selo = resolvida ? renderToStaticMarkup(
    <span style={{ position: 'absolute', right: -4, bottom: -3, background: 'white', color: '#333436', borderRadius: '50%', padding: 1 }}>
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </span>,
  ) : '';
  return `<div style="position:relative;width:36px;height:36px;border-radius:50%;background:${fundo};border:2px solid white;box-shadow:0 2px 8px #0006;color:white;display:flex;align-items:center;justify-content:center">${renderToStaticMarkup(<EnvironmentalIcon meio={reg.meio} size={22} />)}${selo}</div>`;
}
