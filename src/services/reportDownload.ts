import { RelatorioVisita } from '@/types';

export function baixarRelatorio(relatorio: RelatorioVisita) {
  if (!(relatorio.pdf instanceof Blob) || !relatorio.pdf.size) {
    throw new Error('O PDF salvo não está disponível para download.');
  }
  const url = URL.createObjectURL(relatorio.pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = relatorio.nomeArquivo;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
