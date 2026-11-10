begin;

create table delta_cortex_private.senhas_provisorias (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  alterada_em timestamptz
);
alter table delta_cortex_private.senhas_provisorias enable row level security;
revoke all on delta_cortex_private.senhas_provisorias from public, anon, authenticated;

-- O marcador de criação vem exclusivamente da API administrativa do Auth.
create function delta_cortex_private.registrar_senha_provisoria()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_app_meta_data @> '{"delta_senha_provisoria":true}'::jsonb then
    insert into delta_cortex_private.senhas_provisorias (usuario_id) values (new.id);
  end if;
  return new;
end $$;

revoke all on function delta_cortex_private.registrar_senha_provisoria() from public, anon, authenticated;
create trigger delta_cortex_registrar_senha_provisoria
  after insert on auth.users
  for each row execute function delta_cortex_private.registrar_senha_provisoria();

create function public.delta_cortex_confirmar_troca_provisoria(p_usuario uuid)
returns boolean language sql security invoker set search_path = ''
as $$
  update delta_cortex_private.senhas_provisorias
    set alterada_em = coalesce(alterada_em, clock_timestamp())
    where usuario_id = p_usuario
    returning true;
$$;

revoke all on function public.delta_cortex_confirmar_troca_provisoria(uuid) from public, anon, authenticated;
grant execute on function public.delta_cortex_confirmar_troca_provisoria(uuid) to service_role;
grant usage on schema delta_cortex_private to service_role;
grant select, update (alterada_em) on delta_cortex_private.senhas_provisorias to service_role;

create function delta_cortex_private.estado_senha()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when p.alterada_em is null then 'pendente'
      when exists (select 1 from auth.sessions s
        where s.id = ((select auth.jwt())->>'session_id')::uuid
          and s.user_id = p.usuario_id and s.created_at >= p.alterada_em) then 'liberado'
      else 'sessao_anterior'
    end
    from delta_cortex_private.senhas_provisorias p
    where p.usuario_id = (select auth.uid())
  ), 'liberado');
$$;

create function public.delta_cortex_estado_senha()
returns text language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.estado_senha() $$;

revoke all on function delta_cortex_private.estado_senha(), public.delta_cortex_estado_senha()
  from public, anon, authenticated;
grant execute on function delta_cortex_private.estado_senha(), public.delta_cortex_estado_senha() to authenticated;

create or replace function delta_cortex_private.perfil_efetivo()
returns text language sql stable security definer set search_path = ''
as $$
  select a.papel from public.acessos_usuarios a join auth.users u on u.id = a.user_id
  where a.user_id = (select auth.uid()) and a.ativo and u.deleted_at is null
    and (select delta_cortex_private.estado_senha()) = 'liberado'
    and (a.papel in ('admin','editor','leitor') or (
      (select externo_habilitado from delta_cortex_private.administracao_config where id)
      and u.email_confirmed_at is not null
    ))
$$;

alter policy delta_acesso_proprio on public.acessos_usuarios
  using (user_id = (select auth.uid()) and (select delta_cortex_private.estado_senha()) = 'liberado');

create or replace function delta_cortex_private.listar_usuarios_admin()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform delta_cortex_private.exigir_admin();
  return jsonb_build_object(
    'externoHabilitado', (select externo_habilitado from delta_cortex_private.administracao_config where id),
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'nome', a.nome_exibicao, 'papel', a.papel,
      'ativo', a.ativo, 'confirmado', u.email_confirmed_at is not null, 'convidadoEm', a.convidado_em,
      'senhaPendente', exists (select 1 from delta_cortex_private.senhas_provisorias s
        where s.usuario_id = a.user_id and s.alterada_em is null),
      'profissionalId', a.profissional_id,
      'projetos', coalesce((select jsonb_agg(p.projeto_id order by p.projeto_id) from public.usuarios_projetos p
        where p.usuario_id = u.id and p.revogado_em is null), '[]')
    ) order by coalesce(a.nome_exibicao,u.email)) from public.acessos_usuarios a join auth.users u on u.id = a.user_id), '[]')
  );
end $$;

