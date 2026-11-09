import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { clienteDoAdministrador } from '@/lib/supabase/admin-usuarios';
import type { PainelUsuarios } from '@/services/usuarios';
import { UsuariosPainel } from './usuarios-painel';

async function DadosAdministrativos() {
  const supabase = await clienteDoAdministrador();
  if (!supabase) redirect('/dashboard');
  const [painel, projetos, profissionais] = await Promise.all([
    supabase.rpc('delta_cortex_listar_usuarios_admin'),
    supabase.from('projetos').select('id,nome,excluido_em,clientes(nome_razao_social)').order('nome'),
    supabase.from('profissionais').select('id,nome,excluido_em').order('nome'),
  ]);
  if (painel.error || !painel.data || projetos.error || profissionais.error) {
    return <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">
      Administração indisponível. Confira se a migration foi aplicada e recarregue a página.
    </p>;
  }
  return <UsuariosPainel painel={painel.data as unknown as PainelUsuarios}
    projetos={projetos.data.map(p => ({
      id: p.id, nome: p.nome, excluido: !!p.excluido_em,
      cliente: (Array.isArray(p.clientes) ? p.clientes[0] : p.clientes)?.nome_razao_social,
    }))}
    profissionais={profissionais.data.map(p => ({ id: p.id, nome: p.nome, excluido: !!p.excluido_em }))} />;
}

export default function AdministracaoUsuariosPage() {
  return <><Header /><main className="mx-auto max-w-7xl space-y-4 p-5 sm:p-8">
    <h1 className="text-2xl font-bold text-[#333436]">Administração de Usuários</h1>
    <Suspense fallback={<p role="status">Carregando administração…</p>}><DadosAdministrativos /></Suspense>
  </main></>;
}
