import type { Periodicidade } from '@/types/financeiro';

export const mesesPorPeriodo: Partial<Record<Periodicidade, number>> = {
  mensal: 1, bimensal: 2, trimestral: 3, semestral: 6, anual: 12,
};
export const MAX_VALOR_CENTAVOS = 999_999_999_999;
export const MAX_PARCELAS = 240;
export const moeda = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
export const valorEditavel = (centavos: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centavos / 100);

/** Entrada brasileira, sem arredondamento de frações de centavo. */
export function lerCentavos(texto: string): number | null {
  const valor = texto.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor)) return null;
  const [inteiro, decimal = ''] = valor.replaceAll('.', '').split(',');
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) && centavos <= MAX_VALOR_CENTAVOS ? centavos : null;
}

export function dataValida(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < '1900-01-01' || data > '9999-12-31') return false;
  const date = new Date(`${data}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === data;
}
export function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const dataBr = (data: string) => data.split('-').reverse().join('/');

/** Sempre ancorado no dia original: 31/01 → 28/02 → 31/03. */
export function somarMeses(data: string, meses: number): string {
  if (!dataValida(data) || !Number.isInteger(meses)) return '';
  const [ano, mes, dia] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1, 12));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.getUTCFullYear() <= 9999 ? alvo.toISOString().slice(0, 10) : '';
}
export function datasAutomaticas(primeiro: string, periodo: Periodicidade, quantidade: number): string[] {
  const intervalo = mesesPorPeriodo[periodo];
  if (!intervalo || !dataValida(primeiro) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PARCELAS) return [];
  return Array.from({ length: quantidade }, (_, i) => somarMeses(primeiro, i * intervalo));
}
export function distribuirCentavos(total: number, parcelas: number) {
  const base = Math.floor(total / parcelas);
  const resto = total % parcelas;
  return Array.from({ length: parcelas }, (_, i) => base + (i < resto ? 1 : 0));
}
