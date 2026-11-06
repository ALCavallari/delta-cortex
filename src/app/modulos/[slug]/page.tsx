'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { descricoesModulos } from '@/services/moduleDescriptions';
import { Header } from '@/components/Header';
import Link from 'next/link';
import {
  Clock,
  ArrowLeft,
  GraduationCap,
  DollarSign,
  FileText,
  FileCheck2,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';

const MODULE_DATA: Record<
  string,
  {
    nome: string;
    subtitulo: string;
    icone: React.ComponentType<{ className?: string }>;
    previsao?: string;
    escopoFuturo?: string[];
  }
> = {
  'corpo-tecnico': {
    nome: 'Corpo Técnico',
    subtitulo: descricoesModulos.corpoTecnico,
    icone: GraduationCap,
    previsao: 'Etapa 2 — Banco de Dados e Módulos Cadastrais',
    escopoFuturo: [
      'Cadastro de engenheiros, biólogos, geólogos e técnicos de campo',
      'Controle de registros profissionais (CREA, CRBio, CFT)',
      'Gestão de Anotações de Responsabilidade Técnica (ARTs/AFTs)',
      'Alocação de equipes multidisciplinares por empreendimento',
    ],
  },
  projetos: {
    nome: 'Projetos',
    subtitulo: descricoesModulos.projetos,
    icone: FolderKanban,
    previsao: 'Etapa 2 — Gestão de Projetos e Empreendimentos',
    escopoFuturo: [
      'Cadastro de CGHs, PCHs, UHEs, Parques Eólicos e Solares',
      'Gestão de Estudos de Impacto Ambiental (EIA/RIMA, RCA, PCA)',
      'Controle de Licenças Ambientais (LP, LI, LO) e Condicionantes',
      'Vinculação estruturada com as Visitas de Campo do Delta CorteX',
    ],
  },
  contratos: {
    nome: 'Contratos',
    subtitulo: 'Instrumentos Jurídicos e Contratuais',
    icone: FileText,
    previsao: 'Etapa 3 — Gestão Jurídica e Contratual',
    escopoFuturo: [
      'Contratos de prestação de serviços técnicos de engenharia',
      'Controle de prazos, entregáveis e aditivos contratuais',
      'Acompanhamento de obrigações das partes contratantes',
      'Armazenamento digital de termos e minutas',
    ],
  },
  licencas: {
    nome: 'Licenças',
    subtitulo: descricoesModulos.licencas,
    icone: FileCheck2,
  },
  financeiro: {
    nome: 'Financeiro',
    subtitulo: descricoesModulos.financeiro,
    icone: DollarSign,
    previsao: 'Etapa 3 — Gestão Financeira e Medições',
    escopoFuturo: [
      'Emissão e controle de medições técnicas de campo',
      'Faturamento de projetos e condicionantes ambientais',
      'Controle de diárias e despesas de deslocamento das equipes',
      'Fluxo financeiro por cliente e empreendimento',
    ],
  },
};

function PendingModuleContent() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const mod = MODULE_DATA[slug] || {
    nome: 'Módulo Corporativo',
    subtitulo: 'Gestão Delta CorteX',
    icone: Clock,
    previsao: 'Etapas futuras de implementação',
    escopoFuturo: ['Funcionalidade prevista no roadmap do Delta CorteX'],
  };

  const Icon = mod.icone;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        title={mod.nome}
        subtitle={mod.subtitulo}
        backHref="/dashboard"
        backLabel="Menu Principal"
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center items-center">
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center">
          {/* Ícone */}
          <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-6">
            <Icon className="w-10 h-10" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-800 mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>Módulo em desenvolvimento</span>
          </div>

          {/* Títulos */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#333436] mb-2">
            {mod.nome}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto mb-8">
            {mod.subtitulo}
          </p>

          {/* Previsão & Escopo Futuro */}
          {mod.previsao && mod.escopoFuturo && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-w-xl mx-auto mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Previsão de Entrega: {mod.previsao}
              </h3>
              <ul className="space-y-2.5">
                {mod.escopoFuturo.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-[#A3CA33] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {slug === 'projetos' && (
              <Link
                href="/projetos"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-[#00AFF0] hover:bg-[#0098d1] transition-all shadow-md shadow-blue-400/20 text-sm"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Acessar Módulo Projetos</span>
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retornar ao Menu Principal</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PendingModulePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-3 border-[#00AFF0] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PendingModuleContent />
    </Suspense>
  );
}
