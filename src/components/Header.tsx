'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Home, ArrowLeft } from 'lucide-react';
import { usePerfil } from '@/components/auth/PerfilContext';
import { destinoPerfil } from '@/services/perfis';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  backHref,
  backLabel = 'Voltar',
  action,
}: HeaderProps) {
  const perfil = usePerfil();
  const inicio = perfil ? destinoPerfil(perfil) : '/dashboard';
  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Lado Esquerdo: Logo e Navegação */}
          <div className="flex items-center gap-4">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-[#333436] hover:bg-slate-100 rounded-lg transition-colors"
                title={backLabel}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}

            <Link href={inicio} className="flex items-center gap-3 group">
              <div className="flex shrink-0 items-center">
                <Image
                  src="/Cortex_Simplificado.png"
                  alt="Delta CorteX"
                  width={72}
                  height={72}
                  sizes="(min-width: 640px) 72px, 56px"
                  loading="eager"
                  className="h-auto w-14 object-contain sm:w-[72px]"
                />
              </div>
              <div className="hidden md:flex flex-col border-l border-slate-200 pl-3">
                <span className="text-base font-bold text-[#333436] tracking-tight group-hover:text-[#00AFF0] transition-colors">
                  Delta Cortex
                </span>
              </div>
            </Link>
          </div>

          {/* Centro: Título do Módulo (visível em telas médias/grandes) */}
          {title && (
            <div className="hidden lg:flex flex-col text-center">
              <h1 className="text-lg font-bold text-[#333436]">{title}</h1>
              {subtitle && (
                <span className="text-xs text-slate-500">{subtitle}</span>
              )}
            </div>
          )}

          {/* Lado Direito: Ações ou Atalho para Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {action}
            <Link
              href={inicio}
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-[#00AFF0] hover:bg-blue-50/60 rounded-lg transition-colors border border-transparent hover:border-blue-100"
              title="Menu Principal"
            >
              <Home className="w-4 h-4 text-slate-500 group-hover:text-[#00AFF0]" />
              <span className="hidden md:inline">Menu Principal</span>
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Título no Mobile quando houver */}
        {title && (
          <div className="lg:hidden pb-3 pt-1 border-t border-slate-100 flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-[#333436]">{title}</h1>
              {subtitle && (
                <span className="text-[11px] text-slate-500">{subtitle}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