create or replace function delta_cortex_private.salvar_usuario_admin(
  p_usuario uuid, p_nome text, p_papel text, p_ativo boolean, p_profissional text,
  p_projetos text[], p_novo boolean, p_confirmar boolean, p_convite boolean
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  anterior public.acessos_usuarios%rowtype;
  autor uuid := auth.uid();
  projeto text;
  projetos text[] := coalesce(p_projetos, '{}');
  externo boolean;
begin
  perform delta_cortex_private.exigir_admin();
  -- Serializa mutações administrativas e revalida o autor depois da espera pelo lock.
  select externo_habilitado into externo from delta_cortex_private.administracao_config where id for update;
  perform delta_cortex_private.exigir_admin();
  select * into anterior from public.acessos_usuarios where user_id = p_usuario for update;
  if p_novo is distinct from (anterior.user_id is null) then
    raise exception 'O usuário já tem acesso cadastrado ou foi removido' using errcode = '23505';
  end if;
  if p_ativo is null or p_papel is null or p_papel not in ('admin','editor','leitor','cliente','tecnico')
      or (p_papel in ('editor','leitor') and p_papel is distinct from anterior.papel)
      or coalesce(length(btrim(p_nome)),0) not between 1 and 160 or cardinality(projetos) > 250
      or array_position(projetos,null) is not null or (p_profissional is not null and p_papel <> 'tecnico') then
    raise exception 'Dados administrativos inválidos' using errcode = '22023';
  end if;
  if p_ativo and p_papel in ('cliente','tecnico') and not externo then
    raise exception 'Acesso externo ainda bloqueado para validação' using errcode = '55000';
  end if;
  if p_papel not in ('cliente','tecnico') then projetos := '{}'; end if;
  if exists (select 1 from unnest(projetos) selecionado(id) where not exists (
      select 1 from public.projetos p where p.id = selecionado.id and (p.excluido_em is null or exists (
        select 1 from public.usuarios_projetos up where up.usuario_id = p_usuario
          and up.projeto_id = p.id and up.revogado_em is null))))
    or (p_profissional is not null and p_profissional is distinct from anterior.profissional_id and not exists (
      select 1 from public.profissionais where id = p_profissional and excluido_em is null)) then
    raise exception 'Projeto ou profissional indisponível' using errcode = '23503';
  end if;
  if (anterior.papel is distinct from p_papel and (p_papel = 'admin' or anterior.papel = 'admin'))
     or (anterior.ativo and not p_ativo)
     or exists (select 1 from public.usuarios_projetos where usuario_id = p_usuario and revogado_em is null
       and not (projeto_id = any(projetos))) then
    if not coalesce(p_confirmar,false) then raise exception 'Confirmação obrigatória' using errcode = '22023'; end if;
  end if;
  if anterior.papel = 'admin' and anterior.ativo and (p_papel <> 'admin' or not p_ativo)
    and not exists (select 1 from public.acessos_usuarios a join auth.users u on u.id = a.user_id
      where a.user_id <> p_usuario and a.papel = 'admin' and a.ativo and u.deleted_at is null
        and (u.email_confirmed_at is not null or a.convidado_em is null)
        and not exists (select 1 from delta_cortex_private.senhas_provisorias s
          where s.usuario_id = a.user_id and s.alterada_em is null)) then
    raise exception 'O último administrador ativo deve ser preservado' using errcode = '23514';
  end if;

  insert into public.acessos_usuarios (user_id,nome_exibicao,papel,ativo,profissional_id,convidado_em)
  values (p_usuario,btrim(p_nome),p_papel,p_ativo,p_profissional,case when p_convite then now() end)
  on conflict (user_id) do update set nome_exibicao = excluded.nome_exibicao, papel = excluded.papel,
    ativo = excluded.ativo, profissional_id = excluded.profissional_id;
  insert into delta_cortex_private.auditoria_acessos(autor_id,usuario_id,operacao,alteracao)
  values (autor,p_usuario,case
      when p_novo and exists (select 1 from delta_cortex_private.senhas_provisorias s where s.usuario_id = p_usuario)
        then 'criar_conta_manual'
      when p_novo and p_convite then 'convite'
      when p_novo then 'vincular_conta'
      else 'editar'
    end,
    jsonb_build_object('papelAnterior',anterior.papel,'papel',p_papel,'ativoAnterior',anterior.ativo,'ativo',p_ativo));

  for projeto in update public.usuarios_projetos set revogado_em = now(), atualizado_em = now()
      where usuario_id = p_usuario and revogado_em is null and not (projeto_id = any(projetos)) returning projeto_id loop
    insert into delta_cortex_private.auditoria_acessos(autor_id,usuario_id,operacao,projeto_id)
    values (autor,p_usuario,'revogar_projeto',projeto);
  end loop;
  for projeto in insert into public.usuarios_projetos(usuario_id,projeto_id,autorizado_por)
      select p_usuario, id, autor from (select distinct unnest(projetos) as id) selecionados
      on conflict (usuario_id,projeto_id) do update set revogado_em = null, autorizado_por = autor,
        autorizado_em = now(), atualizado_em = now() where usuarios_projetos.revogado_em is not null
      returning projeto_id loop
    insert into delta_cortex_private.auditoria_acessos(autor_id,usuario_id,operacao,projeto_id)
    values (autor,p_usuario,'autorizar_projeto',projeto);
  end loop;
end $$;

commit;
