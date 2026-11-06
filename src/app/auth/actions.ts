'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { COOKIE_RECUPERACAO, DASHBOARD, destinoSeguro, sessaoVerificada } from '@/lib/supabase/session';

export type EstadoAuth = { erro?: string; mensagem?: string };
const falhaConfiguracao = 'A autenticação não está configurada. Entre em contato com a administração.';
const falhaServico = 'Não foi possível acessar o serviço de autenticação. Tente novamente.';
const linkInvalido = 'Link de recuperação inválido ou expirado. Solicite um novo link.';
const emailValido = (valor: string) => valor.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

export async function entrar(_: EstadoAuth, dados: FormData): Promise<EstadoAuth> {
  const email = String(dados.get('email') ?? '').trim();
  const senha = String(dados.get('password') ?? '');
  if (!emailValido(email) || !senha || senha.length > 4096) return { erro: 'Informe um e-mail e uma senha válidos.' };
  const supabase = await criarClienteServidor(true);
  if (!supabase) return { erro: falhaConfiguracao };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) {
      if (error?.status === 429) return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
      return { erro: !error?.status || error.status >= 500 ? falhaServico : 'E-mail ou senha incorretos, ou conta indisponível.' };
    }
    (await cookies()).delete(COOKIE_RECUPERACAO);
  } catch {
    return { erro: falhaServico };
  }
  redirect(destinoSeguro(dados.get('next')));
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
  try {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error?.code === 'weak_password') return { erro: 'A nova senha não atende aos requisitos de segurança. Escolha outra.' };
    if (error?.code === 'same_password') return { erro: 'Escolha uma senha diferente da atual.' };
    if (error) return { erro: 'Não foi possível redefinir a senha. Tente novamente ou solicite um novo link.' };
    jar.delete(COOKIE_RECUPERACAO);
  } catch {
    return { erro: falhaServico };
  }
  redirect(DASHBOARD);
}
