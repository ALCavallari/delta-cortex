import type { Cliente } from '@/types';
import { ClienteSupabaseRepository, type PerfilClientes } from './clientesSupabase';
import { ClienteRepository, inicializarDadosSeNecessario } from './storage';

export const clientesNoSupabase = process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_CLIENTES_SUPABASE === 'true';

const repositorioLocal = {
  obterAcesso: async (): Promise<PerfilClientes> => 'admin',
  async listar() {
    await inicializarDadosSeNecessario();
    return ClienteRepository.listar();
  },
  obterPorId: ClienteRepository.obterPorId,
  buscarPorCpfCnpj: ClienteRepository.buscarPorCpfCnpj,
  async salvar(cliente: Cliente, editar: boolean) {
    if (editar && !(await ClienteRepository.obterPorId(cliente.id))) throw new Error('Cliente indisponível.');
    await ClienteRepository.salvar(cliente);
    return cliente;
  },
  excluir: ClienteRepository.excluir,
};

export const ClienteRepositoryModulo = clientesNoSupabase ? ClienteSupabaseRepository : repositorioLocal;
