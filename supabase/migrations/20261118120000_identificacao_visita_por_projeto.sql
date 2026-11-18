begin;

create function delta_cortex_private.proximo_numero_visita(p_projeto text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare numero bigint;
begin
  if auth.uid() is null or p_projeto is null
    or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or not coalesce(delta_cortex_private.acesso_projeto(p_projeto, true), false) then
    raise exception 'Projeto indisponível para iniciar trabalho' using errcode = '42501';
  end if;
  -- A data de criação define o último trabalho cadastrado, incluindo os excluídos.
  select (regexp_match(v.identificacao, '^AS-([0-9]{1,18})-[0-9]{4}$'))[1]::bigint
    into numero from public.visitas_sistematicas v
    where v.projeto_id = p_projeto and v.identificacao ~ '^AS-[0-9]{1,18}-[0-9]{4}$'
    order by v.criado_em desc, v.id desc limit 1;
  return coalesce(numero, 0) + 1;
end $$;

create function public.delta_cortex_proximo_numero_visita(p_projeto text)
returns bigint language sql security invoker set search_path = ''
as $$ select delta_cortex_private.proximo_numero_visita(p_projeto) $$;
revoke all on function delta_cortex_private.proximo_numero_visita(text),
  public.delta_cortex_proximo_numero_visita(text) from public, anon, authenticated;
grant execute on function delta_cortex_private.proximo_numero_visita(text),
  public.delta_cortex_proximo_numero_visita(text) to authenticated;

create or replace function delta_cortex_private.numerar_acompanhamento()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  ano integer := extract(year from new.data_visita)::integer;
  numero bigint;
  partes text[];
begin
  if auth.uid() is null
    or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or not coalesce(delta_cortex_private.acesso_projeto(new.projeto_id, true), false) then
    raise exception 'Projeto indisponível para registro' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.criado_por is distinct from auth.uid() then
    raise exception 'Autor inválido' using errcode = '42501';
  end if;
  if ano is null or ano not between 1 and 9999 then
    raise exception 'Data da visita inválida' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('delta-cortex-as:' || new.projeto_id, 0));
  if tg_op = 'INSERT' and nullif(btrim(new.identificacao), '') is null then
    numero := delta_cortex_private.proximo_numero_visita(new.projeto_id);
    -- Avança sobre códigos ocupados se um número manual tiver reiniciado a sequência.
    while exists (
      select 1 from public.visitas_sistematicas v
      cross join lateral regexp_match(v.identificacao, '^AS-([0-9]{1,18})-([0-9]{4})$') as codigo(p)
      where v.projeto_id = new.projeto_id and codigo.p[1]::bigint = numero and codigo.p[2]::integer = ano
    ) loop
      numero := numero + 1;
    end loop;
  else
    partes := regexp_match(new.identificacao, '^AS-([0-9]{1,9})-([0-9]{4})$');
    if partes is null or partes[1]::bigint < 1 or partes[2]::integer <> ano then
      raise exception 'Informe um número positivo de até nove dígitos' using errcode = '23514';
    end if;
    numero := partes[1]::bigint;
  end if;
  if exists (
    select 1 from public.visitas_sistematicas v
    cross join lateral regexp_match(v.identificacao, '^AS-([0-9]{1,18})-([0-9]{4})$') as codigo(p)
    where v.projeto_id = new.projeto_id and v.id <> new.id
      and codigo.p[1]::bigint = numero and codigo.p[2]::integer = ano
  ) then
    raise exception 'Esta identificação já existe no projeto' using errcode = 'PDC04';
  end if;
  new.identificacao := 'AS-' || lpad(numero::text, greatest(3, length(numero::text)), '0')
    || '-' || lpad(ano::text, 4, '0');
  return new;
end $$;

create trigger delta_cortex_validar_edicao_identificacao
  before update of identificacao on public.visitas_sistematicas
  for each row when (old.identificacao is distinct from new.identificacao)
  execute function delta_cortex_private.numerar_acompanhamento();

-- A RPC valida o perfil, o projeto e a versão antes de atualizar apenas a identificação.
create function delta_cortex_private.editar_identificacao_visita(p_visita text, p_numero bigint, p_atualizado_em timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare visita public.visitas_sistematicas%rowtype;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico')
    or p_numero is null or p_numero not between 1 and 999999999 then
    raise exception 'Número ou acesso inválido' using errcode = '42501';
  end if;
  select * into visita from public.visitas_sistematicas v
    where v.id = p_visita and v.excluido_em is null
      and delta_cortex_private.acesso_projeto(v.projeto_id, true) for update;
  if not found then raise exception 'Trabalho indisponível' using errcode = '42501'; end if;
  if visita.atualizado_em is distinct from p_atualizado_em then
    raise exception 'O trabalho mudou. Atualize a lista' using errcode = '40001';
  end if;
  update public.visitas_sistematicas set
    identificacao = 'AS-' || p_numero::text || '-' || lpad(extract(year from visita.data_visita)::text, 4, '0')
    where id = visita.id returning * into visita;
  return to_jsonb(visita);
end $$;

create function public.delta_cortex_editar_identificacao_visita(p_visita text, p_numero bigint, p_atualizado_em timestamptz)
returns jsonb language sql security invoker set search_path = ''
as $$ select delta_cortex_private.editar_identificacao_visita(p_visita, p_numero, p_atualizado_em) $$;
revoke all on function delta_cortex_private.editar_identificacao_visita(text,bigint,timestamptz),
  public.delta_cortex_editar_identificacao_visita(text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function delta_cortex_private.editar_identificacao_visita(text,bigint,timestamptz),
  public.delta_cortex_editar_identificacao_visita(text,bigint,timestamptz) to authenticated;

commit;
