'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { BotaoAcaoCadastro } from '@/components/RegistrationActionButton';
import { ConfirmarExclusaoCadastro } from '@/components/DeleteRegistrationDialog';
import { Header } from '@/components/Header';
import { ClientModal } from '@/components/ClientModal';
import { ClientDetailsModal } from '@/components/ClientDetailsModal';
import { Cliente, TipoPessoa } from '@/types';
import { ClienteRepositoryModulo, clientesNoSupabase } from '@/services/clientesModulo';
import { mensagemClientes, type PerfilClientes } from '@/services/clientesSupabase';
import { limparCaracteres } from '@/services/validation';
import {
  Plus,
  Search,
  Building2,
  User,
  CheckCircle2,
  Users,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<PerfilClientes | null>(clientesNoSupabase ? null : 'admin');
  const [tentativa, setTentativa] = useState(0);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const podeEditar = !erroConsulta && (perfil === 'admin' || perfil === 'editor');

  // Filtros e ordenação
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoPessoa>('TODOS');
  const [ordenacao, setOrdenacao] = useState<'nome-asc' | 'nome-desc' | 'data-desc' | 'data-asc'>('data-desc');

  // Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Cliente | null>(null);
  const [clienteDetalhes, setClienteDetalhes] = useState<Cliente | null>(null);

  // Toast feedback
  const [clienteParaExcluir, setParaExcluir] = useState<Cliente | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void ClienteRepositoryModulo.obterAcesso().then(async acesso => ({
      acesso, lista: await ClienteRepositoryModulo.listar(),
    })).then(({ acesso, lista }) => {
      if (!ativo) return;
      setPerfil(acesso);
      setClientes(lista);
    }).catch(erro => {
      if (!ativo) return;
      setPerfil(null);
      setClientes([]);
      setErroConsulta(mensagemClientes(erro, 'Não foi possível carregar os clientes. Tente novamente.'));
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [tentativa]);

  const showToast = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => {
      setMensagemSucesso(null);
    }, 4000);
  };

  const handleClienteSalvo = (cliente: Cliente) => {
    setClientes(lista => lista.some(item => item.id === cliente.id)
      ? lista.map(item => item.id === cliente.id ? cliente : item)
      : [...lista, cliente]);
    showToast(
      clienteEmEdicao
        ? `Cliente "${cliente.nomeRazaoSocial}" atualizado com sucesso!`
        : `Cliente "${cliente.nomeRazaoSocial}" cadastrado com sucesso!`
    );
  };

  const abrirEdicao = (cliente: Cliente) => {
    if (!podeEditar) return;
    setClienteEmEdicao(cliente);
    setModalCadastroAberto(true);
  };

  const abrirNovo = () => {
    if (!podeEditar) return;
    setClienteEmEdicao(null);
    setModalCadastroAberto(true);
  };

  // Filtragem e ordenação
  const clientesFiltrados = useMemo(() => {
    let result = [...clientes];

    // Busca textual
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      const termoLimpo = limparCaracteres(busca);
      result = result.filter((c) => {
        const matchNome = c.nomeRazaoSocial.toLowerCase().includes(termo);
        const matchResp = c.responsavel.toLowerCase().includes(termo);
        const matchDoc = termoLimpo
          ? limparCaracteres(c.cpfCnpj).includes(termoLimpo)
          : false;
        return matchNome || matchResp || matchDoc;
      });
    }

    // Filtro tipo
    if (filtroTipo !== 'TODOS') {
      result = result.filter((c) => c.tipoPessoa === filtroTipo);
    }

    // Ordenação
    result.sort((a, b) => {
      if (ordenacao === 'nome-asc') {
        return a.nomeRazaoSocial.localeCompare(b.nomeRazaoSocial);
      }
      if (ordenacao === 'nome-desc') {
        return b.nomeRazaoSocial.localeCompare(a.nomeRazaoSocial);
      }
      if (ordenacao === 'data-asc') {
        return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
      }
      // data-desc (padrão)
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });

    return result;
  }, [clientes, busca, filtroTipo, ordenacao]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        title="Gestão de Clientes"
        subtitle={descricoesModulos.clientes}
        backHref="/dashboard"
        backLabel="Menu Principal"
        action={podeEditar ? (
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] active:scale-[0.99] transition-all shadow-md shadow-blue-400/20 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        ) : undefined}
      />

      {/* Toast de Sucesso */}
      {mensagemSucesso && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#333436] text-white shadow-xl border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-[#A3CA33] shrink-0" />
          <span className="text-sm font-medium">{mensagemSucesso}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Título de Seção & Botão Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#333436] tracking-tight">
              Clientes
            </h1>
            <p className="text-sm text-slate-500">
              {descricoesModulos.clientes}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Fonte: {clientesNoSupabase ? 'Supabase' : 'IndexedDB local'}
              {clientesNoSupabase && perfil === 'leitor' && ' · Somente leitura'}
            </p>
          </div>

          {podeEditar && <div className="sm:hidden">
            <button
              onClick={abrirNovo}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Cliente</span>
            </button>
          </div>}
        </div>

        {/* Barra de Filtros e Pesquisa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
            {/* Campo de Busca */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por nome, razão social, CPF ou CNPJ..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Filtro Tipo de Pessoa */}
            <div className="md:col-span-3">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Tipos</option>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="PF">Pessoa Física</option>
              </select>
            </div>

            {/* Ordenação */}
            <div className="md:col-span-3">
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:border-[#00AFF0] focus:ring-2 focus:ring-blue-100 bg-white text-slate-700"
              >
                <option value="data-desc">Cadastro: Mais Recentes</option>
                <option value="data-asc">Cadastro: Mais Antigos</option>
                <option value="nome-asc">Nome: A → Z (Alfabético)</option>
                <option value="nome-desc">Nome: Z → A</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              Exibindo <strong>{clientesFiltrados.length}</strong> de{' '}
              <strong>{clientes.length}</strong> clientes cadastrados
            </span>
            {(busca || filtroTipo !== 'TODOS') && (
              <button
                onClick={() => {
                  setBusca('');
                  setFiltroTipo('TODOS');
                }}
                className="text-[#00AFF0] font-semibold hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Estado Carregando */}
        {carregando ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-10 h-10 border-4 border-[#00AFF0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">
              Carregando clientes…
            </p>
          </div>
        ) : erroConsulta ? (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{erroConsulta}</p>
            <button type="button" className="rounded-lg border border-red-300 px-3 py-2 font-semibold"
              onClick={() => { setErroConsulta(null); setCarregando(true); setTentativa(valor => valor + 1); }}>Tentar novamente</button>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          /* Estado Vazio */
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#00AFF0] flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#333436] mb-1">
              {clientes.length === 0
                ? 'Nenhum cliente cadastrado ainda'
                : 'Nenhum cliente encontrado com os filtros aplicados'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {clientes.length === 0
                ? (podeEditar ? 'Cadastre o primeiro cliente.' : 'Nenhum cliente disponível para consulta.')
                : 'Tente alterar os termos da busca ou redefinir os filtros selecionados.'}
            </p>
            {podeEditar && clientes.length === 0 && (
              <button
                onClick={abrirNovo}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Cliente</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Visualização DESKTOP: Tabela Completa */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Nome / Razão Social</th>
                      <th className="py-3.5 px-4">CPF / CNPJ</th>
                      <th className="py-3.5 px-4">Cidade / UF</th>
                      <th className="py-3.5 px-4">Telefone</th>
                      <th className="py-3.5 px-4">E-mail</th>
                      <th className="py-3.5 px-4">Responsável</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesFiltrados.map((cliente) => (
                      <tr
                        key={cliente.id}
                        className="hover:bg-blue-50/40 transition-colors group"
                      >
                        {/* Tipo */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {cliente.tipoPessoa === 'PJ' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-[#00AFF0] border border-blue-200/60">
                              <Building2 className="w-3.5 h-3.5" />
                              PJ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <User className="w-3.5 h-3.5" />
                              PF
                            </span>
                          )}
                        </td>

                        {/* Nome */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-[#333436] group-hover:text-[#00AFF0] transition-colors max-w-xs truncate">
                            {cliente.nomeRazaoSocial}
                          </div>
                        </td>

                        {/* CPF/CNPJ */}
                        <td className="py-4 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                          {cliente.cpfCnpj}
                        </td>

                        {/* Cidade / UF */}
                        <td className="py-4 px-4 whitespace-nowrap text-slate-700">
                          {cliente.cidade} / <span className="font-semibold">{cliente.estado}</span>
                        </td>

                        {/* Telefone */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs font-mono text-slate-600">
                          {cliente.telefone}
                        </td>

                        {/* E-mail */}
                        <td className="py-4 px-4 text-xs text-slate-600 max-w-[180px] truncate">
                          {cliente.email}
                        </td>

                        {/* Responsável */}
                        <td className="py-4 px-4 text-xs text-slate-700">
                          <span className="font-semibold">{cliente.responsavel}</span>
                          <span className="block text-[11px] text-slate-400 truncate">
                            {cliente.cargo}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <BotaoAcaoCadastro acao="visualizar" onClick={() => setClienteDetalhes(cliente)} />
                            {podeEditar && <BotaoAcaoCadastro acao="editar" onClick={() => abrirEdicao(cliente)} />}
                            {podeEditar && <BotaoAcaoCadastro acao="excluir" rotulo="Excluir cliente" onClick={() => setParaExcluir(cliente)} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visualização MOBILE e TABLET: Cards Adaptados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-[#00AFF0] transition-colors"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {cliente.tipoPessoa === 'PJ' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-[#00AFF0] border border-blue-200/60">
                          <Building2 className="w-3.5 h-3.5" />
                          Pessoa Jurídica
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <User className="w-3.5 h-3.5" />
                          Pessoa Física
                        </span>
                      )}

                      <span className="text-xs font-mono text-slate-500">
                        {cliente.cpfCnpj}
                      </span>
                    </div>

                    {/* Nome */}
                    <h3 className="text-base font-bold text-[#333436] mb-3 leading-snug">
                      {cliente.nomeRazaoSocial}
                    </h3>

                    {/* Dados em Linha */}
                    <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#00AFF0] shrink-0" />
                        <span>
                          {cliente.cidade} / {cliente.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{cliente.telefone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{cliente.email}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-500">Responsável:</span>
                        <span className="font-semibold text-slate-700">
                          {cliente.responsavel} ({cliente.cargo})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Inferiores no Card */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                    <BotaoAcaoCadastro acao="visualizar" onClick={() => setClienteDetalhes(cliente)} />
                    {podeEditar && <BotaoAcaoCadastro acao="editar" onClick={() => abrirEdicao(cliente)} />}
                    {podeEditar && <BotaoAcaoCadastro acao="excluir" rotulo="Excluir cliente" onClick={() => setParaExcluir(cliente)} />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Modais */}
      {podeEditar && modalCadastroAberto && <ClientModal key={clienteEmEdicao?.id ?? 'novo'}
        onClose={() => setModalCadastroAberto(false)}
        onSaved={handleClienteSalvo}
        clienteParaEdicao={clienteEmEdicao}
      />}

      <ClientDetailsModal
        cliente={clienteDetalhes}
        isOpen={!!clienteDetalhes}
        onClose={() => setClienteDetalhes(null)}
        onDelete={podeEditar ? item => { setClienteDetalhes(null); setParaExcluir(item); } : undefined}
        onEdit={podeEditar ? abrirEdicao : undefined}
      />
      {podeEditar && clienteParaExcluir && <ConfirmarExclusaoCadastro tipo="Cliente" nome={clienteParaExcluir.nomeRazaoSocial}
        mensagemErro={erro => mensagemClientes(erro, 'Não foi possível excluir o cliente.')}
        onClose={() => setParaExcluir(null)} onConfirm={async () => {
          await ClienteRepositoryModulo.excluir(clienteParaExcluir.id);
          setClientes(itens => itens.filter(item => item.id !== clienteParaExcluir.id));
          setParaExcluir(null);
          showToast('Cliente excluído.');
        }} />}
    </div>
  );
}
