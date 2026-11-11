'use client';

import { useEffect } from 'react';
import { observarFilaCampo, sincronizarFilaCampo } from '@/services/filaRegistrosCampo';

export function SincronizadorCampo({ usuarioId }: { usuarioId: string }) {
  useEffect(() => {
    const enviar = () => { void sincronizarFilaCampo(usuarioId).catch(() => {}); };
    const aoVoltar = () => { if (!document.hidden) enviar(); };
    const parar = observarFilaCampo(mudanca => {
      if (mudanca.usuarioId === usuarioId && mudanca.tipo === 'incluido') enviar();
    });
    enviar();
    window.addEventListener('online', enviar);
    window.addEventListener('focus', enviar);
    document.addEventListener('visibilitychange', aoVoltar);
    const intervalo = window.setInterval(aoVoltar, 30000);
    return () => {
      parar();
      window.removeEventListener('online', enviar);
      window.removeEventListener('focus', enviar);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.clearInterval(intervalo);
    };
  }, [usuarioId]);
  return null;
}
