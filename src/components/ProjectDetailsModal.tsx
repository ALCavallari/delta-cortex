'use client';

import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { ProjectLocationLink } from './ProjectLocationLink';
import {
  X,
  FolderKanban,
  Building2,
  Calendar,
  FileText,
} from 'lucide-react';
import { Projeto, Cliente } from '@/types';

interface ProjectDetailsModalProps {
  projeto: Projeto | null;
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (projeto: Projeto) => void;
  onEdit?: (projeto: Projeto) => void;
}

export function ProjectDetailsModal({
  projeto,
  cliente,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ProjectDetailsModalProps) {
  if (!isOpen || !projeto) return null;

  const formatarDataBR = (dataStr?: string) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00AFF0] flex items-center justify-center">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#333436]">
                Detalhes do Projeto
              </h2>
              <p className="text-xs text-slate-500">
                Informações cadastrais do projeto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Nome do Projeto */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Nome do Projeto / Empreendimento
            </span>
            <h3 className="text-xl font-bold text-[#333436]">
              {projeto.nome}
            </h3>
          </div>

          {/* Cliente Contratante */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#00AFF0]" />
              Cliente Contratante Vinculado
            </span>
            {cliente ? (
              <div className="space-y-1">
                <p className="font-bold text-[#333436] text-base">
                  {cliente.nomeRazaoSocial}
                </p>
                <p className="text-xs text-slate-500">
                  {cliente.cpfCnpj} • {cliente.cidade}/{cliente.estado}
                </p>
                {cliente.responsavel && (
                  <p className="text-xs text-slate-500">
                    Responsável: {cliente.responsavel} {cliente.cargo ? `(${cliente.cargo})` : ''}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">
                Cliente ID: {projeto.clienteId} (Cadastro não localizado)
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Descrição do Empreendimento e Escopo
            </span>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
              {projeto.descricao || 'Nenhuma descrição detalhada informada.'}
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="font-bold text-[#333436]">Localização do Projeto</h3>
            {projeto.localizacao ? <div className="text-xs text-slate-600 space-y-1">
              <p>E: {projeto.localizacao.easting.toLocaleString('pt-BR')} m • N: {projeto.localizacao.northing.toLocaleString('pt-BR')} m</p>
              <p>Fuso {projeto.localizacao.zona} • {projeto.localizacao.hemisferio === 'S' ? 'Sul' : 'Norte'} • {projeto.localizacao.datum}</p>
              <p>Latitude: {projeto.localizacao.latitude.toFixed(7)} • Longitude: {projeto.localizacao.longitude.toFixed(7)}</p>
            </div> : <p className="text-xs text-slate-500">Coordenadas não cadastradas.</p>}
            <ProjectLocationLink localizacao={projeto.localizacao} linkOriginal={projeto.linkGoogleMapsOriginal} />
          </section>
          {/* Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Cadastrado em: <strong>{formatarDataBR(projeto.criadoEm)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {projeto.prazo
                ? <span>Prazo: <strong>{projeto.prazo.split('-').reverse().join('/')}</strong></span>
                : <span>Última atualização: <strong>{formatarDataBR(projeto.atualizadoEm)}</strong></span>}
            </div>
          </div>

        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0 flex flex-wrap items-center justify-between gap-2">
          {onDelete && <BotaoAcaoCadastro acao="excluir" rotulo="Excluir projeto" onClick={() => onDelete(projeto)} />}
          {onEdit ? (
            <BotaoAcaoCadastro acao="editar" rotulo="Editar projeto" onClick={() => {
                onClose();
                onEdit(projeto);
              }} />
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
