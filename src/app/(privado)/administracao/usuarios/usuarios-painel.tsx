'use client';

import { useState, useTransition } from 'react';
import { salvarUsuario } from './actions';
import { normalizarBusca } from '@/services/technicians';
import type { Perfil } from '@/services/perfis';
import { rotulosPerfil, type AlteracaoUsuario, type PainelUsuarios, type UsuarioAdministrado } from '@/services/usuarios';

type ProjetoOpcao = { id: string; nome: string; cliente?: string; excluido: boolean };
type ProfissionalOpcao = { id: string; nome: string; excluido: boolean };
const campo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const botao = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
const principal = 'rounded-xl bg-[#00AFF0] px-4 py-2 text-sm font-bold text-[#333436] disabled:opacity-50';
const principalPerfis: Perfil[] = ['admin', 'cliente', 'tecnico'];

export function UsuariosPainel({ painel, projetos, profissionais }: {
  painel: PainelUsuarios; projetos: ProjetoOpcao[]; profissionais: ProfissionalOpcao[];
}) {
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState('');
  const [status, setStatus] = useState('');
  const [edicao, setEdicao] = useState<{ usuario?: UsuarioAdministrado; foco: 'editar' | 'projetos' | 'status' } | null>(null);
  const [mensagem, setMensagem] = useState('');
  const termo = normalizarBusca(busca);
  const lista = painel.usuarios.filter(u => normalizarBusca(`${u.nome ?? ''} ${u.email}`).includes(termo)
    && (!perfil || u.papel === perfil)
    && (!status || (status === 'pendente' ? !u.confirmado : status === 'ativo' ? u.ativo && u.confirmado : !u.ativo)));

  return <div className="space-y-4">
    {!painel.externoHabilitado && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      Convites e ativações de clientes e técnicos estão bloqueados até a validação das políticas no Supabase.
    </p>}
    <div className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-4">
      <input className={campo} type="search" aria-label="Pesquisar usuário" placeholder="Nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} />
      <select className={campo} aria-label="Perfil" value={perfil} onChange={e => setPerfil(e.target.value)}>
        <option value="">Todos os perfis</option>{Object.entries(rotulosPerfil).map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
      </select>
      <select className={campo} aria-label="Situação" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Todas as situações</option><option value="ativo">Ativo</option><option value="inativo">Desativado</option><option value="pendente">Pendente</option>
      </select>
      <button className={principal} type="button" onClick={() => setEdicao({ foco: 'editar' })}>Convidar Usuário</button>
    </div>
    {mensagem && <p role="status" className="rounded-lg bg-lime-50 p-3">{mensagem}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="bg-slate-50"><tr>{['Nome', 'E-mail', 'Perfil', 'Conta', 'Acesso', 'Projetos', 'Ações'].map(c => <th scope="col" className="p-3" key={c}>{c}</th>)}</tr></thead>
        <tbody>{lista.map(u => <tr key={u.id} className="border-t">
          <td className="p-3 font-semibold">{u.nome ?? '—'}</td><td className="p-3">{u.email}</td><td className="p-3">{rotulosPerfil[u.papel]}</td>
          <td className="p-3">{u.confirmado ? 'Confirmada' : u.convidadoEm ? 'Convite pendente' : 'Aguardando confirmação'}</td>
          <td className="p-3">{u.ativo ? 'Ativado' : 'Desativado'}</td><td className="p-3">{u.papel === 'admin' ? 'Global' : u.projetos.length}</td>
          <td className="p-3"><div className="flex flex-wrap gap-1">
            <button type="button" className={botao} onClick={() => setEdicao({ usuario: u, foco: 'editar' })}>Editar</button>
            <button type="button" className={botao} onClick={() => setEdicao({ usuario: u, foco: 'status' })}>{u.ativo ? 'Desativar' : 'Ativar'}</button>
            {(u.papel === 'cliente' || u.papel === 'tecnico') && <button type="button" className={botao}
              onClick={() => setEdicao({ usuario: u, foco: 'projetos' })}>Gerenciar Projetos</button>}
          </div></td>
        </tr>)}</tbody>
      </table>
      {!lista.length && <p className="p-4 text-sm text-slate-600">Nenhum usuário encontrado.</p>}
    </div>
    {edicao && <Editor key={`${edicao.usuario?.id ?? 'novo'}-${edicao.foco}`} {...edicao} projetos={projetos} profissionais={profissionais}
      fechar={() => setEdicao(null)} concluir={texto => { setMensagem(texto); setEdicao(null); }} />}
  </div>;
}

function Editor({ usuario, foco, projetos, profissionais, fechar, concluir }: {
  usuario?: UsuarioAdministrado; foco: 'editar' | 'projetos' | 'status'; projetos: ProjetoOpcao[]; profissionais: ProfissionalOpcao[];
  fechar: () => void; concluir: (mensagem: string) => void;
}) {
  const [nome, setNome] = useState(usuario?.nome ?? usuario?.email ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [papel, setPapel] = useState<Perfil>(usuario?.papel ?? 'cliente');
  const [ativo, setAtivo] = useState(foco === 'status' ? !usuario?.ativo : usuario?.ativo ?? true);
  const [profissional, setProfissional] = useState(usuario?.profissionalId ?? '');
  const [selecionados, setSelecionados] = useState(usuario?.projetos ?? []);
  const [buscaProjeto, setBuscaProjeto] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [vincularExistente, setVincularExistente] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, iniciar] = useTransition();
  const externo = papel === 'cliente' || papel === 'tecnico';
  const revogados = usuario?.projetos.filter(id => !externo || !selecionados.includes(id)) ?? [];
  const sensivel = (usuario?.papel !== papel && (usuario?.papel === 'admin' || papel === 'admin'))
    || (usuario?.ativo && !ativo) || revogados.length > 0;
  const opcoes = usuario && !principalPerfis.includes(usuario.papel) ? [...principalPerfis, usuario.papel] : principalPerfis;
  const filtrados = projetos.filter(p => (!p.excluido || selecionados.includes(p.id))
    && normalizarBusca(`${p.nome} ${p.cliente ?? ''}`).includes(normalizarBusca(buscaProjeto)));
  const titulo = !usuario ? 'Convidar Usuário' : foco === 'status' ? (ativo ? 'Ativar acesso' : 'Desativar acesso') :
    foco === 'projetos' ? 'Gerenciar Projetos' : 'Editar usuário';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="editar-usuario" className="max-h-[90dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5"
      onSubmit={e => {
        e.preventDefault();
        const dados: AlteracaoUsuario = { id: usuario?.id, nome, email, papel, ativo, profissionalId: papel === 'tecnico' ? profissional || null : null,
          projetos: externo ? selecionados : [], confirmar, vincularExistente };
        setErro('');
        iniciar(async () => {
          try {
            const resultado = await salvarUsuario(dados);
            if (resultado.erro) setErro(resultado.erro);
            else concluir(resultado.mensagem ?? 'Alteração salva.');
          } catch { setErro('Não foi possível confirmar a operação. Recarregue a lista antes de tentar novamente.'); }
        });
      }}>
      <h2 id="editar-usuario" className="text-lg font-bold">{titulo}</h2>
      {foco !== 'editar' && <p className="text-sm text-slate-600">{usuario?.nome ?? usuario?.email}</p>}
      {foco === 'editar' && <>
        <label className="block text-sm">Nome<input className={campo} required maxLength={160} value={nome} onChange={e => setNome(e.target.value)} /></label>
        <label className="block text-sm">E-mail<input className={campo} type="email" required disabled={!!usuario} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block text-sm">Perfil<select className={campo} value={papel} onChange={e => {
          setPapel(e.target.value as Perfil); setConfirmar(false);
        }}>{opcoes.map(p => <option key={p} value={p}>{rotulosPerfil[p]}</option>)}</select></label>
        <p className="text-xs text-slate-600">{papel === 'admin' ? 'Acesso global e administração de usuários.' :
          papel === 'cliente' ? 'Consulta aos projetos autorizados e seus mapas.' :
          papel === 'tecnico' ? 'Execução de visitas e registros nos projetos designados.' : 'Permissões legadas preservadas até a reclassificação.'}</p>
        {papel === 'tecnico' && <label className="block text-sm">Profissional vinculado<select className={campo} value={profissional}
          onChange={e => setProfissional(e.target.value)}><option value="">Sem vínculo</option>
          {profissionais.filter(p => !p.excluido || p.id === profissional).map(p => <option key={p.id} value={p.id} disabled={p.excluido}>{p.nome}</option>)}
        </select></label>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={e => { setAtivo(e.target.checked); setConfirmar(false); }} /> Acesso ativado</label>
        {!usuario && <label className="flex gap-2 text-sm"><input type="checkbox" checked={vincularExistente} onChange={e => setVincularExistente(e.target.checked)} /> Vincular conta existente, se houver</label>}
      </>}
      {externo && foco !== 'status' && <fieldset className="space-y-2 rounded-xl border p-3">
        <legend className="px-1 text-sm font-bold">Projetos autorizados ({selecionados.length})</legend>
        <input type="search" aria-label="Pesquisar projetos" className={campo} value={buscaProjeto} onChange={e => setBuscaProjeto(e.target.value)} placeholder="Nome do projeto ou contratante" />
        <div className="max-h-44 overflow-y-auto">
          {filtrados.map(p => <label key={p.id} className="flex gap-2 border-b p-2 text-sm">
            <input type="checkbox" checked={selecionados.includes(p.id)} onChange={e => {
              setSelecionados(e.target.checked ? [...selecionados, p.id] : selecionados.filter(id => id !== p.id)); setConfirmar(false);
            }} />
            <span>{p.nome}{p.cliente && ` · ${p.cliente}`}{p.excluido && ' · Excluído'}</span>
          </label>)}
          {!filtrados.length && <p className="p-2 text-sm text-slate-600">Nenhum projeto encontrado.</p>}
        </div>
      </fieldset>}
      {sensivel && <label className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm">
        <input type="checkbox" checked={confirmar} onChange={e => setConfirmar(e.target.checked)} />
        Confirmo a alteração {revogados.length > 0 ? `e a revogação de ${revogados.length} projeto(s)` : 'de perfil ou situação administrativa'}.
      </label>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <div className="flex justify-end gap-2"><button className={botao} type="button" disabled={ocupado} onClick={fechar}>Cancelar</button>
        <button className={principal} disabled={ocupado || (sensivel && !confirmar)}>{ocupado ? 'Salvando…' : !usuario ? 'Confirmar convite' : 'Salvar'}</button></div>
    </form>
  </div>;
}
