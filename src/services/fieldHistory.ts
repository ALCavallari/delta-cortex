import { RegistroCampo, Visita } from '@/types';

export function registrosNoMapa(registros: RegistroCampo[], visita: Visita) {
  const inicio = Date.parse(visita.criadoEm);
  return registros.filter(r => !r.deletedAt && (r.visitaId === visita.id ||
    (r.tipo === 'Ocorrencia' && visita.motivo === 'Visita Sistemática' && Date.parse(r.registradoEm) <= inicio && r.situacao !== 'resolvido')));
}

export function registrosDoRelatorio(registros: RegistroCampo[], visita: Visita) {
  const inicio = Date.parse(visita.criadoEm);
  const fim = visita.finalizadaEm ? Date.parse(visita.finalizadaEm) : Date.now();
  return registros.filter(r => {
    if (r.deletedAt) return false;
    if (r.visitaId === visita.id) return true;
    if (r.tipo !== 'Ocorrencia' || Date.parse(r.registradoEm) > inicio) return false;
    const eventos = r.eventos ?? [];
    const anterior = eventos.filter(e => Date.parse(e.data) < inicio).at(-1);
    const abertoNoInicio = (anterior?.situacao ?? (eventos.length ? 'em_aberto' : r.situacao)) !== 'resolvido';
    return abertoNoInicio || eventos.some(e => {
      const data = Date.parse(e.data);
      return data >= inicio && data <= fim && (e.visitaId === visita.id || e.situacao === 'em_aberto');
    });
  }).sort((a,b) => Number(b.tipo === 'Ocorrencia') - Number(a.tipo === 'Ocorrencia') ||
    Date.parse(a.registradoEm) - Date.parse(b.registradoEm) || a.id.localeCompare(b.id));
}
