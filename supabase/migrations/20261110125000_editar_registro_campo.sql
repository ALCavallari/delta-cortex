begin;

create function delta_cortex_private.editar_registro(
  p_visita_id text, p_registro_id text, p_versao bigint, p_descricao_anterior text,
  p_alteracoes jsonb, p_fotos_novas jsonb, p_fotos_removidas text[]
)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  visita public.visitas_sistematicas%rowtype;
  registro public.visitas_sistematicas_registros%rowtype;
  novo public.visitas_sistematicas_registros%rowtype;
  nova_versao bigint;
begin
  if (select auth.uid()) is null
    or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;

  select * into visita from public.visitas_sistematicas
    where id = p_visita_id and excluido_em is null and status = 'em_andamento'
      and delta_cortex_private.acesso_projeto(projeto_id, true) for share;
  if not found then
    raise exception 'Levantamento em andamento indisponível' using errcode = '42501';
  end if;

  select * into registro from public.visitas_sistematicas_registros r
    where r.id = p_registro_id and r.projeto_id = visita.projeto_id and r.excluido_em is null
      and (r.visita_origem_id = visita.id or (r.tipo = 'Ocorrencia' and r.registrado_em <= visita.criado_em))
      and exists (select 1 from public.visitas_sistematicas origem
        where origem.id = r.visita_origem_id and origem.excluido_em is null)
    for update;
  if not found then
    raise exception 'Registro indisponível neste levantamento' using errcode = '42501';
  end if;
  if registro.versao is distinct from p_versao or registro.descricao is distinct from p_descricao_anterior then
    raise exception 'Registro alterado por outro usuário' using errcode = '40001';
  end if;

  novo := jsonb_populate_record(null::public.visitas_sistematicas_registros, p_alteracoes);
  if novo.tipo is distinct from registro.tipo and (
    registro.visita_origem_id <> visita.id
    or exists (select 1 from public.visitas_sistematicas_eventos e where e.registro_id = registro.id)
    or exists (select 1 from public.visitas_sistematicas_relatorios r
      where r.visita_id <> registro.visita_origem_id and r.registro_ids @> array[registro.id])
  ) then
    raise exception 'O tipo deste registro faz parte do histórico' using errcode = 'PDC01';
  end if;
  if exists (
    select 1 from public.visitas_sistematicas_fotografias f
    join public.visitas_sistematicas_relatorios r on r.fotografia_ids @> array[f.id] and r.excluido_em is null
    where f.registro_id = registro.id and f.id = any(p_fotos_removidas)
  ) then
    raise exception 'Uma fotografia removida faz parte de um relatório emitido' using errcode = 'PDC02';
  end if;

  update public.visitas_sistematicas_registros set
    tipo = novo.tipo, meio_ambiental = novo.meio_ambiental, descricao = novo.descricao,
    gravidade = novo.gravidade,
    situacao = case when novo.tipo = 'Ocorrencia' then coalesce(registro.situacao, 'em_aberto') end,
    latitude = novo.latitude, longitude = novo.longitude, precisao_metros = novo.precisao_metros,
    utm_zona = novo.utm_zona, utm_hemisferio = novo.utm_hemisferio, utm_easting = novo.utm_easting,
    utm_northing = novo.utm_northing, referencia_geodesica = novo.referencia_geodesica,
    versao = registro.versao + 1
  where id = registro.id returning versao into nova_versao;

  update public.visitas_sistematicas_fotografias set excluido_em = now()
    where registro_id = registro.id and id = any(p_fotos_removidas) and excluido_em is null;

  insert into public.visitas_sistematicas_fotografias (id, registro_id, visita_id, nome_arquivo, storage_path,
    tamanho_bytes, tipo_mime, capturada_em, utm_info, cliente_projeto_info)
  select f.id, registro.id, registro.visita_origem_id, f.nome_arquivo, f.storage_path, f.tamanho_bytes,
    f.tipo_mime, f.capturada_em, f.utm_info, f.cliente_projeto_info
  from jsonb_populate_recordset(null::public.visitas_sistematicas_fotografias, p_fotos_novas) f;

  return nova_versao;
end $$;

create function public.delta_cortex_editar_registro(
  p_visita_id text, p_registro_id text, p_versao bigint, p_descricao_anterior text,
  p_alteracoes jsonb, p_fotos_novas jsonb, p_fotos_removidas text[]
)
returns bigint language sql security invoker set search_path = ''
as $$
  select delta_cortex_private.editar_registro(
    p_visita_id, p_registro_id, p_versao, p_descricao_anterior, p_alteracoes, p_fotos_novas, p_fotos_removidas
  );
$$;

revoke all on function delta_cortex_private.editar_registro(text,text,bigint,text,jsonb,jsonb,text[]) from public, anon;
revoke all on function public.delta_cortex_editar_registro(text,text,bigint,text,jsonb,jsonb,text[]) from public, anon;
grant execute on function delta_cortex_private.editar_registro(text,text,bigint,text,jsonb,jsonb,text[]) to authenticated;
grant execute on function public.delta_cortex_editar_registro(text,text,bigint,text,jsonb,jsonb,text[]) to authenticated;

commit;
