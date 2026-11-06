'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  AlertTriangle,
  Eye,
  Trash2,
  Save,
  CheckCircle2,
  MapPin,
  Calendar,
  AlertCircle,
  Maximize2,
  Upload,
} from 'lucide-react';
import {
  TipoRegistro,
  MeioAmbiental,
  GravidadeOcorrencia,
  RegistroCampo,
  Fotografia,
  CoordenadasUTM,
  Visita,
} from '@/types';
import { converterParaUTM } from '@/services/utm';
import { aplicarEstampaFoto } from '@/services/photoStamper';
import { RegistroCampoRepository } from '@/services/storage';

interface FieldRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  visita: Visita;
  capturedLat: number | null;
  capturedLng: number | null;
  capturedAccuracy: number | null;
  onRecordSaved: (registro: RegistroCampo) => void;
}

export function FieldRecordModal({
  isOpen,
  onClose,
  visita,
  capturedLat,
  capturedLng,
  capturedAccuracy,
  onRecordSaved,
}: FieldRecordModalProps) {
  // Campos do formulário
  const [tipo, setTipo] = useState<TipoRegistro>('Observacao');
  const [meio, setMeio] = useState<MeioAmbiental>('Flora');
  const [descricao, setDescricao] = useState('');
  const [gravidade, setGravidade] = useState<GravidadeOcorrencia | ''>('');

  // Fotografias processadas com carimbo Canvas
  const [fotos, setFotos] = useState<Fotografia[]>([]);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);

  // Coordenadas estáveis capturadas no momento da abertura
  const [latEstavel, setLatEstavel] = useState<number | null>(null);
  const [lngEstavel, setLngEstavel] = useState<number | null>(null);
  const [precisaoEstavel, setPrecisaoEstavel] = useState<number | null>(null);
  const [utmEstavel, setUtmEstavel] = useState<CoordenadasUTM | null>(null);
  const [momentoAbertura, setMomentoAbertura] = useState<Date>(new Date());

  // Estados de controle
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fixa as coordenadas na abertura do formulário
  useEffect(() => {
    if (isOpen) {
      const agora = new Date();
      setMomentoAbertura(agora);
      setLatEstavel(capturedLat);
      setLngEstavel(capturedLng);
      setPrecisaoEstavel(capturedAccuracy);

      if (capturedLat !== null && capturedLng !== null) {
        try {
          const utm = converterParaUTM(capturedLat, capturedLng);
          setUtmEstavel(utm);
        } catch (e) {
          console.error('Erro na conversão UTM:', e);
          setUtmEstavel(null);
        }
      } else {
        setUtmEstavel(null);
      }

      // Reset dos campos
      setTipo('Observacao');
      setMeio('Flora');
      setDescricao('');
      setGravidade('');
      setFotos([]);
      setErros({});
      setErroGeral(null);
      setSalvando(false);
    }
  }, [isOpen, capturedLat, capturedLng, capturedAccuracy]);

  // Se mudar o tipo para Observação, limpa gravidade conforme especificação
  const handleTipoChange = (novoTipo: TipoRegistro) => {
    setTipo(novoTipo);
    if (novoTipo === 'Observacao') {
      setGravidade('');
      setErros((prev) => ({ ...prev, gravidade: '' }));
    }
  };

  if (!isOpen) return null;

  // Processamento de fotografia com carimbo indelével Canvas
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (latEstavel === null || lngEstavel === null || !utmEstavel) {
      alert('Aguarde a obtenção das coordenadas GPS antes de fotografar.');
      return;
    }

    try {
      setProcessandoFoto(true);

      const clienteProjetoStr = visita.identificacaoProjeto
        ? `${visita.clienteNome} (${visita.identificacaoProjeto})`
        : visita.clienteNome;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataHoraFoto = new Date();

        // Aplica o carimbo oficial da Delta S Engenharia via Canvas
        const dataUrlEstampada = await aplicarEstampaFoto(file, {
          dataHora: dataHoraFoto,
          clienteProjeto: clienteProjetoStr,
          utm: utmEstavel,
          latitude: latEstavel,
          longitude: lngEstavel,
        });

        const novaFoto: Fotografia = {
          id: `foto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          registroCampoId: '', // será atribuído ao salvar o registro
          visitaId: visita.id,
          dataUrl: dataUrlEstampada,
          capturadaEm: dataHoraFoto.toISOString(),
          utmInfo: utmEstavel.formatado,
          clienteProjetoInfo: clienteProjetoStr,
        };

        setFotos((prev) => [...prev, novaFoto]);
      }
    } catch (err: any) {
      console.error('Erro ao processar imagem no Canvas:', err);
      alert('Falha ao aplicar legenda na fotografia: ' + (err?.message || ''));
    } finally {
      setProcessandoFoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoverFoto = (id: string) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  };

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (!tipo) {
      novosErros.tipo = 'Tipo de registro é obrigatório.';
    }

    if (!meio) {
      novosErros.meio = 'Meio ambiental é obrigatório.';
    }

    if (!descricao.trim()) {
      novosErros.descricao = 'A descrição detalhada da situação observada é obrigatória.';
    }

    // Gravidade é obrigatória APENAS para Ocorrência
    if (tipo === 'Ocorrencia' && !gravidade) {
      novosErros.gravidade = 'Para ocorrências, o nível de gravidade é obrigatório.';
    }

    // Coordenadas válidas são estritamente obrigatórias
    if (latEstavel === null || lngEstavel === null || !utmEstavel) {
      novosErros.coordenadas =
        'Não foi possível obter uma coordenada geográfica válida do GPS. O registro não pode ser salvo com coordenadas fictícias.';
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    if (salvando) return; // Evita duplo clique acidental

    if (!validar()) return;

    try {
      setSalvando(true);

      const agora = new Date().toISOString();
      const registroId = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Atualiza o registroCampoId nas fotos capturadas
      const fotosVinculadas: Fotografia[] = fotos.map((f) => ({
        ...f,
        registroCampoId: registroId,
      }));

      const novoRegistro: RegistroCampo = {
        projetoId: visita.projetoId,
        visitaOrigemIdentificacao: visita.identificacao,
        tecnicoId: visita.executorId,
        tecnicoNome: visita.executorNome,
        ...(tipo === 'Ocorrencia' ? { situacao: 'em_aberto' as const } : {}),
        id: registroId,
        visitaId: visita.id,
        tipo,
        meio,
        descricao: descricao.trim(),
        gravidade: tipo === 'Ocorrencia' && gravidade ? (gravidade as GravidadeOcorrencia) : undefined,
        latitude: latEstavel!,
        longitude: lngEstavel!,
        precisaoMetros: precisaoEstavel ?? undefined,
        utmZona: utmEstavel!.zona,
        utmHemisferio: utmEstavel!.hemisferio,
        utmEasting: utmEstavel!.easting,
        utmNorthing: utmEstavel!.northing,
        referenciaGeodesica: 'WGS84',
        registradoEm: agora,
        fotos: fotosVinculadas,
      };

      await RegistroCampoRepository.salvar(novoRegistro);

      onRecordSaved(novoRegistro);
      onClose();
    } catch (err: any) {
      console.error('Erro ao gravar registro de campo:', err);
      setErroGeral(err?.message || 'Falha ao salvar registro no armazenamento local.');
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">
          {/* Cabeçalho do Modal / Bottom Sheet */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tipo === 'Ocorrencia'
                    ? 'bg-red-50 text-[#E53E3E]'
                    : 'bg-blue-50 text-[#00AFF0]'
                }`}
              >
                {tipo === 'Ocorrencia' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#333436]">
                  Novo Registro de Campo
                </h2>
                <p className="text-xs text-slate-500">
                  {visita.identificacao} • {visita.clienteNome}
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

          {/* Formulário com rolagem própria */}
          <form onSubmit={handleRegistrar} className="p-6 space-y-5 overflow-y-auto flex-1">
            {erroGeral && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{erroGeral}</span>
              </div>
            )}

            {/* Painel de Coordenadas Geográficas e UTM Estáveis */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#00AFF0]" />
                  Posição Estabilizada no Disparo
                </span>
                <span>{momentoAbertura.toLocaleTimeString('pt-BR')}</span>
              </div>

              {utmEstavel ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      UTM (WGS84)
                    </span>
                    <span className="font-bold text-[#333436]">
                      Zona {utmEstavel.zona}{utmEstavel.hemisferio}
                    </span>{' '}
                    • E: {utmEstavel.easting.toLocaleString('pt-BR')} m | N:{' '}
                    {utmEstavel.northing.toLocaleString('pt-BR')} m
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Latitude / Longitude (Precisão)
                    </span>
                    <span>
                      {latEstavel?.toFixed(6)}°, {lngEstavel?.toFixed(6)}°
                    </span>
                    {precisaoEstavel !== null && (
                      <span className="text-slate-500 ml-1">
                        (±{Math.round(precisaoEstavel)}m)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-1 space-y-2">
                  <div className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold">Sinal de GPS não detectado neste dispositivo.</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Em computadores de mesa sem antena GPS, você pode carregar as coordenadas cartográficas da usina para teste:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const demoLat = -25.4284;
                          const demoLng = -49.2733;
                          setLatEstavel(demoLat);
                          setLngEstavel(demoLng);
                          setPrecisaoEstavel(6.0);
                          setUtmEstavel(converterParaUTM(demoLat, demoLng));
                          setErros((prev) => ({ ...prev, coordenadas: '' }));
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00AFF0] text-white rounded-lg text-xs font-bold hover:bg-[#0098d1] transition-colors shadow-xs"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Carregar Coordenadas da Usina (CGH PR)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {erros.coordenadas && (
                <p className="text-xs text-red-500 font-medium">{erros.coordenadas}</p>
              )}
            </div>

            {/* 15.1. Tipo (Observação / Ocorrência) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tipo de Registro *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTipoChange('Observacao')}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    tipo === 'Observacao'
                      ? 'border-[#00AFF0] bg-blue-50 text-[#00AFF0] shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Observação</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTipoChange('Ocorrencia')}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    tipo === 'Ocorrencia'
                      ? 'border-[#E53E3E] bg-red-50 text-[#E53E3E] shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Ocorrência</span>
                </button>
              </div>
            </div>

            {/* 15.2. Meio (Fauna, Físico, Flora, Social) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Meio Ambiental *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Flora', 'Fauna', 'Físico', 'Social'] as MeioAmbiental[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMeio(m)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                      meio === m
                        ? 'border-[#A3CA33] bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 15.4. Gravidade (Condicional: apenas quando Ocorrência) */}
            {tipo === 'Ocorrencia' && (
              <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl animate-fade-in">
                <label className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-2">
                  Gravidade da Ocorrência *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Leve', 'Grave', 'Gravíssima'] as GravidadeOcorrencia[]).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => {
                        setGravidade(g);
                        if (erros.gravidade) setErros((prev) => ({ ...prev, gravidade: '' }));
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        gravidade === g
                          ? 'border-[#E53E3E] bg-[#E53E3E] text-white shadow-xs'
                          : 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {erros.gravidade && (
                  <p className="mt-2 text-xs text-red-600 font-medium">{erros.gravidade}</p>
                )}
              </div>
            )}

            {/* 15.3. Descrição */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Descrição Detalhada do Registro *
              </label>
              <textarea
                rows={4}
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value);
                  if (erros.descricao) setErros((prev) => ({ ...prev, descricao: '' }));
                }}
                placeholder="Descreva minuciosamente a condição identificada em campo (ex: presença de espécie exótica invasora na margem direita do reservatório, evidência de erosão no talude, etc.)..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                  erros.descricao
                    ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                }`}
              />
              {erros.descricao && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.descricao}</p>
              )}
            </div>

            {/* 17 & 18. Fotografias com Carimbo Automático Canvas */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fotografias Georreferenciadas{' '}
                  <span className="text-slate-400 font-normal">(Com estampa oficial UTM)</span>
                </label>
                <span className="text-xs text-slate-500">{fotos.length} foto(s)</span>
              </div>

              {/* Botão de Captura / Upload */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processandoFoto}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-[#333436] transition-colors active:scale-95 border border-slate-200"
                >
                  <Camera className="w-4 h-4 text-[#00AFF0]" />
                  <span>{processandoFoto ? 'Aplicando Legenda Canvas...' : 'Tirar Fotografia / Anexar'}</span>
                </button>
              </div>

              {/* Miniaturas das fotos estampadas */}
              {fotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {fotos.map((foto, index) => (
                    <div
                      key={foto.id}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black shadow-xs"
                    >
                      <img
                        src={foto.dataUrl}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Overlay de Ações */}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFotoVisualizando(foto.dataUrl)}
                          className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white hover:text-[#00AFF0]"
                          title="Ampliar fotografia"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoverFoto(foto.id)}
                          className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600"
                          title="Remover fotografia"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
                        Foto {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 19. Botão Registrar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 disabled:opacity-70"
              >
                <Save className="w-4 h-4" />
                <span>{salvando ? 'Gravando Registro...' : 'Registrar'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Visualizador Lightbox de Foto Ampliada */}
      {fotoVisualizando && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={() => setFotoVisualizando(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setFotoVisualizando(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fotoVisualizando}
              alt="Fotografia com estampa Delta S"
              className="max-h-[85vh] w-auto rounded-lg shadow-2xl object-contain border border-slate-700"
            />
          </div>
        </div>
      )}
    </>
  );
}
