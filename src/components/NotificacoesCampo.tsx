'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Bell, Pencil, Plus, Trash2 } from 'lucide-react';
import { notificacoesCampo, type DestinatarioCampo, type NotificacaoCampo } from '@/services/notificacoesCampo';
import type { Visita } from '@/types';

const botao = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';
const principal = `${botao} border-sky-700 bg-sky-700 text-white hover:bg-sky-800`;
const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const mensagemErro = (erro: unknown) => erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';

function Janela({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const elemento = dialogo.current;
    elemento?.showModal();
    return () => elemento?.close();
  }, []);
  return <dialog ref={dialogo} aria-labelledby={tituloId} onCancel={evento => { evento.preventDefault(); fechar(); }}
    className="m-auto max-h-[88dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-xl backdrop:bg-slate-950/60">
    <h2 id={tituloId} className="mb-4 text-lg font-bold">{titulo}</h2>
    {children}
  </dialog>;
}

export function useNotificacoesCampo(habilitado: boolean) {
  const [lista, setLista] = useState<NotificacaoCampo[]>();
  const [erro, setErro] = useState('');
  const versao = useRef(0);
  const atualizar = useCallback(async () => {
    if (!habilitado) return;
    const consulta = ++versao.current;
    try {
      const dados = await notificacoesCampo<NotificacaoCampo[]>('listar');
      if (consulta === versao.current) { setLista(dados); setErro(''); }
    } catch (falha) {
      if (consulta === versao.current) setErro(mensagemErro(falha));
    }
  }, [habilitado]);
  useEffect(() => {
    if (!habilitado) return;
    const inicial = window.setTimeout(atualizar, 0);
    const intervalo = window.setInterval(() => { if (!document.hidden) void atualizar(); }, 45000);
    window.addEventListener('focus', atualizar);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
      window.removeEventListener('focus', atualizar);
    };
  }, [atualizar, habilitado]);
  return { lista, erro, atualizar };
}

