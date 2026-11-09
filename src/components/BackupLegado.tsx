'use client';

import { useEffect, useState } from 'react';
import { ClienteSupabaseRepository } from '@/services/clientesSupabase';
import type { prepararBackupLegado } from '@/services/exportarLegado';

export function BackupLegado() {
  const [admin, setAdmin] = useState(false);
  const [backup, setBackup] = useState<Awaited<ReturnType<typeof prepararBackupLegado>> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [selecao, setSelecao] = useState<string[]>([]);
  const [exportado, setExportado] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [resultado, setResultado] = useState('');

  useEffect(() => {
    let ativo = true;
    void ClienteSupabaseRepository.obterAcesso().then(papel => {
      if (ativo) setAdmin(papel === 'admin');
    }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  if (!admin) return null;

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro('');
    try { await acao(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir a operação de legado.'); }
    finally { setOcupado(false); }
  }

  return <details className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Dados locais anteriores à centralização</summary>
    <p className="my-3 text-slate-600">O Supabase mantém os dados oficiais. Este painel revisa apenas os dados antigos deste navegador. Itens com alterações ou vínculos são preservados para revisão ou migração.</p>
    <p className="my-3 text-slate-600">O ZIP inclui os registros e arquivos originais e pode conter dados sensíveis. Guarde-o em local restrito.</p>
    <button type="button" className="rounded-lg border px-3 py-2" disabled={ocupado} onClick={() => void executar(async () => {
      const { prepararBackupLegado } = await import('@/services/exportarLegado');
      setBackup(await prepararBackupLegado());
      setSelecao([]);
      setExportado(false);
      setConfirmacao('');
      setResultado('');
    })}>Inventariar dados locais</button>
    {backup && <>
      <ul className="my-3 space-y-1">
        {backup.inventario.map(item => <li key={item.tabela}>
          {item.tabela} · {item.total}
          {item.candidatosDemonstracao.length > 0 && ` · ${item.candidatosDemonstracao.length} apto(s) para limpeza`}
        </li>)}
      </ul>
      {(backup.revisao.referenciasAusentes.length > 0 || backup.revisao.sementesComVinculos.length > 0) && (
        <p className="my-3 text-amber-800">
          O inventário encontrou {backup.revisao.referenciasAusentes.length} referência(s) local(is) ausente(s) e{' '}
          {backup.revisao.sementesComVinculos.length} ID(s) de demonstração com vínculos a revisar. Os detalhes estão no ZIP.
        </p>
      )}
      {backup.revisao.suspeitos.length > 0 && <details className="my-3">
        <summary className="cursor-pointer font-semibold">Itens protegidos para revisão ({backup.revisao.suspeitos.length})</summary>
        <ul className="mt-2 space-y-1">
          {backup.revisao.suspeitos.map(item => <li key={item.chave}>{item.chave} · {item.motivo}</li>)}
        </ul>
      </details>}
      <button type="button" className="rounded-lg bg-[#333436] px-3 py-2 text-white" disabled={ocupado} onClick={() => void executar(async () => {
        const url = URL.createObjectURL(await backup.exportar());
        const link = document.createElement('a');
        link.href = url;
        link.download = `delta-cortex-legado-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        setExportado(true);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })}>Baixar backup ZIP</button>
      {backup.candidatos.length > 0 && <fieldset disabled={ocupado} className="mt-4 space-y-2 border-t pt-4">
        <legend className="font-semibold">Limpeza seletiva dos exemplos originais</legend>
        {backup.inventario.filter(item => item.candidatosDemonstracao.length).map(item => (
          <div key={item.tabela}>
            <p className="font-medium">{item.tabela} · {selecao.filter(chave => chave.startsWith(`${item.tabela}/`)).length} selecionado(s)</p>
            {backup.candidatos.filter(candidato => candidato.tabela === item.tabela).map(item => (
              <label key={item.chave} className="flex min-h-8 items-center gap-2">
                <input type="checkbox" checked={selecao.includes(item.chave)} onChange={e => {
                  const marcado = e.currentTarget.checked;
                  setSelecao(atual => marcado ? [...atual, item.chave] : atual.filter(chave => chave !== item.chave));
                  setConfirmacao('');
                }} /> {item.id}
              </label>
            ))}
          </div>
        ))}
        {exportado && selecao.length > 0 && <label className="block">
          Confira que o ZIP foi salvo. Digite EXCLUIR para confirmar a remoção de {selecao.length} registro(s) deste navegador.
          <input className="mt-1 block rounded-lg border px-2 py-1" value={confirmacao}
            onChange={e => setConfirmacao(e.target.value)} autoComplete="off" />
        </label>}
        <button type="button" disabled={!exportado || !selecao.length || confirmacao !== 'EXCLUIR'}
          className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => void executar(async () => {
            const removidos = await backup.limpar(selecao);
            setBackup(null);
            setSelecao([]);
            setExportado(false);
            setConfirmacao('');
            setResultado(`${removidos} registro(s) de demonstração removido(s). Gere um novo inventário para conferir o resultado.`);
          })}>Remover selecionados ({selecao.length})</button>
      </fieldset>}
    </>}
    {resultado && <p role="status" className="mt-2 text-emerald-800">{resultado}</p>}
    {ocupado && <p role="status" className="mt-2">Preparando dados…</p>}
    {erro && <p role="alert" className="mt-2 text-red-700">{erro}</p>}
  </details>;
}
