begin;

create or replace function delta_cortex_private.validar_relatorio()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v public.visitas_sistematicas%rowtype;
begin
  select * into strict v from public.visitas_sistematicas where id = new.visita_id
    and status in ('em_andamento', 'concluida') and excluido_em is null for share;
  if exists (
    select 1 from unnest(new.registro_ids) i(id)
    where not exists (select 1 from public.visitas_sistematicas_registros r
      where r.id = i.id and r.projeto_id = v.projeto_id
      and (r.visita_origem_id = v.id or r.tipo = 'Ocorrencia'))
  ) or exists (
    select 1 from unnest(new.fotografia_ids) i(id)
    where not exists (select 1 from public.visitas_sistematicas_fotografias f
      where f.id = i.id and f.registro_id = any(new.registro_ids))
  ) then
    raise exception 'O relatório contém referências incompatíveis' using errcode = '23503';
  end if;
  return new;
exception when no_data_found then
  raise exception 'Visita indisponível para emissão de relatório' using errcode = '23503';
end $$;

create or replace function public.delta_cortex_adicionar_relatorio(p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare r public.visitas_sistematicas_relatorios%rowtype := jsonb_populate_record(null::public.visitas_sistematicas_relatorios, p_relatorio);
begin
  update public.visitas_sistematicas set atividades_realizadas = r.atividades
    where id = r.visita_id and status in ('em_andamento', 'concluida') and excluido_em is null;
  if not found then raise exception 'Visita indisponível para emissão de relatório' using errcode = '23503'; end if;
  insert into public.visitas_sistematicas_relatorios (id, visita_id, nome_arquivo, storage_path,
    gerado_em, atividades, registro_ids, fotografia_ids)
  values (r.id, r.visita_id, r.nome_arquivo, r.storage_path, r.gerado_em,
    r.atividades, r.registro_ids, r.fotografia_ids);
  return r.id;
end $$;

create function public.delta_cortex_emitir_relatorio_visita(p_original text, p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  visita text := p_relatorio->>'visita_id';
  atual text;
begin
  if coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  perform 1 from public.visitas_sistematicas where id = visita
    and status in ('em_andamento', 'concluida') and excluido_em is null for update;
  if not found then
    raise exception 'Visita indisponível para emissão de relatório' using errcode = '23503';
  end if;
  select id into atual from public.visitas_sistematicas_relatorios
    where visita_id = visita and excluido_em is null order by gerado_em desc, id limit 1;
  if atual is distinct from p_original then
    raise exception 'O relatório vinculado à visita mudou' using errcode = '40001';
  end if;
  if atual is not null then
    return public.delta_cortex_substituir_relatorio(atual, p_relatorio);
  end if;
  return public.delta_cortex_adicionar_relatorio(p_relatorio);
end $$;

revoke all on function public.delta_cortex_emitir_relatorio_visita(text,jsonb) from public, anon;
grant execute on function public.delta_cortex_emitir_relatorio_visita(text,jsonb) to authenticated;

commit;
