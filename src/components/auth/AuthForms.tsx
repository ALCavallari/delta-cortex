'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { alterarSenha, entrar, redefinirSenha, solicitarCodigoSenha, solicitarRecuperacao } from '@/app/auth/actions';
import { InstallAppButton } from './InstallAppButton';

const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#00AFF0] focus:outline-hidden focus:ring-2 focus:ring-blue-100';
const principal = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-bold text-[#163340] shadow-sm hover:bg-sky-400 disabled:opacity-50';

function Senha({ rotulo, nome, nova = false }: { rotulo: string; nome: string; nova?: boolean }) {
  const [visivel, setVisivel] = useState(false);
  return <div className="space-y-1">
    <label htmlFor={nome} className="block text-sm font-semibold">{rotulo}</label>
    <div className="relative">
      <input className={`${campo} pr-12`} id={nome} name={nome} required type={visivel ? 'text' : 'password'}
        autoComplete={nova ? 'new-password' : 'current-password'} minLength={nova ? 8 : undefined}
        maxLength={nova ? 128 : 4096} />
      <button type="button" aria-label={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
        aria-pressed={visivel} onClick={() => setVisivel(v => !v)}
        className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
        {visivel ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  </div>;
}

function Email() {
  return <label className="block space-y-1 text-sm font-semibold">
    <span>E-mail</span>
    <input className={campo} name="email" type="email" required maxLength={254}
      autoComplete="email" autoCapitalize="none" spellCheck={false} />
  </label>;
}

function Erro({ mensagem }: { mensagem?: string }) {
  return mensagem ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{mensagem}</p> : null;
}

const configuracao = 'A autenticação não está configurada. Entre em contato com a administração.';

export function LoginForm({ configurado }: { configurado: boolean }) {
  const parametros = useSearchParams();
  const next = parametros.get('next') ?? '';
  const [estado, action, pendente] = useActionState(entrar, {});
  return <form action={action} className="w-full space-y-3 text-left">
    <input name="next" type="hidden" value={next} />
    {parametros.get('senha') === 'alterada' && <p role="status" className="rounded-xl bg-lime-50 p-3 text-sm">Senha alterada. Entre com sua nova senha.</p>}
    <fieldset disabled={!configurado || pendente} className="space-y-3">
      <Email />
      <Senha rotulo="Senha" nome="password" />
      <button type="submit" className={principal}><LogIn size={18} aria-hidden />{pendente ? 'Entrando…' : 'Entrar'}</button>
    </fieldset>
    <InstallAppButton />
    <Erro mensagem={configurado ? estado.erro : configuracao} />
    <Link href="/recuperar-senha" className="block rounded text-center text-sm font-semibold text-sky-800 hover:underline">Esqueci minha senha</Link>
  </form>;
}

export function RecuperarForm({ configurado }: { configurado: boolean }) {
  const erroLink = useSearchParams().get('erro');
  const invalido = erroLink === 'convite'
    ? 'Convite inválido, usado ou expirado. Solicite um link de recuperação para o e-mail convidado.'
    : erroLink === 'link' ? 'Link inválido ou expirado. Solicite um novo link.' : undefined;
  const [estado, action, pendente] = useActionState(solicitarRecuperacao, {});
  return <form action={action} className="space-y-4">
    <Erro mensagem={configurado ? estado.erro ?? (!estado.mensagem ? invalido : undefined) : configuracao} />
    {estado.mensagem && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{estado.mensagem}</p>}
    <fieldset disabled={!configurado || pendente} className="space-y-3">
      <Email />
      <button type="submit" className={principal}>{pendente ? 'Solicitando…' : 'Enviar link'}</button>
    </fieldset>
  </form>;
}

export function RedefinirForm() {
  const [estado, action, pendente] = useActionState(redefinirSenha, {});
  return <form action={action} className="space-y-3">
    <fieldset disabled={pendente} className="space-y-3">
      <Senha rotulo="Nova senha" nome="password" nova />
      <Senha rotulo="Confirmar nova senha" nome="confirmacao" nova />
      <button type="submit" className={principal}>{pendente ? 'Salvando…' : 'Salvar nova senha'}</button>
    </fieldset>
    <Erro mensagem={estado.erro} />
  </form>;
}

export function AlterarSenhaForm({ primeiroAcesso = false }: { primeiroAcesso?: boolean }) {
  const [estado, action, pendente] = useActionState(alterarSenha, {});
  const [codigo, solicitar, solicitando] = useActionState(solicitarCodigoSenha, {});

  if (estado.entrarNovamente) return <div className="space-y-3">
    <p role="status" className="rounded-xl bg-lime-50 p-3 text-sm">{estado.mensagem}</p>
    <Link href="/" className={principal}>Voltar ao login</Link>
  </div>;

  return <div className="space-y-3">
    {estado.mensagem && <p role="status" className="rounded-xl bg-lime-50 p-3 text-sm">{estado.mensagem}</p>}
    <Erro mensagem={estado.erro} />
    <form action={action} className="space-y-3">
      <fieldset disabled={pendente || solicitando} className="space-y-3">
        <Senha rotulo={primeiroAcesso ? 'Senha provisória' : 'Senha atual'} nome="senhaAtual" />
        <Senha rotulo="Nova senha" nome="password" nova />
        <Senha rotulo="Confirmar nova senha" nome="confirmacao" nova />
        {estado.precisaCodigo && <label className="block space-y-1 text-sm font-semibold">
          <span>Código de segurança</span>
          <input name="codigo" className={campo} inputMode="numeric" autoComplete="one-time-code" maxLength={10} required />
        </label>}
        <button type="submit" className={principal}>{pendente ? 'Salvando…' : 'Salvar alteração'}</button>
      </fieldset>
    </form>
    {estado.precisaCodigo && <form action={solicitar} className="space-y-2">
      <button type="submit" disabled={pendente || solicitando} className="text-sm font-semibold text-sky-800 underline disabled:opacity-50">
        {solicitando ? 'Enviando…' : 'Enviar código de segurança'}
      </button>
      <Erro mensagem={codigo.erro} />
      {codigo.mensagem && <p role="status" className="text-sm text-slate-700">{codigo.mensagem}</p>}
    </form>}
  </div>;
}
