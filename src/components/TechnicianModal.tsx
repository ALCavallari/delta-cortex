'use client';

import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MessageCircle, X } from 'lucide-react';
import type { Profissional } from '@/types';
import { operacaoCentralizada, ProfissionalRepository } from '@/services/repositoriosOperacionais';
import { formatarCPF, formatarCNPJ, validarCPF, validarCNPJ, validarEmail } from '@/services/validation';
import { mascaraContato, numeroWhatsApp } from '@/services/technicians';

const campos = {
  nome: 'Nome Completo', rg: 'RG', cpf: 'CPF', cnpj: 'CNPJ', contato: 'Contato',
  email: 'E-mail', endereco: 'Endereço', placaVeiculo: 'Placa do Veículo', chavePix: 'Chave Pix',
  banco: 'Banco', agencia: 'Agência', contaCorrente: 'C/C',
} as const;
type Campo = keyof typeof campos;
const pessoais = ['nome', 'rg', 'cpf', 'cnpj'] as const;
const contato = ['contato', 'email', 'endereco'] as const;
const bancarios = ['chavePix', 'banco', 'agencia', 'contaCorrente'] as const;
const aviso = 'O armazenamento local deste navegador não deve ser usado para dados bancários reais.';
const input = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#00AFF0] focus:outline-hidden focus:ring-2 focus:ring-sky-100';
export const botaoNeutro = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const botaoPrincipal = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-[#163340] hover:bg-sky-400 disabled:opacity-50';

export function WhatsAppTecnico({ telefone = '', exibirIndisponivel = false }: { telefone?: string; exibirIndisponivel?: boolean }) {
  const numero = numeroWhatsApp(telefone);
  const estilo = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50';
  return numero ? <a href={`https://wa.me/${numero}`} target="_blank" rel="noopener noreferrer"
    className={estilo} aria-label="Abrir WhatsApp" title="Abrir WhatsApp"><MessageCircle size={17} aria-hidden /></a>
    : exibirIndisponivel ? <button type="button" disabled aria-label="WhatsApp indisponível" title="Informe um telefone válido"
      className={`${estilo} opacity-40`}><MessageCircle size={17} aria-hidden /></button> : null;
}

export function TechnicianDialog({ titulo, onClose, ocupado = false, children }: {
  titulo: string; onClose: () => void; ocupado?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby="tecnico-dialog-titulo" onCancel={e => { e.preventDefault(); if (!ocupado) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white text-[#333436] shadow-xl backdrop:bg-slate-900/60">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <h2 id="tecnico-dialog-titulo" className="text-lg font-bold">{titulo}</h2>
      <button type="button" onClick={onClose} disabled={ocupado} title="Fechar" aria-label="Fechar" className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}

export function TechnicianForm({ tecnico, onClose, onSaved, mostrarBancarios = false }: {
  tecnico?: Profissional; onClose: () => void; onSaved: (p: Profissional) => void; mostrarBancarios?: boolean;
}) {
  const [dados, setDados] = useState(() => ({
    ...Object.fromEntries(Object.keys(campos).map(k => [k, tecnico?.[k as Campo] ?? ''])) as Record<Campo, string>,
    habilitado: tecnico ? tecnico.habilitado === true : true,
  }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setErro('');
    const nome = dados.nome.trim(), cpf = dados.cpf.trim(), cnpj = dados.cnpj.trim();
    const telefone = dados.contato.trim(), email = dados.email.trim(), placa = dados.placaVeiculo.replace(/[\s-]/g, '');
    const mensagem = !nome ? 'Informe o nome completo.'
      : cpf && !validarCPF(cpf) ? 'Informe um CPF válido.'
      : cnpj && !validarCNPJ(cnpj) ? 'Informe um CNPJ válido.'
      : telefone && !numeroWhatsApp(telefone) ? 'Informe um telefone brasileiro válido com DDD.'
      : email && !validarEmail(email) ? 'Informe um e-mail válido.'
      : placa && !/^[A-Z]{3}\d[0-9A-Z]\d{2}$/.test(placa) ? 'Informe uma placa brasileira válida (ABC-1234 ou ABC1D23).'
      : '';
    if (mensagem) { setErro(mensagem); return; }
    setOcupado(true);
    const agora = new Date().toISOString();
    const cadastro: Profissional = {
      ...tecnico, ...dados, nome, cpf, cnpj, contato: telefone, email, placaVeiculo: placa,
      id: tecnico?.id ?? crypto.randomUUID(), origemTemporaria: false,
      criadoEm: tecnico ? tecnico.criadoEm : agora, atualizadoEm: agora,
    };
    try {
      const confirmado = await ProfissionalRepository.salvar(cadastro, tecnico);
      onSaved(confirmado ?? cadastro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o técnico. Tente novamente.');
    } finally { setOcupado(false); }
  }

  function campo(k: Campo) {
    const mudar = (v: string) => {
      const valor = k === 'cpf' ? formatarCPF(v) : k === 'cnpj' ? formatarCNPJ(v) :
        k === 'contato' ? mascaraContato(v) : k === 'placaVeiculo' ? v.toUpperCase() : v;
      setDados(prev => ({ ...prev, [k]: valor }));
    };
    return <div key={k} className={k === 'nome' || k === 'endereco' ? 'sm:col-span-2' : ''}>
      <label htmlFor={`tecnico-${k}`} className="mb-1 block text-xs font-semibold text-slate-700">{campos[k]}{k === 'nome' ? ' *' : ''}</label>
      <div className="flex items-center gap-2">
        {k === 'endereco' ? <textarea id={`tecnico-${k}`} rows={3} className={input} value={dados[k]} onChange={e => mudar(e.target.value)} />
          : <input id={`tecnico-${k}`} type={k === 'email' ? 'email' : k === 'contato' ? 'tel' : 'text'} required={k === 'nome'}
              inputMode={k === 'cpf' || k === 'cnpj' ? 'numeric' : undefined} className={input} value={dados[k]}
              onChange={e => mudar(e.target.value)} />}
        {k === 'contato' && <WhatsAppTecnico telefone={dados.contato} exibirIndisponivel />}
      </div>
    </div>;
  }

  return <TechnicianDialog titulo={tecnico ? 'Editar Técnico' : 'Novo Técnico'} onClose={onClose} ocupado={ocupado}>
    <form onSubmit={salvar}>
      <fieldset disabled={ocupado} className="space-y-5 p-5">
        <Secao titulo="Dados Pessoais">
          {campo('nome')}
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-semibold text-slate-500">RG / CPF</p>
            <div className="grid gap-3 sm:grid-cols-2">{campo('rg')}{campo('cpf')}</div>
          </div>
          {campo('cnpj')}
        </Secao>
        <Secao titulo="Contato e Endereço">{contato.map(campo)}</Secao>
        <Secao titulo="Informações Operacionais">
          <label className="text-xs font-semibold text-slate-700">Habilitado
            <select className={`${input} mt-1`} value={dados.habilitado ? 'sim' : 'nao'}
              onChange={e => setDados(prev => ({ ...prev, habilitado: e.target.value === 'sim' }))}>
              <option value="sim">Sim</option><option value="nao">Não</option>
            </select>
          </label>
          {campo('placaVeiculo')}
        </Secao>
        {mostrarBancarios && <Secao titulo="Dados Bancários">
          {!operacaoCentralizada && <p className="text-xs text-slate-600 sm:col-span-2">{aviso}</p>}
          {bancarios.map(campo)}
        </Secao>}
        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      </fieldset>
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-4">
        <button type="button" className={botaoNeutro} disabled={ocupado} onClick={onClose}>Cancelar</button>
        <button type="submit" className={botaoPrincipal} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar Técnico'}</button>
      </div>
    </form>
  </TechnicianDialog>;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section>
    <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold">{titulo}</h3>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </section>;
}

export function TechnicianDetails({ tecnico, onClose, onEdit, onDelete, mostrarBancarios = false }: {
  tecnico: Profissional; onClose: () => void; onEdit: () => void; onDelete: () => void; mostrarBancarios?: boolean;
}) {
  const info = (k: Campo) => <div key={k} className="min-w-0">
    <p className="text-xs font-semibold text-slate-500">{campos[k]}</p>
    <div className="flex items-center gap-2"><p className="whitespace-pre-wrap break-words text-sm">{tecnico[k] || '—'}</p>
      {k === 'contato' && <WhatsAppTecnico telefone={tecnico.contato} />}</div>
  </div>;
  return <TechnicianDialog titulo="Visualizar Técnico" onClose={onClose}>
    <div className="space-y-5 p-5">
      <Secao titulo="Dados Pessoais">{pessoais.map(info)}</Secao>
      <Secao titulo="Contato e Endereço">{contato.map(info)}</Secao>
      <Secao titulo="Informações Operacionais">
        <div><p className="text-xs font-semibold text-slate-500">Habilitado</p><p>{tecnico.habilitado ? 'Sim' : 'Não'}</p></div>
        {info('placaVeiculo')}
      </Secao>
      {mostrarBancarios && <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-bold">Dados Bancários</summary>
        {!operacaoCentralizada && <p className="my-3 text-xs text-slate-600">{aviso}</p>}
        <div className="grid gap-3 sm:grid-cols-2">{bancarios.map(info)}</div>
      </details>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">
      <BotaoAcaoCadastro acao="excluir" onClick={onDelete} />
      <BotaoAcaoCadastro acao="editar" onClick={onEdit} />
    </div>
  </TechnicianDialog>;
}
