'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Building2,
  AlertCircle,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Cliente, TipoPessoa } from '@/types';
import {
  UFS_BRASIL,
  validarCPF,
  validarCNPJ,
  validarEmail,
  formatarCPF,
  formatarCNPJ,
  formatarCEP,
  formatarTelefone,
  limparCaracteres,
} from '@/services/validation';
import { ClienteRepository } from '@/services/storage';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (cliente: Cliente) => void;
  clienteParaEdicao?: Cliente | null;
}

export function ClientModal({
  isOpen,
  onClose,
  onSaved,
  clienteParaEdicao,
}: ClientModalProps) {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>('PJ');
  const [nomeRazaoSocial, setNomeRazaoSocial] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('PR');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [cargo, setCargo] = useState('');

  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Preenche dados se for edição
  useEffect(() => {
    if (clienteParaEdicao) {
      setTipoPessoa(clienteParaEdicao.tipoPessoa);
      setNomeRazaoSocial(clienteParaEdicao.nomeRazaoSocial);
      setCpfCnpj(clienteParaEdicao.cpfCnpj);
      setCep(clienteParaEdicao.cep);
      setLogradouro(clienteParaEdicao.logradouro);
      setNumero(clienteParaEdicao.numero);
      setComplemento(clienteParaEdicao.complemento || '');
      setBairro(clienteParaEdicao.bairro);
      setCidade(clienteParaEdicao.cidade);
      setEstado(clienteParaEdicao.estado);
      setInscricaoEstadual(clienteParaEdicao.inscricaoEstadual || '');
      setTelefone(clienteParaEdicao.telefone);
      setEmail(clienteParaEdicao.email);
      setResponsavel(clienteParaEdicao.responsavel);
      setCargo(clienteParaEdicao.cargo);
    } else {
      // Reset para novo cadastro
      setTipoPessoa('PJ');
      setNomeRazaoSocial('');
      setCpfCnpj('');
      setCep('');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidade('');
      setEstado('PR');
      setInscricaoEstadual('');
      setTelefone('');
      setEmail('');
      setResponsavel('');
      setCargo('');
    }
    setErros({});
    setErroGeral(null);
  }, [clienteParaEdicao, isOpen]);

  if (!isOpen) return null;

  const handleTipoChange = (novoTipo: TipoPessoa) => {
    setTipoPessoa(novoTipo);
    setCpfCnpj('');
    setErros((prev) => ({ ...prev, cpfCnpj: '' }));
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const formatado = tipoPessoa === 'PF' ? formatarCPF(val) : formatarCNPJ(val);
    setCpfCnpj(formatado);
    if (erros.cpfCnpj) setErros((prev) => ({ ...prev, cpfCnpj: '' }));
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCep(formatarCEP(e.target.value));
    if (erros.cep) setErros((prev) => ({ ...prev, cep: '' }));
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatarTelefone(e.target.value));
    if (erros.telefone) setErros((prev) => ({ ...prev, telefone: '' }));
  };

  const validarFormulario = async (): Promise<boolean> => {
    const novosErros: Record<string, string> = {};

    if (!nomeRazaoSocial.trim()) {
      novosErros.nomeRazaoSocial =
        tipoPessoa === 'PF'
          ? 'Nome completo é obrigatório.'
          : 'Razão social é obrigatória.';
    }

    if (!cpfCnpj.trim()) {
      novosErros.cpfCnpj =
        tipoPessoa === 'PF' ? 'CPF é obrigatório.' : 'CNPJ é obrigatório.';
    } else {
      if (tipoPessoa === 'PF' && !validarCPF(cpfCnpj)) {
        novosErros.cpfCnpj = 'CPF inválido. Verifique os dígitos.';
      } else if (tipoPessoa === 'PJ' && !validarCNPJ(cpfCnpj)) {
        novosErros.cpfCnpj = 'CNPJ inválido. Verifique os dígitos.';
      }
    }

    // Verificar duplicidade de CPF/CNPJ
    const clienteExistente = await ClienteRepository.buscarPorCpfCnpj(cpfCnpj);
    if (clienteExistente && clienteExistente.id !== clienteParaEdicao?.id) {
      novosErros.cpfCnpj = `Já existe um cliente cadastrado com este ${
        tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'
      } (${clienteExistente.nomeRazaoSocial}).`;
    }

    if (!cidade.trim()) {
      novosErros.cidade = 'Cidade é obrigatória.';
    }

    if (!estado) {
      novosErros.estado = 'Estado é obrigatório.';
    }

    if (!telefone.trim()) {
      novosErros.telefone = 'Telefone de contato é obrigatório.';
    } else if (limparCaracteres(telefone).length < 10) {
      novosErros.telefone = 'Telefone deve ter DDD e pelo menos 8 dígitos.';
    }

    if (!email.trim()) {
      novosErros.email = 'E-mail é obrigatório.';
    } else if (!validarEmail(email)) {
      novosErros.email = 'Formato de e-mail inválido.';
    }

    if (!responsavel.trim()) {
      novosErros.responsavel = 'Nome do responsável / contato é obrigatório.';
    }

    if (!cargo.trim()) {
      novosErros.cargo = 'Função / Cargo do responsável é obrigatório.';
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    try {
      setSalvando(true);
      const valido = await validarFormulario();
      if (!valido) {
        setSalvando(false);
        return;
      }

      const agora = new Date().toISOString();
      const clienteSalvar: Cliente = {
        id: clienteParaEdicao ? clienteParaEdicao.id : `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tipoPessoa,
        nomeRazaoSocial: nomeRazaoSocial.trim(),
        cpfCnpj: cpfCnpj.trim(),
        cep: cep.trim(),
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado,
        inscricaoEstadual: inscricaoEstadual.trim() || undefined,
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
        responsavel: responsavel.trim(),
        cargo: cargo.trim(),
        criadoEm: clienteParaEdicao ? clienteParaEdicao.criadoEm : agora,
        atualizadoEm: agora,
      };

      await ClienteRepository.salvar(clienteSalvar);
      onSaved(clienteSalvar);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      setErroGeral(err?.message || 'Ocorreu um erro ao gravar o cliente no armazenamento local.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00AFF0] flex items-center justify-center">
              {tipoPessoa === 'PF' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#333436]">
                {clienteParaEdicao ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <p className="text-xs text-slate-500">
                {clienteParaEdicao
                  ? 'Atualize as informações cadastrais do cliente'
                  : 'Preencha os dados cadastrais do cliente ou empreendedor'}
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {erroGeral && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{erroGeral}</span>
            </div>
          )}

          {/* Seletor de Tipo de Pessoa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo de Pessoa *
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => handleTipoChange('PJ')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  tipoPessoa === 'PJ'
                    ? 'border-[#00AFF0] bg-blue-50 text-[#00AFF0] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Pessoa Jurídica</span>
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange('PF')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  tipoPessoa === 'PF'
                    ? 'border-[#00AFF0] bg-blue-50 text-[#00AFF0] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Pessoa Física</span>
              </button>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tipoPessoa === 'PF' ? 'Nome Completo *' : 'Razão Social *'}
              </label>
              <input
                type="text"
                value={nomeRazaoSocial}
                onChange={(e) => {
                  setNomeRazaoSocial(e.target.value);
                  if (erros.nomeRazaoSocial) setErros((prev) => ({ ...prev, nomeRazaoSocial: '' }));
                }}
                placeholder={
                  tipoPessoa === 'PF'
                    ? 'Ex: João da Silva Santos'
                    : 'Ex: Hidroelétrica Rio Claro S.A.'
                }
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                  erros.nomeRazaoSocial
                    ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                }`}
              />
              {erros.nomeRazaoSocial && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.nomeRazaoSocial}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tipoPessoa === 'PF' ? 'CPF *' : 'CNPJ *'}
              </label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={handleCpfCnpjChange}
                placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                maxLength={tipoPessoa === 'PF' ? 14 : 18}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono focus:outline-hidden focus:ring-2 transition-all ${
                  erros.cpfCnpj
                    ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                }`}
              />
              {erros.cpfCnpj && (
                <p className="mt-1 text-xs text-red-500 font-medium">{erros.cpfCnpj}</p>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Endereço e Localização
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CEP <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logradouro / Rua <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Ex: Av. Brasil ou Rodovia PR-445, Km 12"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 120 ou S/N"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complemento <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Ex: Sala 402, Bloco A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bairro <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Ex: Zona Industrial"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => {
                    setCidade(e.target.value);
                    if (erros.cidade) setErros((prev) => ({ ...prev, cidade: '' }));
                  }}
                  placeholder="Ex: Curitiba"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                    erros.cidade
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                  }`}
                />
                {erros.cidade && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{erros.cidade}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado (UF) *
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  {UFS_BRASIL.map((uf) => (
                    <option key={uf.sigla} value={uf.sigla}>
                      {uf.sigla} - {uf.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Inscrição Estadual (Apenas PJ) e Contato */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Contato e Responsável
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {tipoPessoa === 'PJ' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inscrição Estadual <span className="text-slate-400 font-normal">(Se houver)</span>
                  </label>
                  <input
                    type="text"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                    placeholder="Ex: Isento ou 123.456.789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              <div className={tipoPessoa === 'PF' ? 'sm:col-span-1' : ''}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone de Contato *
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={handleTelefoneChange}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono focus:outline-hidden focus:ring-2 transition-all ${
                    erros.telefone
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                  }`}
                />
                {erros.telefone && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{erros.telefone}</p>
                )}
              </div>

              <div className={tipoPessoa === 'PF' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (erros.email) setErros((prev) => ({ ...prev, email: '' }));
                  }}
                  placeholder="contato@empresa.com.br"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                    erros.email
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                  }`}
                />
                {erros.email && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{erros.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Responsável / Ponto Focal *
                </label>
                <input
                  type="text"
                  value={responsavel}
                  onChange={(e) => {
                    setResponsavel(e.target.value);
                    if (erros.responsavel) setErros((prev) => ({ ...prev, responsavel: '' }));
                  }}
                  placeholder="Ex: Carlos Mendonça"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                    erros.responsavel
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                  }`}
                />
                {erros.responsavel && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{erros.responsavel}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Função / Cargo do Responsável *
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => {
                    setCargo(e.target.value);
                    if (erros.cargo) setErros((prev) => ({ ...prev, cargo: '' }));
                  }}
                  placeholder="Ex: Gerente de Meio Ambiente / Diretor"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                    erros.cargo
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/20'
                      : 'border-slate-300 focus:border-[#00AFF0] focus:ring-blue-100'
                  }`}
                />
                {erros.cargo && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{erros.cargo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Botões Inferiores */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.99] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 disabled:opacity-70"
            >
              <Save className="w-4 h-4" />
              <span>{salvando ? 'Salvando...' : 'Salvar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
