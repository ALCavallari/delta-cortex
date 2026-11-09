import { ClienteSupabaseRepository } from './clientesSupabase';
import { ProjetoSupabaseRepository, ProfissionalSupabaseRepository } from './cadastrosSupabase';
import { ArquivoGeograficoSupabaseRepository } from './arquivosSupabase';
import { RegistroCampoSupabaseRepository, RelatorioSupabaseRepository, VisitaSupabaseRepository } from './campoSupabase';
import * as legado from './storage';

// Ativação explícita após a conferência das migrations no projeto de destino.
export const operacaoCentralizada = process.env.NEXT_PUBLIC_OPERACAO_SUPABASE === 'true';

export const ClienteRepository = operacaoCentralizada ? ClienteSupabaseRepository : legado.ClienteRepository;
export const ProjetoRepository = operacaoCentralizada ? ProjetoSupabaseRepository : legado.ProjetoRepository;
export const ArquivoGeograficoRepository = operacaoCentralizada ? ArquivoGeograficoSupabaseRepository : legado.ArquivoGeograficoRepository;
export const ProfissionalRepository = operacaoCentralizada ? ProfissionalSupabaseRepository : {
  ...legado.ProfissionalRepository,
  listarComDadosBancarios: legado.ProfissionalRepository.listar,
};
export const VisitaRepository = operacaoCentralizada ? VisitaSupabaseRepository : legado.VisitaRepository;
export const RegistroCampoRepository = operacaoCentralizada ? RegistroCampoSupabaseRepository : legado.RegistroCampoRepository;
export const RelatorioRepository = operacaoCentralizada ? RelatorioSupabaseRepository : legado.RelatorioRepository;
