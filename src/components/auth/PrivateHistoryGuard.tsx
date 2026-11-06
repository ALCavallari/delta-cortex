'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function PrivateHistoryGuard({ children }: { children: ReactNode }) {
  const conteudo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const elemento = conteudo.current;
    const ocultar = () => { if (elemento) elemento.style.visibility = 'hidden'; };
    const restaurar = (evento: PageTransitionEvent) => {
      if (evento.persisted) window.location.reload();
      else if (elemento) elemento.style.visibility = '';
    };
    window.addEventListener('pagehide', ocultar);
    window.addEventListener('pageshow', restaurar);
    return () => {
      window.removeEventListener('pagehide', ocultar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, []);
  return <div ref={conteudo} className="contents">{children}</div>;
}
