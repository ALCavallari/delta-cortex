import { limparCaracteres, formatarTelefone } from './validation';

export const normalizarBusca = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function numeroWhatsApp(contato: string): string | undefined {
  if (!/^\+?[\d\s().-]+$/.test(contato.trim())) return;
  const digitos = limparCaracteres(contato);
  const internacional = contato.trim().startsWith('+') || digitos.length > 11;
  if (internacional && !/^55\d{10,11}$/.test(digitos)) return;
  const nacional = internacional ? digitos.slice(2) : digitos;
  if (!/^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(nacional)) return;
  return '55' + nacional;
}

export function mascaraContato(contato: string): string {
  if (!/^[+\d\s().-]*$/.test(contato)) return contato;
  const digitos = limparCaracteres(contato);
  if (contato.startsWith('+') || digitos.length > 11) {
    return digitos.startsWith('55') && digitos.length <= 13
      ? '+55 ' + formatarTelefone(digitos.slice(2)) : contato;
  }
  return formatarTelefone(digitos);
}

export const SEM_TECNICOS = 'Nenhum técnico habilitado cadastrado. Cadastre ou habilite um profissional no módulo Corpo Técnico.';
export const CORPO_TECNICO = '/modulos/corpo-tecnico';
