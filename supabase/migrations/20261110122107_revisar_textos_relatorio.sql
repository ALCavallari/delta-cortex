begin;

create function delta_cortex_private.revisar_relatorio(p_original text, p_relatorio jsonb, p_textos jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  original public.visitas_sistematicas_relatorios%rowtype;
  novo public.visitas_sistematicas_relatorios%rowtype;
  registro public.visitas_sistematicas_registros%rowtype;
  texto record;
  revisao_id text;
begin
  if delta_cortex_private.perfil_efetivo() is distinct from 'admin' then
    raise exception 'Operação exclusiva de administradores' using errcode = '42501';
  end if;

  novo := jsonb_populate_record(null::public.visitas_sistematicas_relatorios, p_relatorio);
  select * into original from public.visitas_sistematicas_relatorios
    where id = p_original and visita_id = novo.visita_id and excluido_em is null;
  if not found then
    raise exception 'Relatório indisponível ou alterado por outro usuário' using errcode = '40001';
  end if;

  if novo.registro_ids is distinct from original.registro_ids
    or novo.fotografia_ids is null
    or cardinality(novo.fotografia_ids) <> cardinality(original.fotografia_ids)
    or not (novo.fotografia_ids @> original.fotografia_ids and original.fotografia_ids @> novo.fotografia_ids)
    or jsonb_typeof(p_textos) is distinct from 'array' then
    raise exception 'Vínculos da revisão inválidos' using errcode = '23514';
  end if;
  if jsonb_array_length(p_textos) <> cardinality(original.registro_ids)
    or (select count(distinct t.id) from jsonb_to_recordset(p_textos) as t(id text)) <> cardinality(original.registro_ids) then
    raise exception 'Registros da revisão incompletos ou duplicados' using errcode = '23514';
  end if;

  revisao_id := public.delta_cortex_substituir_relatorio(p_original, p_relatorio);

  for texto in
    select * from jsonb_to_recordset(p_textos) as t(id text, anterior text, descricao text)
    order by t.id
  loop
    if not (texto.id = any(original.registro_ids))
      or texto.descricao is null or texto.descricao !~ '[^[:space:]]' then
      raise exception 'Descrição ou registro inválido na revisão' using errcode = '23514';
    end if;
    select * into registro from public.visitas_sistematicas_registros where id = texto.id for update;
    if not found or registro.descricao is distinct from texto.anterior
      or (registro.excluido_em is not null and texto.descricao is distinct from registro.descricao) then
      raise exception 'Registro indisponível ou alterado por outro usuário' using errcode = '40001';
    end if;
    if texto.descricao is distinct from registro.descricao then
      update public.visitas_sistematicas_registros set descricao = texto.descricao where id = registro.id;
    end if;
  end loop;

  return revisao_id;
end $$;

create function public.delta_cortex_revisar_relatorio(p_original text, p_relatorio jsonb, p_textos jsonb)
returns text language sql security invoker set search_path = ''
as $$
  select delta_cortex_private.revisar_relatorio(p_original, p_relatorio, p_textos);
$$;

revoke all on function delta_cortex_private.revisar_relatorio(text,jsonb,jsonb) from public, anon;
revoke all on function public.delta_cortex_revisar_relatorio(text,jsonb,jsonb) from public, anon;
grant execute on function delta_cortex_private.revisar_relatorio(text,jsonb,jsonb) to authenticated;
grant execute on function public.delta_cortex_revisar_relatorio(text,jsonb,jsonb) to authenticated;

commit;
