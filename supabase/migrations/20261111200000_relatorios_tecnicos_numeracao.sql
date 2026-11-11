begin;

create function delta_cortex_private.pode_gerir_relatorio(p_visita text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from (select delta_cortex_private.projeto_visita(p_visita) as projeto) v
    where v.projeto is not null and delta_cortex_private.perfil_efetivo() in ('admin', 'tecnico')
      and delta_cortex_private.acesso_projeto(v.projeto, true)
  );
$$;
revoke all on function delta_cortex_private.pode_gerir_relatorio(text) from public, anon, authenticated;
grant execute on function delta_cortex_private.pode_gerir_relatorio(text) to authenticated;

alter policy delta_escopo_leitura on public.visitas_sistematicas_relatorios
  using ((select delta_cortex_private.perfil_efetivo()) in ('admin', 'editor', 'leitor')
    or delta_cortex_private.pode_gerir_relatorio(visita_id));
alter policy delta_tecnico_leitura on public.visitas_sistematicas_relatorios
  using ((select delta_cortex_private.perfil_efetivo()) = 'tecnico'
    and delta_cortex_private.pode_gerir_relatorio(visita_id));
alter policy delta_escopo_insercao on public.visitas_sistematicas_relatorios
  with check ((select delta_cortex_private.perfil_efetivo()) in ('admin', 'editor')
    or delta_cortex_private.pode_gerir_relatorio(visita_id));
create policy delta_tecnico_inserir_relatorio on public.visitas_sistematicas_relatorios
  for insert to authenticated
  with check ((select delta_cortex_private.perfil_efetivo()) = 'tecnico'
    and delta_cortex_private.pode_gerir_relatorio(visita_id) and criado_por = (select auth.uid()));

alter policy delta_escopo_atualizacao on public.visitas_sistematicas_relatorios
  using (delta_cortex_private.pode_gerir_relatorio(visita_id))
  with check (delta_cortex_private.pode_gerir_relatorio(visita_id));
alter policy delta_admin_arquiva_relatorio on public.visitas_sistematicas_relatorios
  using (delta_cortex_private.pode_gerir_relatorio(visita_id) and excluido_em is null)
  with check (delta_cortex_private.pode_gerir_relatorio(visita_id) and excluido_em is not null);
alter policy delta_somente_admin_arquiva_relatorio on public.visitas_sistematicas_relatorios
  using (delta_cortex_private.pode_gerir_relatorio(visita_id) and excluido_em is null)
  with check (delta_cortex_private.pode_gerir_relatorio(visita_id) and excluido_em is not null);

-- As políticas de armazenamento chamam esta função para validar o caminho do arquivo.
create or replace function delta_cortex_private.foto_tecnico(p_bucket text, p_nome text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select p_bucket = 'delta-cortex-visitas-sistematicas' and (
    (p_nome ~ '^[^/]+/fotografias/[^/]+/[^/]+\.(jpeg|png|webp)$'
      and delta_cortex_private.acesso_projeto(delta_cortex_private.projeto_visita(split_part(p_nome,'/',1)), true))
    or (p_nome ~ '^[^/]+/relatorios/[^/]+/[^/]+\.pdf$'
      and delta_cortex_private.pode_gerir_relatorio(split_part(p_nome,'/',1)))
  );
$$;

create function delta_cortex_private.proximo_numero_relatorio(p_projeto text)
returns bigint language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or p_projeto is null or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or not delta_cortex_private.acesso_projeto(p_projeto, true) then
    raise exception 'Projeto indisponível para emissão de relatório' using errcode = '42501';
  end if;
  return (
    select coalesce(max((regexp_match(r.nome_arquivo, '^RAS-([0-9]{1,9})-[0-9]{4}\.pdf$'))[1]::bigint), 0) + 1
    from public.visitas_sistematicas_relatorios r join public.visitas_sistematicas v on v.id = r.visita_id
    where v.projeto_id = p_projeto
  );
end $$;

create function public.delta_cortex_proximo_numero_relatorio(p_projeto text)
returns bigint language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.proximo_numero_relatorio(p_projeto) $$;
revoke all on function delta_cortex_private.proximo_numero_relatorio(text),
  public.delta_cortex_proximo_numero_relatorio(text) from public, anon, authenticated;
grant execute on function delta_cortex_private.proximo_numero_relatorio(text),
  public.delta_cortex_proximo_numero_relatorio(text) to authenticated;

create function delta_cortex_private.validar_numero_relatorio()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  projeto text := delta_cortex_private.projeto_visita(new.visita_id);
  codigo text[] := regexp_match(new.nome_arquivo, '^RAS-([0-9]{1,9})-([0-9]{4})\.pdf$');
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
    cross join lateral regexp_match(r.nome_arquivo, '^RAS-([0-9]{1,9})-([0-9]{4})\.pdf$') as anterior(partes)
    where v.projeto_id = projeto and anterior.partes[1]::bigint = codigo[1]::bigint and anterior.partes[2] = codigo[2]
      and (r.excluido_em is null or r.visita_id <> new.visita_id)
  ) then
    raise exception 'Este código de relatório já foi usado no projeto' using errcode = 'PDC03';
  end if;
  return new;