function DadosNotificacao({ item }: { item: NotificacaoCampo }) {
  return <>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <strong>{item.permanente ? 'Permanente' : 'Única'}</strong>
      {item.visaoAdministrativa && <span className="text-xs text-slate-600">Visível à administração</span>}
      {item.nova && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">Nova</span>}
      <time dateTime={item.criadaEm} className="text-slate-600">{new Date(item.criadaEm).toLocaleString('pt-BR')}</time>
    </div>
    <p className="mt-2 text-sm"><strong>De</strong> {item.remetente} · <strong>Para</strong> {item.destinatario}</p>
    <p className="mt-1 text-xs text-slate-600">{item.projetos.map(projeto => projeto.nome).join(', ')}</p>
  </>;
}

function EditorNotificacao({ original, fechar, concluir }: {
  original?: NotificacaoCampo; fechar: () => void; concluir: () => void;
}) {
  const [destinos, setDestinos] = useState<DestinatarioCampo[]>();
  const [destinatario, setDestinatario] = useState(original?.destinatarioId ?? '');
  const [projetos, setProjetos] = useState(original?.projetos.map(projeto => projeto.id) ?? []);
  const [mensagem, setMensagem] = useState(original?.mensagem ?? '');
  const [permanente, setPermanente] = useState(original?.permanente ?? false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    void notificacoesCampo<DestinatarioCampo[]>('destinos', { p_id: original?.id })
      .then(dados => { if (ativo) setDestinos(dados); })
      .catch(falha => { if (ativo) setErro(mensagemErro(falha)); });
    return () => { ativo = false; };
  }, [original?.id]);
  const contaSelecionada = destinos?.find(destino => destino.id === destinatario);
  const opcoes = contaSelecionada?.projetos ?? [];
  const selecionados = opcoes.filter(projeto => projetos.includes(projeto.id));
  return <Janela titulo={original ? 'Editar notificação' : 'Nova Notificação'} fechar={() => { if (!ocupado) fechar(); }}>
    <form className="space-y-4" onSubmit={async evento => {
      evento.preventDefault();
      if (ocupado || !selecionados.length || !mensagem.trim()) return;
      setOcupado(true);
      setErro('');
      try {
        await notificacoesCampo('salvar', {
          p_id: original?.id, p_destinatario: destinatario, p_projetos: selecionados.map(p => p.id),
          p_mensagem: mensagem, p_permanente: permanente,
        });
        concluir();
      } catch (falha) { setErro(mensagemErro(falha)); }
      finally { setOcupado(false); }
    }}>
      {!destinos && !erro && <p role="status" className="text-sm">Carregando destinatários…</p>}
      {destinos?.length === 0 && <p className="text-sm text-slate-600">Nenhuma conta elegível para receber notificações está disponível.</p>}
      <fieldset disabled={ocupado} className="space-y-4">
        <label className="block text-sm font-semibold">Destinatário
          <select required className={campo} value={destinatario} onChange={evento => { setDestinatario(evento.target.value); setProjetos([]); }}>
            <option value="">Selecione um usuário</option>
            {destinos?.map(destino => <option key={destino.id} value={destino.id}>{destino.nome} · {destino.papel === 'admin' ? 'Administrador' : 'Técnico'}</option>)}
          </select>
        </label>
        {contaSelecionada && opcoes.length === 0 && <p className="text-sm text-slate-600">
          {contaSelecionada.papel === 'admin' ? 'Cadastre um projeto ativo para enviar a notificação.' :
            'Este técnico ainda não tem projetos autorizados. Vincule um projeto à conta em Administração de Usuários para poder enviar a notificação.'}
        </p>}
        {opcoes.length > 0 && <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
          <legend className="px-1 font-semibold">Projetos</legend>
          <label className="flex gap-2 font-semibold"><input type="checkbox" checked={selecionados.length === opcoes.length}
            onChange={evento => setProjetos(evento.target.checked ? opcoes.map(projeto => projeto.id) : [])} /> Todos os projetos disponíveis</label>
          <div className="max-h-36 space-y-2 overflow-auto">
            {opcoes.map(projeto => <label className="flex gap-2" key={projeto.id}>
              <input type="checkbox" checked={projetos.includes(projeto.id)} onChange={evento =>
                setProjetos(atuais => evento.target.checked ? [...atuais, projeto.id] : atuais.filter(id => id !== projeto.id))} /> {projeto.nome}
            </label>)}
          </div>
        </fieldset>}
        <label className="block text-sm font-semibold">Tipo
          <select className={campo} value={permanente ? 'permanente' : 'unica'} onChange={evento => setPermanente(evento.target.value === 'permanente')}>
            <option value="unica">Única · próxima visita aplicável</option>
            <option value="permanente">Permanente · todas as visitas aplicáveis</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">Mensagem
          <textarea required rows={4} maxLength={4000} className={campo} value={mensagem} onChange={evento => setMensagem(evento.target.value)} />
        </label>
      </fieldset>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={botao} disabled={ocupado} onClick={fechar}>Cancelar</button>
        <button type="submit" className={principal} disabled={ocupado || !selecionados.length || !mensagem.trim()}>{original ? 'Salvar' : 'Enviar'}</button>
      </div>
    </form>
  </Janela>;
}

