'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Perfil } from '@/services/perfis';

const Contexto = createContext<{ perfil: Perfil | null; email?: string; usuarioId?: string }>({ perfil: null });

export function PerfilProvider({ perfil, email, usuarioId, children }: {
  perfil: Perfil | null; email: string; usuarioId: string; children: ReactNode;
}) {
  return <Contexto.Provider value={{ perfil, email, usuarioId }}>{children}</Contexto.Provider>;
}

export function usePerfil() {
  return useContext(Contexto).perfil;
}

export function useEmailPerfil() {
  return useContext(Contexto).email;
}

export function useUsuarioId() {
  return useContext(Contexto).usuarioId;
}
