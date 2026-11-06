import { RegistroCampo, Visita } from '@/types';

export function registrosNoMapa(registros: RegistroCampo[], visita: Visita) {
  return registros.filter(r => !r.deletedAt && (r.visitaId === visita.id ||
    (r.tipo === 'Ocorrencia' && visita.motivo === 'Visita Sistemática' && r.registradoEm <= visita.criadoEm && r.situacao !== 'resolvido')));
}

export function registrosDoRelatorio(registros: RegistroCampo[], visita: Visita) {
  const fim = visita.finalizadaEm ?? new Date().toISOString();
  return registros.filter(r => {
    if (r.deletedAt) return false;
    if (r.visitaId === visita.id) return true;
    if (r.tipo !== 'Ocorrencia' || r.registradoEm > visita.criadoEm) return false;
    const eventos = r.eventos ?? [];
    const inicio = eventos.filter(e => e.data < visita.criadoEm).at(-1);
    const abertoNoInicio = (inicio?.situacao ?? (eventos.length ? 'em_aberto' : r.situacao)) !== 'resolvido';
    return abertoNoInicio || eventos.some(e => e.data >= visita.criadoEm && e.data <= fim &&
      (e.visitaId === visita.id || e.situacao === 'em_aberto'));
  }).sort((a,b) => Number(b.tipo === 'Ocorrencia') - Number(a.tipo === 'Ocorrencia') ||
    a.registradoEm.localeCompare(b.registradoEm) || a.id.localeCompare(b.id));
}
