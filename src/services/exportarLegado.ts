import { BlobWriter, BlobReader, TextReader, ZipWriter } from '@zip.js/zip.js';
import { ClienteSupabaseRepository } from './clientesSupabase';
import { lerDadosLegados } from './storage';

// IDs conhecidos sinalizam revisão. Um cadastro com esse ID pode ter sido alterado ou vinculado a trabalho real.
const idsSeed = new Set([
  'cli-demo-1', 'cli-demo-2', 'prof-demo-1', 'prof-demo-2', 'prof-demo-3', 'prof-demo-4',
  'proj-demo-1', 'proj-demo-2', 'vis-demo-1', 'reg-demo-1', 'reg-demo-2',
]);

export async function prepararBackupLegado() {
  if (await ClienteSupabaseRepository.obterAcesso() !== 'admin') throw new Error('A exportação exige um administrador ativo.');
  const dados = await lerDadosLegados();
  const referenciasAusentes: string[] = [];
  const sementesComVinculos: Set<string> = new Set();
  function conferir(origem: string, destino: string | undefined, ids: Set<string>, entidade: string) {
    if (!destino || !ids.has(destino)) referenciasAusentes.push(`${origem} · ${entidade}: ${destino || 'sem vínculo'}`);
    if (destino && !idsSeed.has(origem) && idsSeed.has(destino)) sementesComVinculos.add(destino);
  }
  const clientes = new Set(dados.clientes.map(c => c.id));
  const projetos = new Set(dados.projetos.map(p => p.id));
  const profissionais = new Set(dados.profissionais.map(p => p.id));
  const visitas = new Set(dados.visitas.map(v => v.id));
  const registros = new Set(dados.registros.map(r => r.id));
  const fotos = new Set(dados.fotografias.map(f => f.id));
  for (const p of dados.projetos) conferir(p.id, p.clienteId, clientes, 'cliente');
  for (const a of dados.geograficos) conferir(a.id, a.projetoId, projetos, 'projeto');
  for (const v of dados.visitas) {
    conferir(v.id, v.projetoId, projetos, 'projeto');
    conferir(v.id, v.clienteId, clientes, 'cliente');
    conferir(v.id, v.executorId, profissionais, 'executor');
    conferir(v.id, v.responsavelTecnicoId, profissionais, 'responsável técnico');
  }
  for (const r of dados.registros) {
    conferir(r.id, r.visitaId, visitas, 'visita de origem');
    if (r.projetoId) conferir(r.id, r.projetoId, projetos, 'projeto');
    for (const e of r.eventos ?? []) conferir(r.id, e.visitaId, visitas, 'visita do evento');
  }
  for (const f of dados.fotografias) {
    conferir(f.id, f.registroCampoId, registros, 'registro');
    conferir(f.id, f.visitaId, visitas, 'visita');
  }
  for (const r of dados.relatorios) {
    conferir(r.id, r.visitaId, visitas, 'visita');
    for (const id of r.registroIds) conferir(r.id, id, registros, 'registro');
    for (const id of r.fotografiaIds) conferir(r.id, id, fotos, 'fotografia');
  }
  const revisao = { referenciasAusentes, sementesComVinculos: [...sementesComVinculos] };
  const inventario = Object.entries(dados).map(([tabela, linhas]) => ({
    tabela,
    total: linhas.length,
    candidatosDemonstracao: linhas.filter(l => idsSeed.has(l.id)).map(l => l.id),
  }));

  return {
    inventario,
    revisao,
    async exportar() {
      if (await ClienteSupabaseRepository.obterAcesso() !== 'admin') throw new Error('A exportação exige um administrador ativo.');
      const { geograficos, relatorios, ...cadastros } = dados;
      const zip = new ZipWriter(new BlobWriter('application/zip'));
      const arquivosGeograficos = [];
      const arquivosRelatorios = [];
      for (const [i, { original, ...meta }] of geograficos.entries()) {
        const arquivo = `geograficos/${i}.${meta.formato.toLowerCase()}`;
        await zip.add(arquivo, new BlobReader(original));
        arquivosGeograficos.push({ ...meta, arquivo });
      }
      for (const [i, { pdf, ...meta }] of relatorios.entries()) {
        const arquivo = `relatorios/${i}.pdf`;
        await zip.add(arquivo, new BlobReader(pdf));
        arquivosRelatorios.push({ ...meta, arquivo });
      }
      await zip.add('dados.json', new TextReader(JSON.stringify({
        versao: 1, exportadoEm: new Date().toISOString(), inventario, revisao, ...cadastros,
        geograficos: arquivosGeograficos, relatorios: arquivosRelatorios,
      })));
      return zip.close();
    },
  };
}
