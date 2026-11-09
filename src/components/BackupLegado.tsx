'use client';

import { useEffect, useState } from 'react';
import { ClienteSupabaseRepository } from '@/services/clientesSupabase';
import type { prepararBackupLegado } from '@/services/exportarLegado';

export function BackupLegado() {
  const [admin, setAdmin] = useState(false);
  const [backup, setBackup] = useState<Awaited<ReturnType<typeof prepararBackupLegado>> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    void ClienteSupabaseRepository.obterAcesso().then(papel => {
      if (ativo) setAdmin(papel === 'admin');
    }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  if (!admin) return null;

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro('');
    try { await acao(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível preparar o backup.'); }
    finally { setOcupado(false); }
  }

  return <details className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Dados locais anteriores à centralização</summary>
    <p className="my-3 text-slate-600">O backup inclui dados pessoais, arquivos e documentos deste navegador. Guarde-o em local restrito.</p>
    <button type="button" className="rounded-lg border px-3 py-2" disabled={ocupado} onClick={() => void executar(async () => {
      const { prepararBackupLegado } = await import('@/services/exportarLegado');
      setBackup(await prepararBackupLegado());
    })}>Inventariar dados locais</button>
    {backup && <>
      <ul className="my-3 space-y-1">
        {backup.inventario.map(item => <li key={item.tabela}>
          {item.tabela} · {item.total}
          {item.candidatosDemonstracao.length > 0 && ` · IDs para revisão: ${item.candidatosDemonstracao.join(', ')}`}
        </li>)}
      </ul>
      {(backup.revisao.referenciasAusentes.length > 0 || backup.revisao.sementesComVinculos.length > 0) && (
        <p className="my-3 text-amber-800">
          O inventário encontrou {backup.revisao.referenciasAusentes.length} referência(s) local(is) ausente(s) e{' '}
          {backup.revisao.sementesComVinculos.length} ID(s) de demonstração com vínculos a revisar. Os detalhes estão no ZIP.
        </p>
      )}
      <button type="button" className="rounded-lg bg-[#333436] px-3 py-2 text-white" disabled={ocupado} onClick={() => void executar(async () => {
        const url = URL.createObjectURL(await backup.exportar());
        const link = document.createElement('a');
        link.href = url;
        link.download = `delta-cortex-legado-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })}>Baixar backup ZIP</button>
    </>}
    {ocupado && <p role="status" className="mt-2">Preparando dados…</p>}
    {erro && <p role="alert" className="mt-2 text-red-700">{erro}</p>}
  </details>;
}
