import assinaturas from './assinaturasLegado.json';
import type { lerDadosLegados } from './storage';

type Dados = Awaited<ReturnType<typeof lerDadosLegados>>;
export type TabelaLegada = 'clientes' | 'profissionais' | 'projetos' | 'visitas' | 'registros_campo'
  | 'fotografias' | 'arquivos_geograficos' | 'relatorios';
type Linha = { id: string };
const chave = (tabela: string, id: string) => `${tabela}/${id}`;
const datasGeradas = new Set(['criadoEm', 'atualizadoEm', 'registradoEm']);

export function retrato(linha: Linha, ignorarDatas = false) {
  return JSON.stringify(Object.entries(linha)
    .filter(([k]) => !ignorarDatas || !datasGeradas.has(k))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function catalogarLegado(dados: Dados) {
  const tabelas: Record<TabelaLegada, Linha[]> = {
    ...dados, registros_campo: dados.registros, arquivos_geograficos: dados.geograficos,
  };
  const nomes = ['clientes', 'profissionais', 'projetos', 'visitas', 'registros_campo',
    'fotografias', 'arquivos_geograficos', 'relatorios'] as const;
  const itens = nomes.flatMap(tabela => tabelas[tabela].map(linha => ({
    chave: chave(tabela, linha.id), id: linha.id, tabela, linha,
  })));
  const existentes = new Map(itens.map(item => [item.chave, item]));
  const vinculos: { origem: string; destino: string }[] = [];
  function ligar(origem: string, tabela: TabelaLegada, id?: string) {
    if (id) vinculos.push({ origem, destino: chave(tabela, id) });
  }
  for (const p of dados.projetos) ligar(chave('projetos', p.id), 'clientes', p.clienteId);
  for (const a of dados.geograficos) ligar(chave('arquivos_geograficos', a.id), 'projetos', a.projetoId);
  for (const v of dados.visitas) {
    const origem = chave('visitas', v.id);
    ligar(origem, 'clientes', v.clienteId);
    ligar(origem, 'projetos', v.projetoId);
    ligar(origem, 'profissionais', v.executorId);
    ligar(origem, 'profissionais', v.responsavelTecnicoId);
  }
  for (const r of dados.registros) {
    const origem = chave('registros_campo', r.id);
    ligar(origem, 'visitas', r.visitaId);
    ligar(origem, 'projetos', r.projetoId);
    ligar(origem, 'profissionais', r.tecnicoId);
    for (const e of r.eventos ?? []) {
      ligar(origem, 'visitas', e.visitaId);
      ligar(origem, 'profissionais', e.profissionalId);
    }
    for (const f of r.fotos ?? []) {
      ligar(origem, 'registros_campo', f.registroCampoId);
      ligar(origem, 'visitas', f.visitaId);
    }
  }
  for (const f of dados.fotografias) {
    const origem = chave('fotografias', f.id);
    ligar(origem, 'registros_campo', f.registroCampoId);
    ligar(origem, 'visitas', f.visitaId);
  }
  for (const r of dados.relatorios) {
    const origem = chave('relatorios', r.id);
    ligar(origem, 'visitas', r.visitaId);
    ligar(origem, 'projetos', r.projetoId);
    for (const id of r.registroIds) ligar(origem, 'registros_campo', id);
    for (const id of r.fotografiaIds) ligar(origem, 'fotografias', id);
  }
  return { itens, existentes, vinculos, nomes };
}

function datasCompativeis(item: ReturnType<typeof catalogarLegado>['itens'][number], dados: Dados) {
  const l = item.linha as Linha & { criadoEm?: string; atualizadoEm?: string; registradoEm?: string };
  const data = (v?: string) => v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ? Date.parse(v) : NaN;
  if (item.tabela === 'profissionais') return !Object.keys(l).some(k => datasGeradas.has(k));
  if (item.tabela === 'registros_campo') {
    const visita = dados.visitas.find(v => v.id === 'vis-demo-1');
    const diferenca = data(l.registradoEm) - data(visita?.criadoEm) + (l.id === 'reg-demo-1' ? 2 : 1) * 3_600_000;
    return !('criadoEm' in l) && !('atualizadoEm' in l) && diferenca >= 0 && diferenca <= 1000;
  }
  const diferenca = data(l.atualizadoEm) - data(l.criadoEm);
  return !('registradoEm' in l) && diferenca >= 0 && diferenca <= 1;
}

export function preservarDependencias(candidatos: Set<string>, vinculos: ReturnType<typeof catalogarLegado>['vinculos']) {
  const removiveis = new Set(candidatos);
  // Repetir até que as dependências indiretas dos registros preservados também estejam protegidas.
  let mudou: boolean;
  do {
    mudou = false;
    for (const { origem, destino } of vinculos) {
      if (!removiveis.has(origem) && removiveis.delete(destino)) mudou = true;
    }
  } while (mudou);
  return removiveis;
}

export function protegerConjuntos(candidatos: Set<string>, catalogo: ReturnType<typeof catalogarLegado>) {
  const { vinculos, existentes } = catalogo;
  return preservarDependencias(candidatos, [
    ...vinculos,
    ...vinculos.filter(v => existentes.has(v.destino)).map(v => ({ origem: v.destino, destino: v.origem })),
  ]);
}

export async function classificarLegado(dados: Dados) {
  const catalogo = catalogarLegado(dados);
  const { itens, existentes, vinculos, nomes } = catalogo;
  const conferidos = new Set<string>();
  const suspeitos: { chave: string; motivo: string }[] = [];
  for (const modelo of assinaturas) {
    const item = existentes.get(chave(modelo.store, modelo.id));
    if (!item) continue;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(retrato(item.linha, true)));
    const hex = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex === modelo.assinatura && datasCompativeis(item, dados)) conferidos.add(item.chave);
    else suspeitos.push({ chave: item.chave, motivo: 'Conteúdo ou datas diferentes da amostra original.' });
  }
  const aptos = protegerConjuntos(conferidos, catalogo);
  const candidatos = itens.filter(item => aptos.has(item.chave)).map(({ chave, tabela, id }) => ({ chave, tabela, id }));
  const sementesComVinculos = [...conferidos].filter(id => !aptos.has(id));
  for (const chave of sementesComVinculos) suspeitos.push({ chave, motivo: 'Vínculo direto ou indireto com registro preservado.' });
  const referenciasAusentes = vinculos.filter(v => !existentes.has(v.destino)).map(v => `${v.origem} → ${v.destino}`);
  const inventario = nomes.map(tabela => ({
    tabela, total: itens.filter(i => i.tabela === tabela).length,
    candidatosDemonstracao: candidatos.filter(i => i.tabela === tabela).map(i => i.id),
  }));
  return { candidatos, suspeitos, inventario, referenciasAusentes, sementesComVinculos };
}
