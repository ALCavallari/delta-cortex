import type { SupabaseClient } from '@supabase/supabase-js';
import { perfilValido } from '@/services/perfis';

export async function lerPerfil(supabase: SupabaseClient, id: string) {
  // A consulta legada continua válida antes da aplicação da migration.
  const { data, error } = await supabase.from('acessos_usuarios').select('papel')
    .eq('user_id', id).eq('ativo', true).maybeSingle();
  if (error || !perfilValido(data?.papel)) return null;
  if (data.papel === 'cliente' || data.papel === 'tecnico') {
    const efetivo = await supabase.rpc('delta_cortex_perfil_efetivo');
    return !efetivo.error && efetivo.data === data.papel ? data.papel : null;
  }
  return data.papel;
}
