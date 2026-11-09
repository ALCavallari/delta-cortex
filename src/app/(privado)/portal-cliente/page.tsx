import { Suspense } from 'react';
import { AreaPerfil } from '@/components/auth/AreaPerfil';
import { ProjetosDesignados } from '@/components/ProjetosDesignados';

export default function PortalCliente() {
  return <Suspense fallback={<p role="status" className="p-5">Verificando acesso…</p>}>
    <AreaPerfil esperado="cliente"><ProjetosDesignados portal /></AreaPerfil>
  </Suspense>;
}
