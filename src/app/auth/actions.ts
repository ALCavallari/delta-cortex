'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/supabase/config';
import { criarClientePrivilegiado, criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, DASHBOARD, PRIMEIRO_ACESSO, destinoSeguro, lerEstadoSenha, sessaoVerificada } from '@/lib/supabase/session';

export type EstadoAuth = { erro?: string; mensagem?: string; precisaCodigo?: boolean; entrarNovamente?: boolean };
const falhaConfiguracao = 'A autenticação não está configurada. Entre em contato com a administração.';
const falhaServico = 'Não foi possível acessar o serviço de autenticação. Tente novamente.';
const linkInvalido = 'Link de recuperação inválido ou expirado. Solicite um novo link.';
const falhaConfirmacao = 'A senha foi alterada, mas o primeiro acesso ainda está bloqueado. Use a nova senha como senha atual e tente novamente.';
const emailValido = (valor: string) => valor.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

export async function entrar(_: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('password') ?? '');
  if (!emailValido(email) || !senha || senha.length > 4096) return { erro: 'Informe um e-mail e uma senha válidos.' };
  const supabase = await criarClienteServidor(true);
  if (!supabase) return { erro: falhaConfiguracao };
  let destino = destinoSeguro(dados.get('next'));
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) {
      if (error?.status === 429) return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
      return { erro: !error?.status || error.status >= 500 ? falhaServico : 'E-mail ou senha incorretos, ou conta indisponível.' };
    }
    (await cookies()).delete(COOKIE_RECUPERACAO);
    const estadoSenha = await lerEstadoSenha(supabase);
    if (!estadoSenha) return { erro: 'Não foi possível verificar o acesso. Tente novamente.' };
    if (estadoSenha !== 'liberado') destino = PRIMEIRO_ACESSO;
  } catch {
    return { erro: falhaServico };
  }
  redirect(destino);
}

async function sessaoParaTroca() {
  const supabase = await criarClienteServidor(true);
  if (!supabase) return null;
  const claims = await sessaoVerificada(supabase);
  if (!claims?.session_id || (await cookies()).get(COOKIE_RECUPERACAO)?.value === claims.session_id) return null;
  const estado = await lerEstadoSenha(supabase);
  return estado && estado !== 'sessao_anterior' ? { supabase, claims, estado } : null;
}

