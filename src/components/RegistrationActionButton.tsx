import { Edit, Eye, Trash2 } from 'lucide-react';

const acoes = {
  visualizar: { icone: Eye, rotulo: 'Visualizar detalhes', estilo: 'hover:text-[#00AFF0] hover:bg-blue-50' },
  editar: { icone: Edit, rotulo: 'Editar', estilo: 'hover:text-emerald-600 hover:bg-emerald-50' },
  excluir: { icone: Trash2, rotulo: 'Excluir', estilo: 'hover:text-red-600 hover:bg-red-50' },
};

export function BotaoAcaoCadastro({ acao, rotulo, onClick }: {
  acao: keyof typeof acoes; rotulo?: string; onClick: () => void;
}) {
  const { icone: Icone, rotulo: padrao, estilo } = acoes[acao];
  return (
    <button type="button" onClick={onClick} title={rotulo ?? padrao} aria-label={rotulo ?? padrao}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors ${estilo}`}>
      <Icone className="h-4 w-4" aria-hidden />
    </button>
  );
}
