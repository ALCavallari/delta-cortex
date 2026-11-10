'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Eye,
  MapPin,
  Calendar,
  Clock,
  Maximize2,
  FileText,
  Camera,
  Trash2,
  Pencil,
} from 'lucide-react';
import { RegistroCampo } from '@/types';

interface MarkerDetailsModalProps {
  registro: RegistroCampo | null;
  isOpen: boolean;
  onClose: () => void;
  visitaAtualId?: string;
  readOnly?: boolean;
  onResolver?: (id: string) => void;
  onEdit?: (registro: RegistroCampo) => void;
  onDelete?: (id: string) => Promise<void> | void;
}

export function MarkerDetailsModal({
  registro,
  isOpen,
  onClose,
  onDelete,
  onEdit,
  visitaAtualId,
  readOnly = false,
  onResolver,
}: MarkerDetailsModalProps) {
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  if (!isOpen || !registro) return null;

  const isOcorrencia = registro.tipo === 'Ocorrencia';
  const temUtm = Number.isFinite(registro.utmEasting) && Number.isFinite(registro.utmNorthing) &&
    Number.isInteger(registro.utmZona) && (registro.utmHemisferio === 'N' || registro.utmHemisferio === 'S');
  const temGps = Number.isFinite(registro.latitude) && Number.isFinite(registro.longitude) &&
    Math.abs(registro.latitude) <= 90 && Math.abs(registro.longitude) <= 180;

  const handleConfirmarExclusao = async () => {
    if (!onDelete) return;
    try {
      setExcluindo(true);
      await onDelete(registro.id);
      setConfirmandoExclusao(false);
      onClose();
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
        <div className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col my-auto">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isOcorrencia
                    ? 'bg-red-50 text-[#E53E3E]'
                    : 'bg-blue-50 text-[#00AFF0]'
                }`}
              >
                {isOcorrencia ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isOcorrencia
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {registro.tipo}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Meio {registro.meio}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registrado em {new Date(registro.registradoEm).toLocaleString('pt-BR')}
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
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
            {/* Gravidade se for Ocorrência */}
            {isOcorrencia && registro.gravidade && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-bold text-red-800">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#E53E3E]" />
                  Classificação de Gravidade:
                </span>
                <span className="uppercase px-2.5 py-1 rounded-lg bg-red-600 text-white">
                  {registro.gravidade}
                </span>
              </div>
            )}

            {/* Descrição */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Descrição da Condição Observada
              </h4>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                {registro.descricao}
              </div>
            </div>

            {/* Coordenadas e Dados Geográficos */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#00AFF0]" />
                Coordenadas Cartográficas
              </h4>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 font-mono text-xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-sans">Sistema UTM{registro.referenciaGeodesica ? ` (${registro.referenciaGeodesica})` : ''}:</span>
                  <span className="font-bold text-[#333436]">
                    {temUtm ? `Zona ${registro.utmZona}${registro.utmHemisferio} • E: ${registro.utmEasting.toLocaleString('pt-BR')} m | N: ${registro.utmNorthing.toLocaleString('pt-BR')} m` : 'Não disponível'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 font-sans">Graus Decimais (GPS):</span>
                  <span>
                    {temGps ? `Lat: ${registro.latitude.toFixed(6)}° | Long: ${registro.longitude.toFixed(6)}°` : 'Não disponível'}
                    {temGps && registro.precisaoMetros !== undefined && (
                      <span className="text-slate-500 font-sans ml-1">
                        (±{Math.round(registro.precisaoMetros)}m)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Fotografias Anexadas */}
            {registro.fotos && registro.fotos.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#A3CA33]" />
                  Fotografias Registradas ({registro.fotos.length})
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {registro.fotos.map((foto, idx) => (
                    <div
                      key={foto.id || idx}
                      onClick={() => setFotoExpandida(foto.dataUrl)}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black cursor-pointer shadow-xs hover:border-[#00AFF0]"
                    >
                      <img
                        src={foto.dataUrl}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                      <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white/90 bg-black/70 px-1.5 py-0.5 rounded">
                        Ampliar
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <section className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
              {!readOnly && <p className="font-bold">{registro.visitaId === visitaAtualId ? 'Registrado nesta visita' : 'Registro de visita anterior'}</p>}
              <p>Visita de origem: {registro.visitaOrigemIdentificacao ?? registro.visitaId}</p>
              <p>{registro.tecnicoNome ? `Técnico responsável pelo registro: ${registro.tecnicoNome}` : 'Técnico responsável não identificado'}</p>
              {isOcorrencia && <>
                <p>Situação atual: {registro.situacao === 'resolvido' ? 'Resolvido' : 'Em aberto'}</p>
                {registro.eventos?.map((evento, i) => <p key={i}>
                  {evento.situacao === 'resolvido' ? 'Resolução' : 'Reabertura'}: {new Date(evento.data).toLocaleString('pt-BR')}
                  {evento.profissionalNome && ` • ${evento.profissionalNome}`}
                </p>)}
              </>}
            </section>
          </div>

          {/* Rodapé com Ações */}
          <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0 flex flex-wrap items-center justify-between gap-3">
            {!readOnly && onEdit && !registro.deletedAt &&
              <button type="button" onClick={() => onEdit(registro)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/60">
                <Pencil className="h-4 w-4" />
                Editar Registro
              </button>}
            {!readOnly && isOcorrencia && onResolver && registro.situacao !== 'resolvido' && !registro.deletedAt &&
              <button type="button" className="rounded-xl bg-[#A3CA33] px-3 py-2 text-sm font-semibold text-[#333436]"
                onClick={() => { if (window.confirm('Marcar este registro como resolvido?')) onResolver(registro.id); }}>
                Marcar como Resolvido
              </button>}
            {!readOnly && onDelete ? (
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Registro</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {!readOnly && confirmandoExclusao && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#333436] mb-2">
              Excluir {registro.tipo}
            </h3>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Deseja realmente excluir esta observação ou ocorrência?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={excluindo}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-sm font-semibold text-white transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para imagem ampliada */}
      {fotoExpandida && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={() => setFotoExpandida(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setFotoExpandida(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fotoExpandida}
              alt="Fotografia com estampa Delta S"
              className="max-h-[85vh] w-auto rounded-lg shadow-2xl object-contain border border-slate-700"
            />
          </div>
        </div>
      )}
    </>
  );
}
