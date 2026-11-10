import type { Perfil } from './perfis';

export type UsuarioAdministrado = {
  id: string; nome: string | null; email: string; papel: Perfil; ativo: boolean;
  confirmado: boolean; convidadoEm: string | null; senhaPendente: boolean; profissionalId: string | null; projetos: string[];
};
export type PainelUsuarios = { externoHabilitado: boolean; usuarios: UsuarioAdministrado[] };
export type AlteracaoUsuario = {
  id?: string; nome: string; email?: string; papel: Perfil; ativo: boolean;
  profissionalId: string | null; projetos: string[]; confirmar: boolean; vincularExistente: boolean;
};

export const rotulosPerfil: Record<Perfil, string> = {
  admin: 'Administrador', cliente: 'Cliente', tecnico: 'Técnico', editor: 'Editor (legado)', leitor: 'Leitor (legado)',
};
