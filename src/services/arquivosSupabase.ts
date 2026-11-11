import type { ArquivoGeografico, MetadadosGeograficos } from '@/types/geographic';
import { supabaseConfig } from '@/lib/supabase/config';
import { bancoOperacional, confirmarLinha, listarPaginas } from './supabaseOperacional';

export const BUCKET_GEOGRAFICO = 'delta-cortex-geograficos';
export const BUCKET_VISITAS = 'delta-cortex-visitas-sistematicas';

export async function enviarObjeto(bucket: string, path: string, blob: Blob, tipo: string, progresso?: (valor: number) => void,
  conexao?: { banco: ReturnType<typeof bancoOperacional>; token: string }) {
  const banco = conexao?.banco ?? bancoOperacional();
  progresso?.(0);
  if (blob.size <= 6 * 1024 * 1024) {
    const { error } = await banco.storage.from(bucket).upload(path, blob, { contentType: tipo, upsert: false });
    if (error) throw new Error('O Supabase não confirmou o envio do arquivo. Verifique a conexão e sua permissão.');
  } else {
    const sessao = conexao ? null : await banco.auth.getSession();
    const token = conexao?.token ?? sessao?.data.session?.access_token;
    const config = supabaseConfig();
    if (sessao?.error || !token || !config) throw new Error('Entre novamente para enviar o arquivo.');
    const host = new URL(config.url);
    if (host.hostname.endsWith('.supabase.co')) host.hostname = host.hostname.replace('.supabase.co', '.storage.supabase.co');
    const { Upload } = await import('tus-js-client');
    await new Promise<void>((resolve, reject) => {
      const envio = new Upload(blob, {
        endpoint: new URL('/storage/v1/upload/resumable', host).toString(),
        headers: { authorization: `Bearer ${token}`, apikey: config.key },
        metadata: { bucketName: bucket, objectName: path, contentType: tipo },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        onProgress: (enviados, total) => progresso?.(Math.min(99, Math.floor(100 * enviados / total))),
        onSuccess: () => resolve(),
        onError: () => reject(new Error('O envio resumível foi interrompido. Tente salvar novamente.')),
      });
      envio.start();
    });
  }
  progresso?.(99);
}

export async function baixarObjeto(bucket: string, path: string) {
  const { data, error } = await bancoOperacional().storage.from(bucket).download(path);
  if (error || !data) throw new Error('Não foi possível baixar o arquivo privado no Supabase.');
  return data;
}

export async function removerEnvioPendente(bucket: string, path: string, banco = bancoOperacional()) {
  await banco.storage.from(bucket).remove([path]);
}

export async function enviarGeografico(projetoId: string, arquivo: Omit<ArquivoGeografico, 'projetoId'>, progresso?: (valor: number) => void) {
  const formato = arquivo.formato.toLowerCase();
  const path = `${projetoId}/${arquivo.id}/${crypto.randomUUID()}.${formato}`;
  await enviarObjeto(BUCKET_GEOGRAFICO, path, arquivo.original, `application/vnd.google-earth.${formato}${formato === 'kml' ? '+xml' : ''}`, progresso);
  return {
    id: arquivo.id, projeto_id: projetoId, nome_original: arquivo.nome, formato: arquivo.formato,
    tamanho_bytes: arquivo.original.size, storage_bucket: BUCKET_GEOGRAFICO, storage_path: path,
    metadados: arquivo.metadados, quantidade_pontos: arquivo.metadados.pontos, quantidade_linhas: arquivo.metadados.linhas,
    quantidade_poligonos: arquivo.metadados.poligonos, limites_geograficos: arquivo.metadados.limites, visivel: arquivo.visivel,
  };
}

type LinhaGeografica = {
  id: string; projeto_id: string; nome_original: string; formato: ArquivoGeografico['formato'];
  tamanho_bytes: number; storage_bucket: string; storage_path: string; metadados: MetadadosGeograficos;
  importado_em: string; visivel: boolean;
};

export const ArquivoGeograficoSupabaseRepository = {
  async listar(projetoId: string): Promise<ArquivoGeografico[]> {
    const banco = bancoOperacional();
    const linhas = await listarPaginas<LinhaGeografica>(id => {
      let consulta = banco.from('projeto_arquivos_geograficos').select('*').eq('projeto_id', projetoId)
        .is('excluido_em', null).eq('status_processamento', 'pronto').order('id').limit(500);
      if (id) consulta = consulta.gt('id', id);
      return consulta.returns<LinhaGeografica[]>();
    }, 'listar camadas do projeto');
    return Promise.all(linhas.map(async r => ({
      id: r.id, projetoId: r.projeto_id, nome: r.nome_original, formato: r.formato, tamanho: r.tamanho_bytes,
      importadoEm: r.importado_em, metadados: r.metadados, visivel: r.visivel, estado: 'pronto',
      original: await baixarObjeto(r.storage_bucket, r.storage_path),
    })));
  },
  async definirVisibilidade(id: string, projetoId: string, visivel: boolean) {
    confirmarLinha(await bancoOperacional().from('projeto_arquivos_geograficos').update({ visivel }).eq('id', id)
      .eq('projeto_id', projetoId).is('excluido_em', null).select('id').maybeSingle(), 'alterar a camada');
  },
};
