'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { clienteDoAdministrador } from '@/lib/supabase/admin-usuarios';
import { supabaseConfig } from '@/lib/supabase/config';
import { perfilValido } from '@/services/perfis';
import type { AlteracaoUsuario, PainelUsuarios } from '@/services/usuarios';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const externo = (p: string) => p === 'cliente' || p === 'tecnico';

function destinoConvite() {
  try {
    const url = new URL(process.env.DELTA_CORTEX_SITE_URL ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return new URL('/auth/convite', url).href;
  } catch { return null; }
}

export async function salvarUsuario(input: AlteracaoUsuario): Promise<{ erro?: string; mensagem?: string }> {
  const supabase = await clienteDoAdministrador();
  if (!supabase) return { erro: 'Operação exclusiva de administradores ativos.' };
  if (!input || typeof input.nome !== 'string' || !input.nome.trim() || input.nome.trim().length > 160
      || !perfilValido(input.papel) || typeof input.ativo !== 'boolean' || typeof input.confirmar !== 'boolean'
      || typeof input.vincularExistente !== 'boolean' || !Array.isArray(input.projetos) || input.projetos.length > 250
      || input.projetos.some(p => typeof p !== 'string' || !p || p.length > 200)
      || (input.profissionalId !== null && (input.papel !== 'tecnico' || typeof input.profissionalId !== 'string' || input.profissionalId.length > 200))
      || (input.id !== undefined && (typeof input.id !== 'string' || !uuid.test(input.id)))) {
    return { erro: 'Confira o nome, perfil, profissional e projetos selecionados.' };
  }
  const { data, error } = await supabase.rpc('delta_cortex_listar_usuarios_admin').overrideTypes<PainelUsuarios, { merge: false }>();
  if (error || !data) return { erro: 'A administração ainda não está disponível no banco. Confira a migration.' };
  const painel = data as unknown as PainelUsuarios;
  const atual = painel.usuarios.find(u => u.id === input.id);
  if ((input.id && !atual) || ((!atual || atual.papel !== input.papel) && ['editor','leitor'].includes(input.papel))) {
    return { erro: 'Usuário ou perfil indisponível.' };
  }
  if (externo(input.papel) && !painel.externoHabilitado && (input.ativo || !input.id)) {
    return { erro: 'Acesso externo bloqueado até a validação das políticas no Supabase.' };
  }
  const projetos = externo(input.papel) ? [...new Set(input.projetos)] : [];
  if (!input.confirmar && (
    (atual?.papel !== input.papel && (atual?.papel === 'admin' || input.papel === 'admin'))
    || (atual?.ativo && !input.ativo) || atual?.projetos.some(p => !projetos.includes(p))
  )) return { erro: 'Confirme a alteração sensível antes de salvar.' };

  let id = input.id;
  let enviado = false;
  if (!id) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (email.length > 254 || !emailValido.test(email)) return { erro: 'Informe um e-mail válido.' };
    const conta = await supabase.rpc('delta_cortex_usuario_auth_admin', { p_email: email });
    if (conta.error) return { erro: 'Não foi possível verificar a conta de autenticação.' };
    if (typeof conta.data === 'string') {
      if (painel.usuarios.some(u => u.id === conta.data)) return { erro: 'Esta conta já está cadastrada. Use Editar.' };
      if (!input.vincularExistente) return { erro: 'A conta já existe. Confirme “Vincular conta existente” para conceder o acesso.' };
      id = conta.data;
    } else {
      const segredo = process.env.SUPABASE_SECRET_KEY?.trim();
      const config = supabaseConfig();
      const redirectTo = destinoConvite();
      if (!segredo?.startsWith('sb_secret_') || !config || !redirectTo) {
        return { erro: 'Configure SUPABASE_SECRET_KEY e DELTA_CORTEX_SITE_URL no servidor para enviar convites.' };
      }
      try {
        const admin = createClient(config.url, segredo, { auth: { persistSession: false, autoRefreshToken: false } });
        const convite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (convite.error || !convite.data.user) {
          if (convite.error?.code === 'email_exists' || convite.error?.code === 'user_already_exists') {
            return { erro: 'A conta já existe. Confira o e-mail e tente vinculá-la explicitamente.' };
          }
          return { erro: 'O Supabase Auth não confirmou o convite. Confira o serviço de e-mail e tente novamente.' };
        }
        id = convite.data.user.id;
        enviado = true;
      } catch { return { erro: 'Não foi possível enviar o convite. Tente novamente.' }; }
    }
  }

  const resultado = await supabase.rpc('delta_cortex_salvar_usuario_admin', {
    p_usuario: id, p_nome: input.nome.trim(), p_papel: input.papel, p_ativo: input.ativo,
    p_profissional: input.profissionalId, p_projetos: projetos, p_novo: !input.id,
    p_confirmar: input.confirmar, p_convite: enviado,
  });
  if (resultado.error) {
    if (enviado) return { erro: 'O convite foi enviado, mas o acesso não foi registrado. Revise os vínculos e tente vincular a conta existente.' };
    if (resultado.error.code === '23514') return { erro: 'O último administrador ativo deve ser preservado.' };
    if (resultado.error.code === '23505') return { erro: 'A conta ou o profissional já está vinculado. Atualize a lista.' };
    if (resultado.error.code === '23503') return { erro: 'Um projeto ou profissional selecionado está indisponível.' };
    return { erro: 'A alteração não foi confirmada. Atualize a lista e tente novamente.' };
  }
  revalidatePath('/administracao/usuarios');
  return { mensagem: enviado ? 'Convite enviado e permissões registradas.' : 'Permissões salvas.' };
}
