begin;

alter table public.projetos add column abreviacao text,
  add constraint projetos_abreviacao_valida check (
    abreviacao is null or (
      char_length(abreviacao) between 1 and 40 and abreviacao = btrim(abreviacao)
      and abreviacao !~ '[<>:"/\\|?*[:cntrl:]]' and right(abreviacao, 1) <> '.'
    )
  );

create or replace function public.delta_cortex_salvar_projeto(
  p_projeto jsonb, p_editar boolean, p_atualizado_em timestamptz, p_adicionar jsonb, p_remover text[]
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare p public.projetos%rowtype := jsonb_populate_record(null::public.projetos, p_projeto);
begin
  if p_projeto ? 'abreviacao' then
    p.abreviacao := btrim(p.abreviacao);
    if p.abreviacao is null or p.abreviacao = '' then
      raise exception 'Informe a abreviação do projeto' using errcode = '23514';
    end if;
  end if;

  if p_editar then
    update public.projetos set cliente_id = p.cliente_id, nome = p.nome, descricao = p.descricao,
      abreviacao = coalesce(p.abreviacao, abreviacao),
      prazo = p.prazo, link_google_maps_original = p.link_google_maps_original, utm_easting = p.utm_easting,
      utm_northing = p.utm_northing, utm_zona = p.utm_zona, utm_hemisferio = p.utm_hemisferio,
      datum = p.datum, latitude = p.latitude, longitude = p.longitude
    where id = p.id and excluido_em is null and atualizado_em = p_atualizado_em;
    if not found then raise exception 'Projeto indisponível ou atualizado por outro usuário' using errcode = '40001'; end if;
  else
    insert into public.projetos (id, cliente_id, nome, descricao, abreviacao, prazo, link_google_maps_original,
      utm_easting, utm_northing, utm_zona, utm_hemisferio, datum, latitude, longitude)
    values (p.id, p.cliente_id, p.nome, p.descricao, p.abreviacao, p.prazo, p.link_google_maps_original,
      p.utm_easting, p.utm_northing, p.utm_zona, p.utm_hemisferio, p.datum, p.latitude, p.longitude);
  end if;

  update public.projeto_arquivos_geograficos set excluido_em = now()
    where projeto_id = p.id and id = any(p_remover) and excluido_em is null;
  insert into public.projeto_arquivos_geograficos (id, projeto_id, nome_original, formato, tamanho_bytes,
    storage_path, metadados, quantidade_pontos, quantidade_linhas, quantidade_poligonos, limites_geograficos, visivel)
  select a.id, p.id, a.nome_original, a.formato, a.tamanho_bytes, a.storage_path, a.metadados,
    a.quantidade_pontos, a.quantidade_linhas, a.quantidade_poligonos, a.limites_geograficos, a.visivel
  from jsonb_populate_recordset(null::public.projeto_arquivos_geograficos, p_adicionar) a;
  return (select to_jsonb(t) from public.projetos t where t.id = p.id);
end $$;
create or replace function delta_cortex_private.proximo_numero_relatorio(p_projeto text)
returns bigint language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or p_projeto is null or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or not delta_cortex_private.acesso_projeto(p_projeto, true) then
    raise exception 'Projeto indisponível para emissão de relatório' using errcode = '42501';
  end if;
  return (
    select coalesce(max((regexp_match(r.nome_arquivo, '^RAS-([0-9]{1,9})-[0-9]{4}( - .+)?\.pdf$'))[1]::bigint), 0) + 1
    from public.visitas_sistematicas_relatorios r join public.visitas_sistematicas v on v.id = r.visita_id
    where v.projeto_id = p_projeto
  );
end $$;

create or replace function delta_cortex_private.validar_numero_relatorio()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  projeto text := delta_cortex_private.projeto_visita(new.visita_id);
  codigo text[] := regexp_match(new.nome_arquivo, '^RAS-([0-9]{1,9})-([0-9]{4})( - .+)?\.pdf$');
begin
  if auth.uid() is null or projeto is null or not delta_cortex_private.acesso_projeto(projeto, true)
    or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico') then
    raise exception 'Projeto indisponível para emissão de relatório' using errcode = '42501';
  end if;
  -- Os nomes antigos continuam válidos durante a transição.
  if codigo is null then return new; end if;
  if codigo[1]::bigint < 1 then raise exception 'Número de relatório inválido' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended('delta-cortex-ras:' || projeto, 0));
  if exists (
    select 1 from public.visitas_sistematicas_relatorios r join public.visitas_sistematicas v on v.id = r.visita_id
    cross join lateral regexp_match(r.nome_arquivo, '^RAS-([0-9]{1,9})-([0-9]{4})( - .+)?\.pdf$') as anterior(partes)
    where v.projeto_id = projeto and anterior.partes[1]::bigint = codigo[1]::bigint and anterior.partes[2] = codigo[2]
      and (r.excluido_em is null or r.visita_id <> new.visita_id)
  ) then
    raise exception 'Este código de relatório já foi usado no projeto' using errcode = 'PDC03';
  end if;
  return new;
end $$;
commit;
