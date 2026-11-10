'use client';

import React from 'react';
import Link from 'next/link';
import { usePerfil } from '@/components/auth/PerfilContext';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { Header } from '@/components/Header';
import { ModuleCard } from '@/components/ModuleCard';
import {
  Users,
  GraduationCap,
  DollarSign,
  FileCheck2,
  FolderKanban,
  ClipboardCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const perfil = usePerfil();
  const modules = [
    {
      id: 'clientes',
      name: 'Clientes',
      description: descricoesModulos.clientes,
      href: '/clientes',
      icon: Users,
      status: 'active' as const,
      badgeText: 'Operacional',
    },
    {
      id: 'corpo-tecnico',
      name: 'Corpo Técnico',
      description: descricoesModulos.corpoTecnico,
      href: '/modulos/corpo-tecnico',
      icon: GraduationCap,
      status: 'active' as const,
      badgeText: 'Operacional',
    },
    {
      id: 'financeiro',
      name: 'Financeiro',
      description: descricoesModulos.financeiro,
      href: '/modulos/financeiro',
      icon: DollarSign,
      status: 'in_development' as const,
    },
    {
      id: 'projetos',
      name: 'Projetos',
      description: descricoesModulos.projetos,
      href: '/projetos',
      icon: FolderKanban,
      status: 'active' as const,
      badgeText: 'Operacional',
    },
    {
      id: 'licencas',
      name: 'Licenças',
      description: descricoesModulos.licencas,
      href: '/modulos/licencas',
      icon: FileCheck2,
      status: 'in_development' as const,
    },
    {
      id: 'acompanhamento',
      name: 'Trabalho de Campo',
      description: descricoesModulos.trabalhoCampo,
      href: '/acompanhamento',
      icon: ClipboardCheck,
      status: 'active' as const,
      badgeText: 'Operacional',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Grade com os 6 Módulos Corporativos */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#333436] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A3CA33]" />
              Módulos do Sistema
            </h2>
            <span className="text-xs text-slate-500">
              Selecione o módulo operacional desejado
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod) => (
              <ModuleCard key={mod.id} {...mod} />
            ))}
          </div>
        </section>
        {perfil === 'admin' && <Link href="/administracao/usuarios"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold">
          <Users size={18} aria-hidden /> Administração de Usuários
        </Link>}
      </main>

    </div>
  );
}
