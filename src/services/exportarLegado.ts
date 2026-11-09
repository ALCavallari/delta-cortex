import { BlobWriter, BlobReader, TextReader, ZipWriter } from '@zip.js/zip.js';
import { exigirAdminLegado } from '@/app/(privado)/legado-actions';
import { lerDadosLegados, removerDemonstracoesLegadas } from './storage';
import { catalogarLegado, classificarLegado, retrato } from './revisarLegado';

export async function prepararBackupLegado() {
  await exigirAdminLegado();
  const dados = await lerDadosLegados();
  const { candidatos, inventario, ...revisao } = await classificarLegado(dados);
  const { existentes } = catalogarLegado(dados);
  const retratos = new Map(candidatos.map(item => [item.chave, retrato(existentes.get(item.chave)!.linha)]));
  let backupGerado = false;

  return {
    inventario,
    revisao,
    candidatos,
    async limpar(selecao: readonly string[]) {
      if (!backupGerado) throw new Error('Gere o backup deste inventário antes de limpar.');
      const selecionados = new Map<string, string>();
      for (const chave of selecao) {
        const original = retratos.get(chave);
        if (original === undefined) throw new Error('A seleção contém um item sem comprovação.');
        selecionados.set(chave, original);
      }
      return removerDemonstracoesLegadas(selecionados);
    },
    async exportar() {
      await exigirAdminLegado();
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
      const arquivo = await zip.close();
      backupGerado = true;
      return arquivo;
    },
  };
}