async function confirmarTroca(admin: NonNullable<ReturnType<typeof criarClientePrivilegiado>>, usuario: string) {
  try {
    const { data, error } = await admin.rpc('delta_cortex_confirmar_troca_provisoria', { p_usuario: usuario });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function solicitarCodigoSenha(): Promise<EstadoAuth> {
  try {
    const sessao = await sessaoParaTroca();
    if (!sessao) return { erro: 'Entre novamente para solicitar o código.' };
    const { error } = await sessao.supabase.auth.reauthenticate();
    if (error?.status === 429) return { erro: 'Aguarde alguns minutos antes de solicitar outro código.' };
    if (error) return { erro: 'Não foi possível enviar o código. Entre novamente ou tente mais tarde.' };
    return { mensagem: 'Código solicitado. Confira seu e-mail.' };
  } catch {
    return { erro: falhaServico };
  }
}

export async function alterarSenha(anterior: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const atual = String(dados.get('senhaAtual') ?? '');
  const nova = String(dados.get('password') ?? '');
  const codigo = String(dados.get('codigo') ?? '').trim();
  const falha = (erro: string) => ({ erro, precisaCodigo: anterior.precisaCodigo });
  if (!atual || atual.length > 4096) return falha('Informe a senha atual.');
  if (nova.length < 8 || nova.length > 128) return falha('Use uma senha com 8 a 128 caracteres.');
  if (nova !== dados.get('confirmacao')) return falha('As senhas precisam ser iguais.');
  if (nova === atual) return falha('Escolha uma senha diferente da atual.');
  if (codigo && !/^\d{6,10}$/.test(codigo)) return falha('Informe o código de segurança recebido.');

  try {
    const sessao = await sessaoParaTroca();
    const config = supabaseConfig();
    if (!sessao || !config) return falha('Sessão indisponível. Entre novamente.');
    const admin = sessao.estado === 'pendente' ? criarClientePrivilegiado() : null;
    if (sessao.estado === 'pendente' && !admin) return falha(falhaConfiguracao);
    // Confirma a senha mesmo em projetos onde o Auth não exige current_password globalmente.
    const verificador = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const verificacao = await verificador.auth.signInWithPassword({ email: sessao.claims.email, password: atual });
    if (verificacao.error || verificacao.data.user?.id !== sessao.claims.sub || !verificacao.data.session) {
      if (verificacao.error?.status === 429) return falha('Muitas tentativas. Aguarde alguns minutos.');
      if (verificacao.error?.code === 'invalid_credentials') return falha('A senha atual está incorreta.');
      return falha('Não foi possível confirmar a senha atual. Entre novamente e tente outra vez.');
    }
    await verificador.auth.signOut({ scope: 'local' });

    const { error } = await sessao.supabase.auth.updateUser({
      password: nova, current_password: atual, ...(codigo ? { nonce: codigo } : {}),
    });
    const motivo: string | undefined = error?.code;
    if (motivo === 'reauthentication_needed' || motivo === 'reauthentication_not_valid'
      || motivo === 'reauth_nonce_missing' || motivo === 'otp_expired') {
      return { erro: 'Confirme a troca com um código de segurança. Solicite um novo código se o anterior expirou.', precisaCodigo: true };
    }
    if (motivo === 'current_password_mismatch') return falha('A senha atual está incorreta.');
    if (motivo === 'weak_password') return falha('A nova senha não atende aos requisitos de segurança. Escolha outra.');
    if (motivo === 'same_password') return falha('Escolha uma senha diferente da atual.');
    if (motivo === 'insufficient_aal') return falha('Confirme a autenticação multifator da sua conta antes de trocar a senha.');
    if (error?.status === 429) return falha('Muitas tentativas. Aguarde alguns minutos.');
    if (error) return falha('Não foi possível alterar a senha. Entre novamente e tente outra vez.');

    if (admin) {
      if (!await confirmarTroca(admin, sessao.claims.sub)) return falha(falhaConfirmacao);
      // Sessões abertas com a senha provisória não ganham acesso após a troca.
      const encerrada = await sessao.supabase.auth.signOut({ scope: 'local' }).catch(() => null);
      if (!encerrada || encerrada.error) {
        return { mensagem: 'Senha alterada. Saia e entre novamente com a nova senha.', entrarNovamente: true };
      }
    } else return { mensagem: 'Senha alterada com sucesso.' };
  } catch {
    return falha(falhaServico);
  }
  redirect('/?senha=alterada');
}

export async function solicitarRecuperacao(_: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const email = String(dados.get('email') ?? '').trim();
  if (!emailValido(email)) return { erro: 'Informe um e-mail válido.' };
  const supabase = await criarClienteServidor(true);
  if (!supabase) return { erro: falhaConfiguracao };
  const h = await headers();
  try {
    const origem = new URL(h.get('origin') ?? '');
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const local = origem.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origem.hostname);
    if (origem.host !== host || (origem.protocol !== 'https:' && !local)) return { erro: 'Endereço de recuperação indisponível.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/auth/callback', origem).href,
    });
    if (error && ![400, 404, 422].includes(error.status ?? 0)) {
      return { erro: error.status === 429 ? 'Aguarde alguns minutos antes de pedir outro link.' : falhaServico };
    }
    return { mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.' };
  } catch {
    return { erro: falhaServico };
  }
}

export async function redefinirSenha(_: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const senha = String(dados.get('password') ?? '');
  if (senha.length < 8 || senha.length > 128) return { erro: 'Use uma senha com 8 a 128 caracteres.' };
  if (senha !== dados.get('confirmacao')) return { erro: 'As senhas precisam ser iguais.' };
  const supabase = await criarClienteServidor(true);
  if (!supabase) return { erro: falhaConfiguracao };
  const jar = await cookies();
  const claims = await sessaoVerificada(supabase);
  if (!claims?.session_id || jar.get(COOKIE_RECUPERACAO)?.value !== claims.session_id) return { erro: linkInvalido };
  let destino = DASHBOARD;
  try {
    const estado = await lerEstadoSenha(supabase);
    if (!estado) return { erro: falhaServico };
    const admin = estado === 'pendente' ? criarClientePrivilegiado() : null;
    if (estado === 'pendente' && !admin) return { erro: falhaConfiguracao };
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error?.code === 'weak_password') return { erro: 'A nova senha não atende aos requisitos de segurança. Escolha outra.' };
    if (error?.code === 'same_password') return { erro: 'Escolha uma senha diferente da atual.' };
    if (error) return { erro: 'Não foi possível redefinir a senha. Tente novamente ou solicite um novo link.' };
    jar.delete(COOKIE_RECUPERACAO);
    if (admin) {
      const confirmada = await confirmarTroca(admin, claims.sub);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      destino = confirmada ? '/?senha=alterada' : '/';
    }
  } catch {
    return { erro: falhaServico };
  }
  redirect(destino);
}
