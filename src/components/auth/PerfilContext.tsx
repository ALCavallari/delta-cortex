'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Perfil } from '@/services/perfis';

const Contexto = createContext<Perfil | null>(null);

export function PerfilProvider({ perfil, children }: { perfil: Perfil | null; children: ReactNode }) {
  return <Contexto.Provider value={perfil}>{children}</Contexto.Provider>;
}

export function usePerfil() {
  return useContext(Contexto);
}
