'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { lerLinkGoogleMaps } from '@/services/googleMaps';
import { ProjectGeographicFiles, type ArquivosGeograficosDraft } from './ProjectGeographicFiles';
import { ProjectLocationFields, locationDraft, resolveLocation } from './ProjectLocationFields';
import {
  X,
  FolderKanban,
  Building2,
  Search,
  AlertCircle,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Projeto, Cliente } from '@/types';
import { ProjetoRepository, VisitaRepository } from '@/services/storage';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Projeto | null;
  clientes: Cliente[];
  onProjectSaved: (projeto: Projeto) => void;
}

export function ProjectModal({
  isOpen,
  onClose,
  projectToEdit,
  clientes,
  onProjectSaved,
}: ProjectModalProps) {
  const [clienteId, setClienteId] = useState('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [linkMaps, setLinkMaps] = useState('');
  const arquivosGeograficos = useRef<ArquivosGeograficosDraft>(null);
  const [localizacao, setLocalizacao] = useState(() => locationDraft());

  // Estados de controle
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Confirmação para alteração de cliente com visitas existentes
  const [confirmacaoClienteAberta, setConfirmacaoClienteAberta] = useState(false);
  const [qtdVisitasVinculadas, setQtdVisitasVinculadas] = useState(0);

  const isEdit = !!projectToEdit;

  useEffect(() => {
    if (!isOpen) return;

    if (projectToEdit) {
      setClienteId(projectToEdit.clienteId);
      setNome(projectToEdit.nome);
      setDescricao(projectToEdit.descricao || '');
      setBuscaCliente('');
    } else {
      setClienteId(clientes.length > 0 ? clientes[0].id : '');
      setNome('');
      setDescricao('');
      setBuscaCliente('');
    }

    setPrazo(projectToEdit?.prazo ?? '');
    setLinkMaps(projectToEdit?.linkGoogleMapsOriginal ?? '');
    setLocalizacao(locationDraft(projectToEdit?.localizacao));
    setErros({});
    setErroGeral(null);
    setConfirmacaoClienteAberta(false);
  }, [isOpen, projectToEdit, clientes]);

  // Clientes filtrados na busca
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes;
    const termo = buscaCliente.toLowerCase().trim();
    return clientes.filter(
      (c) =>
        c.nomeRazaoSocial.toLowerCase().includes(termo) ||
        c.cpfCnpj.includes(termo) ||
        c.cidade.toLowerCase().includes(termo)
    );
  }, [clientes, buscaCliente]);

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.id === clienteId);
  }, [clientes, clienteId]);

  if (!isOpen) return null;

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (!clienteId || (!clienteSelecionado && clienteId !== projectToEdit?.clienteId)) {
      novosErros.clienteId = 'Selecione um cliente contratante disponível no cadastro local.';
    }

    if (!nome.trim()) {
      novosErros.nome = 'O nome do projeto é obrigatório.';
    }

    try { resolveLocation(localizacao); } catch (e) { novosErros.localizacao = (e as Error).message; }
    if (linkMaps.trim() && !lerLinkGoogleMaps(linkMaps)) novosErros.linkMaps = 'Informe um link HTTPS válido do Google Maps ou deixe o campo vazio.';
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const executarSalvar = async () => {
    try {
      setSalvando(true);
      const agora = new Date().toISOString();

      const projetoSalvo: Projeto = {
        id: projectToEdit ? projectToEdit.id : `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...projectToEdit,
        localizacao: resolveLocation(localizacao),
        prazo: prazo || null,
        linkGoogleMapsOriginal: linkMaps.trim() || undefined,
        clienteId,
        nome: nome.trim(),
        descricao: descricao.trim(),
        criadoEm: projectToEdit ? projectToEdit.criadoEm : agora,
        atualizadoEm: agora,
      };

      await ProjetoRepository.salvar(projetoSalvo, arquivosGeograficos.current?.alteracoes());
      onProjectSaved(projetoSalvo);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar projeto:', err);
      setErroGeral(err?.message || 'Falha ao salvar projeto no armazenamento local.');
    } finally {
      setSalvando(false);
      setConfirmacaoClienteAberta(false);
    }
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    if (!validar()) return;

    // Se estiver editando e o clienteId tiver sido alterado, verificar visitas existentes
    if (isEdit && projectToEdit && projectToEdit.clienteId !== clienteId) {
      try {
        const qtd = await VisitaRepository.contarPorProjeto(projectToEdit.id);
        if (qtd > 0) {
          setQtdVisitasVinculadas(qtd);
          setConfirmacaoClienteAberta(true);
          return;
        }
      } catch (err) {
        console.error('Erro ao verificar visitas vinculadas:', err);
      }
    }

    await executarSalvar();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
        <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-y-auto">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00AFF0] flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#333436]">
                  {isEdit ? 'Editar Projeto' : 'Novo Projeto'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isEdit
                    ? 'Altere as informações do empreendimento'
                    : 'Cadastre um novo empreendimento e vincule-o ao cliente contratante'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmeter} className="p-6 space-y-5">
            {erroGeral && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erroGeral}</span>
              </div>
            )}

            {/* CAMPO 1: Cliente Contratante (Obrigatório e pesquisável) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cliente Contratante *
              </label>

              {clientes.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Nenhum cliente disponível no cadastro local</span>
                  </div>
                  <p>
                    {projectToEdit?.clienteId
                      ? 'O vínculo histórico será mantido. Novos vínculos dependem de um cliente disponível localmente.'
                      : 'Projetos ainda usa o cadastro local. Clientes cadastrados no Supabase ficam disponíveis para novos vínculos após a migração de Projetos.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Busca rápida de cliente se houver muitos */}
                  {clientes.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={buscaCliente}
                        onChange={(e) => setBuscaCliente(e.target.value)}
                        placeholder="Filtrar cliente por nome, CNPJ ou cidade..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#00AFF0] bg-slate-50"
                      />
                    </div>
                  )}

                  <select
                    value={clienteId}
                    onChange={(e) => {
                      setClienteId(e.target.value);
                      if (erros.clienteId) setErros((prev) => ({ ...prev, clienteId: '' }));
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 bg-white transition-all ${
                      erros.clienteId
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                    }`}
                  >
                    <option value="">Selecione um cliente contratante...</option>
                    {projectToEdit?.clienteId && !clientes.some((c) => c.id === projectToEdit.clienteId) && (
                      <option value={projectToEdit.clienteId}>Manter vínculo histórico (cliente indisponível localmente)</option>
                    )}
                    {clientesFiltrados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeRazaoSocial} ({c.cpfCnpj}) — {c.cidade}/{c.estado}
                      </option>
                    ))}
                  </select>

                  {clienteSelecionado && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#00AFF0] shrink-0" />
                      <span>
                        Contratante selecionado: <strong>{clienteSelecionado.nomeRazaoSocial}</strong> ({clienteSelecionado.cidade}/{clienteSelecionado.estado})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {erros.clienteId && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.clienteId}</p>
              )}
            </div>

            {/* CAMPO 2: Nome do Projeto (Texto de 1 linha, obrigatório) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome do Projeto / Empreendimento *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (erros.nome) setErros((prev) => ({ ...prev, nome: '' }));
                }}
                placeholder="Ex: CGH Rio das Pedras — Barramento e Vertedouro"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 bg-white transition-all ${
                  erros.nome
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                }`}
              />
              {erros.nome && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.nome}</p>
              )}
            </div>

            {/* CAMPO 3: Descrição (Texto com múltiplas linhas) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Descrição do Projeto e Escopo
              </label>
              <textarea
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhe o escopo do projeto, localização, especificações técnicas, fases de licenciamento ambiental, condicionantes de operação ou outras informações relevantes..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white transition-all resize-y placeholder:text-slate-400"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Permite descrições técnicas extensas.
              </p>
            </div>

            <label className="block max-w-xs text-xs font-bold text-slate-700">
              Prazo <span className="font-normal text-slate-500">(opcional)</span>
              <input type="date" lang="pt-BR" min="0001-01-01" max="9999-12-31" value={prazo} onChange={e => setPrazo(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white" />
              <span className="mt-1 block font-normal text-slate-500">{prazo ? prazo.split('-').reverse().join('/') : 'DD/MM/AAAA'}</span>
            </label>
            <ProjectLocationFields value={localizacao} onChange={setLocalizacao} link={linkMaps}
              onLinkChange={link => { setLinkMaps(link); setErros(prev => ({ ...prev, linkMaps: '' })); }} />
            {erros.linkMaps && <p role="alert" className="text-xs text-red-600">{erros.linkMaps}</p>}
            {erros.localizacao && <p role="alert" className="text-xs text-red-600">{erros.localizacao}</p>}
            <ProjectGeographicFiles ref={arquivosGeograficos} key={projectToEdit?.id ?? 'novo'}
              projetoId={projectToEdit?.id} desabilitado={salvando} />
            {/* Botões do Rodapé */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || (clientes.length === 0 && !projectToEdit?.clienteId)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{salvando ? 'Salvando...' : 'Salvar Projeto'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmação específica para alteração de cliente de projeto com visitas */}
      {confirmacaoClienteAberta && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#333436] mb-2">
              Alterar Cliente Contratante
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Este projeto possui <strong>{qtdVisitasVinculadas} visita(s)</strong> vinculada(s). Ao alterar o cliente contratante, o vínculo com as visitas será mantido com este projeto e nenhum registro será perdido.
              <br /><br />
              Deseja realmente prosseguir com a alteração do cliente?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmacaoClienteAberta(false)}
                disabled={salvando}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarSalvar}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.98] text-sm font-semibold text-white transition-all shadow-md shadow-blue-400/20 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