end $$;
revoke all on function delta_cortex_private.validar_numero_relatorio() from public, anon, authenticated;
create trigger delta_cortex_validar_numero_relatorio before insert on public.visitas_sistematicas_relatorios
  for each row execute function delta_cortex_private.validar_numero_relatorio();

create or replace function public.delta_cortex_excluir_relatorio(p_id text)
returns text language plpgsql security invoker set search_path = ''
as $$
declare removido text;
begin
  if coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'tecnico') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  update public.visitas_sistematicas_relatorios set excluido_em = now()
    where id = p_id and excluido_em is null and delta_cortex_private.pode_gerir_relatorio(visita_id) returning id into removido;
  if removido is null then
    raise exception 'Relatório indisponível ou alterado por outro usuário' using errcode = '40001';
  end if;
  return removido;
end $$;

create or replace function public.delta_cortex_substituir_relatorio(p_original text, p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare substituido text;
begin
  if not delta_cortex_private.pode_gerir_relatorio(p_relatorio->>'visita_id') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  perform 1 from public.visitas_sistematicas where id = p_relatorio->>'visita_id'
    and status in ('em_andamento', 'concluida') and excluido_em is null for update;
  if not found then
    raise exception 'Visita indisponível para emissão de relatório' using errcode = '23503';
  end if;
  update public.visitas_sistematicas_relatorios set excluido_em = now()
    where id = p_original and visita_id = p_relatorio->>'visita_id' and excluido_em is null
    returning id into substituido;
  if substituido is null then
    raise exception 'Relatório indisponível ou alterado por outro usuário' using errcode = '40001';
  end if;
  return public.delta_cortex_adicionar_relatorio(p_relatorio);
end $$;

create or replace function public.delta_cortex_emitir_relatorio_visita(p_original text, p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  visita text := p_relatorio->>'visita_id';
  atual text;
begin
  if coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or (delta_cortex_private.perfil_efetivo() = 'tecnico' and not delta_cortex_private.pode_gerir_relatorio(visita)) then
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

create or replace function delta_cortex_private.revisar_relatorio(p_original text, p_relatorio jsonb, p_textos jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  original public.visitas_sistematicas_relatorios%rowtype;
  novo public.visitas_sistematicas_relatorios%rowtype;
  registro public.visitas_sistematicas_registros%rowtype;
  texto record;
  revisao_id text;
begin
  if not delta_cortex_private.pode_gerir_relatorio(p_relatorio->>'visita_id') then
    raise exception 'Operação não autorizada' using errcode = '42501';
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
    select * into registro from public.visitas_sistematicas_registros where id = texto.id and projeto_id = delta_cortex_private.projeto_visita(novo.visita_id) for update;
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

commit;