export function PainelNotificacoes({ lista, erro, atualizar }: ReturnType<typeof useNotificacoesCampo>) {
  const [edicao, setEdicao] = useState<{ original?: NotificacaoCampo }>();
  const [aberta, setAberta] = useState<NotificacaoCampo>();
  const [exclusao, setExclusao] = useState<NotificacaoCampo>();
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Notificações</h1>
      <button type="button" className={principal} onClick={() => setEdicao({})}><Plus size={16} aria-hidden /> Nova Notificação</button>
    </div>
    {(erro || erroAcao) && <p role="alert" className="text-sm text-red-700">{erro || erroAcao}</p>}
    {!lista && !erro && <p role="status">Carregando notificações…</p>}
    {lista?.length === 0 && <p className="text-sm text-slate-600">Nenhuma notificação disponível.</p>}
    <ul className="space-y-3">{lista?.map(item => <li key={item.id}
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${item.nova ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
      <div className="min-w-0 break-words"><DadosNotificacao item={item} /><p className="mt-2 line-clamp-2 text-sm">{item.mensagem}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={botao} onClick={() => {
          setAberta(item);
          if (item.nova) void notificacoesCampo('ler', { p_id: item.id }).then(atualizar).catch(falha => setErroAcao(mensagemErro(falha)));
        }}>Abrir</button>
        {(item.podeGerenciar ?? item.enviada) && <>
          <button type="button" className={botao} onClick={() => setEdicao({ original: item })}><Pencil size={15} aria-hidden /> Editar</button>
          <button type="button" className={botao} onClick={() => { setErroAcao(''); setExclusao(item); }}><Trash2 size={15} aria-hidden /> Excluir</button>
        </>}
      </div>
    </li>)}</ul>
    {edicao && <EditorNotificacao original={edicao.original} fechar={() => setEdicao(undefined)} concluir={() => { setEdicao(undefined); void atualizar(); }} />}
    {aberta && <Janela titulo="Notificação" fechar={() => setAberta(undefined)}>
      <DadosNotificacao item={aberta} />
      <p className="my-4 whitespace-pre-wrap break-words text-sm">{aberta.mensagem}</p>
      <button type="button" className={botao} onClick={() => setAberta(undefined)}>Fechar</button>
    </Janela>}
    {exclusao && <Janela titulo="Excluir notificação" fechar={() => { if (!ocupado) setExclusao(undefined); }}>
      <p className="mb-4 text-sm">Deseja excluir a notificação enviada a {exclusao.destinatario}?</p>
      {erroAcao && <p role="alert" className="mb-3 text-sm text-red-700">{erroAcao}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={botao} disabled={ocupado} onClick={() => setExclusao(undefined)}>Cancelar</button>
        <button type="button" className={`${botao} text-red-700`} disabled={ocupado} onClick={async () => {
          setOcupado(true);
          try { await notificacoesCampo('excluir', { p_id: exclusao.id }); setExclusao(undefined); await atualizar(); }
          catch (falha) { setErroAcao(mensagemErro(falha)); }
          finally { setOcupado(false); }
        }}>Excluir</button>
      </div>
    </Janela>}
  </section>;
}

export function NotificacoesDaVisita({ visita }: { visita: Visita }) {
  const [lista, setLista] = useState<NotificacaoCampo[]>();
  const [janela, setJanela] = useState<'aviso' | 'lista'>();
  const [erro, setErro] = useState('');
  const abriuManual = useRef(false);

  const consultar = useCallback(() => notificacoesCampo<NotificacaoCampo[]>('visita', { p_visita: visita.id }), [visita.id]);

  useEffect(() => {
    if (visita.status !== 'em_andamento') return;
    let ativo = true;
    void consultar().then(dados => {
      if (!ativo || abriuManual.current) return;
      setLista(dados);
      setErro('');
      if (!dados.length) return;
      const chave = `delta-notificacoes-visita:${visita.id}`;
      try {
        if (sessionStorage.getItem(chave)) return;
        sessionStorage.setItem(chave, '1');
      } catch { /* O aviso também funciona sem acesso ao armazenamento local. */ }
      setJanela('aviso');
    }).catch(falha => { if (ativo) setErro(mensagemErro(falha)); });
    return () => { ativo = false; };
  }, [consultar, visita.id, visita.status]);

  const abrir = (dados?: NotificacaoCampo[]) => {
    abriuManual.current = true;
    setJanela('lista');
    void (async () => {
      try {
        const itens = dados ?? await consultar();
        setLista(itens);
        setErro('');
        await Promise.all(itens.filter(item => item.nova).map(item => notificacoesCampo('ler', { p_id: item.id })));
        setLista(itens.map(item => ({ ...item, nova: false })));
      } catch (falha) { setErro(mensagemErro(falha)); }
    })();
  };

  return <>
    <button type="button" aria-label="Notificações" title="Notificações" onClick={() => abrir()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white">
      <Bell size={15} aria-hidden /> <span className="hidden sm:inline">Notificações</span>
      {lista?.some(item => item.nova) && <span className="h-2 w-2 rounded-full bg-sky-400" />}
    </button>
    {janela === 'aviso' && <Janela titulo="Há uma notificação para este trabalho. Deseja abrir?" fechar={() => setJanela(undefined)}>
      <div className="flex justify-end gap-2">
        <button type="button" className={botao} onClick={() => setJanela(undefined)}>Não</button>
        <button type="button" className={principal} onClick={() => abrir(lista)}>Sim</button>
      </div>
    </Janela>}
    {janela === 'lista' && <Janela titulo="Notificações do trabalho" fechar={() => setJanela(undefined)}>
      {erro && <p role="alert" className="mb-3 text-sm text-red-700">{erro}</p>}
      {!lista && !erro && <p role="status" className="text-sm">Carregando notificações…</p>}
      {lista?.length === 0 && <p className="text-sm text-slate-600">Nenhuma notificação para este trabalho.</p>}
      <ul className="space-y-3">{lista?.map(item => <li key={item.id} className="rounded-xl border border-slate-200 p-3">
        <DadosNotificacao item={item} />
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.mensagem}</p>
      </li>)}</ul>
      <button type="button" className={`${botao} mt-4`} onClick={() => setJanela(undefined)}>Fechar</button>
    </Janela>}
  </>;
}
