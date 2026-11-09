'use client';

import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import React from 'react';
import {
  X,
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Calendar,
} from 'lucide-react';
import { Cliente } from '@/types';

interface ClientDetailsModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (cliente: Cliente) => void;
  onEdit?: (cliente: Cliente) => void;
}

export function ClientDetailsModal({
  cliente,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ClientDetailsModalProps) {
  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00AFF0] flex items-center justify-center">
              {cliente.tipoPessoa === 'PF' ? (
                <User className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {cliente.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </span>
              <h2 className="text-lg font-bold text-[#333436] line-clamp-1">
                {cliente.nomeRazaoSocial}
              </h2>
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

        {/* Conteúdo */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
            <div>
              <span className="text-xs text-slate-500 font-medium">
                {cliente.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
              </span>
              <p className="text-sm font-semibold text-[#333436] font-mono">
                {cliente.cpfCnpj}
              </p>
            </div>
            {cliente.inscricaoEstadual && (
              <div>
                <span className="text-xs text-slate-500 font-medium">
                  Inscrição Estadual
                </span>
                <p className="text-sm font-semibold text-[#333436]">
                  {cliente.inscricaoEstadual}
                </p>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-500 font-medium">Cadastrado em</span>
              <p className="text-sm text-slate-700 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(cliente.criadoEm).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Última Atualização</span>
              <p className="text-sm text-slate-700">
                {new Date(cliente.atualizadoEm).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#00AFF0]" />
              Endereço
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-1">
              <p className="font-semibold text-slate-800">
                {cliente.logradouro ? `${cliente.logradouro}, ${cliente.numero || 'S/N'}` : 'Endereço não informado'}
                {cliente.complemento && ` - ${cliente.complemento}`}
              </p>
              <p className="text-slate-600">
                {cliente.bairro && `${cliente.bairro} — `}
                {cliente.cidade} / {cliente.estado}
              </p>
              {cliente.cep && (
                <p className="text-slate-500 font-mono text-xs">CEP: {cliente.cep}</p>
              )}
            </div>
          </div>

          {/* Contato & Responsável */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#A3CA33]" />
              Responsável & Contato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-xs text-slate-500">Ponto Focal / Responsável</span>
                <p className="text-sm font-bold text-[#333436] mt-0.5">
                  {cliente.responsavel}
                </p>
                <p className="text-xs text-slate-600">{cliente.cargo}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="font-mono">{cliente.telefone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          {onDelete && <BotaoAcaoCadastro acao="excluir" rotulo="Excluir cliente" onClick={() => onDelete(cliente)} />}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Fechar
          </button>
          {onEdit && <BotaoAcaoCadastro acao="editar" rotulo="Editar cliente" onClick={() => {
              onClose();
              onEdit(cliente);
            }} />}
        </div>
      </div>
    </div>
  );
}
