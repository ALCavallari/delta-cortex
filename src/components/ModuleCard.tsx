'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon, ArrowRight, Clock } from 'lucide-react';

interface ModuleCardProps {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: 'active' | 'in_development';
  highlightColor?: string; // Hex ou classe
  badgeText?: string;
}

export function ModuleCard({
  name,
  description,
  href,
  icon: Icon,
  status,
  badgeText,
}: ModuleCardProps) {
  const isActive = status === 'active';

  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border transition-all duration-200 ${
        isActive
          ? 'border-slate-200 hover:border-[#00AFF0] shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1'
          : 'border-slate-200/70 hover:border-slate-300 opacity-90 hover:opacity-100 shadow-xs'
      }`}
    >
      <div>
        {/* Cabeçalho do Card: Ícone e Badge */}
        <div className="flex items-center justify-between mb-5">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-50 text-[#00AFF0] group-hover:bg-[#00AFF0] group-hover:text-white'
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
            }`}
          >
            <Icon className="w-7 h-7" />
          </div>

          <div>
            {isActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {badgeText || 'Disponível'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <Clock className="w-3 h-3 text-slate-400" />
                Em desenvolvimento
              </span>
            )}
          </div>
        </div>

        {/* Nome do Módulo */}
        <h3 className="text-xl font-bold text-[#333436] group-hover:text-[#00AFF0] transition-colors mb-2">
          {name}
        </h3>

        {/* Descrição */}
        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Rodapé do Card com Ação */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold">
        <span
          className={`transition-colors ${
            isActive ? 'text-[#00AFF0]' : 'text-slate-500'
          }`}
        >
          {isActive ? 'Acessar módulo' : 'Ver informações'}
        </span>
        <ArrowRight
          className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
            isActive ? 'text-[#00AFF0]' : 'text-slate-400'
          }`}
        />
      </div>
    </Link>
  );
}
