begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'atribuicao'
  ) then
    raise exception 'Aplique primeiro a migration de atribuição dos profissionais';
  end if;
end $$;

alter table public.acessos_usuarios drop constraint acessos_usuarios_papel_check;
alter table public.acessos_usuarios
  add constraint acessos_usuarios_papel_check check (papel in ('admin','editor','leitor','cliente','tecnico')),
  add column nome_exibicao text,
  add column profissional_id text references public.profissionais(id),
  add column convidado_em timestamptz;
create unique index acessos_profissional_vinculado on public.acessos_usuarios(profissional_id) where profissional_id is not null;
revoke insert, update, delete, truncate on public.acessos_usuarios from public, anon, authenticated;
revoke select on public.acessos_usuarios from public, anon;
alter table public.acessos_usuarios enable row level security;
create policy delta_acesso_proprio on public.acessos_usuarios as restrictive for select to authenticated
  using (user_id = (select auth.uid()));

create table public.usuarios_projetos (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  projeto_id text not null references public.projetos(id),
  autorizado_por uuid references auth.users(id) on delete set null,
  autorizado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  revogado_em timestamptz,
  primary key (usuario_id, projeto_id)
);
create index on public.usuarios_projetos (projeto_id, usuario_id) where revogado_em is null;
alter table public.usuarios_projetos enable row level security;
revoke all on public.usuarios_projetos from public, anon, authenticated;

create table delta_cortex_private.administracao_config (
  id boolean primary key default true check (id),
  externo_habilitado boolean not null default false
);
insert into delta_cortex_private.administracao_config default values;
create table delta_cortex_private.auditoria_acessos (
  id bigint generated always as identity primary key,
  autor_id uuid not null,
  usuario_id uuid not null,
  operacao text not null,
  projeto_id text,
  ocorrido_em timestamptz not null default clock_timestamp(),
  alteracao jsonb
);
alter table delta_cortex_private.administracao_config enable row level security;
alter table delta_cortex_private.auditoria_acessos enable row level security;
revoke all on delta_cortex_private.administracao_config, delta_cortex_private.auditoria_acessos from public, anon, authenticated;

create function delta_cortex_private.perfil_efetivo()
returns text language sql stable security definer set search_path = ''
as $$
  select a.papel from public.acessos_usuarios a join auth.users u on u.id = a.user_id
  where a.user_id = (select auth.uid()) and a.ativo and u.deleted_at is null
    and (a.papel in ('admin','editor','leitor') or (
      (select externo_habilitado from delta_cortex_private.administracao_config where id)
      and u.email_confirmed_at is not null
    ))
$$;

create function delta_cortex_private.acesso_projeto(p_projeto text, p_operar boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(case delta_cortex_private.perfil_efetivo()
    when 'admin' then true when 'editor' then true when 'leitor' then not p_operar
    when 'cliente' then not p_operar and existe when 'tecnico' then existe else false end, false)
  from (select exists (
    select 1 from public.usuarios_projetos a join public.projetos p on p.id = a.projeto_id
    where a.usuario_id = (select auth.uid()) and a.projeto_id = p_projeto
      and a.revogado_em is null and p.excluido_em is null
  ) as existe) t
$$;

create function delta_cortex_private.projeto_visita(p_visita text)
returns text language sql stable security definer set search_path = ''
as $$
  select v.projeto_id from public.visitas_sistematicas v where v.id = p_visita and v.excluido_em is null
    and delta_cortex_private.acesso_projeto(v.projeto_id)
$$;

create function public.delta_cortex_perfil_efetivo()
returns text language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.perfil_efetivo() $$;

-- As restrições são combinadas com qualquer política permissiva anterior.
do $$
declare tabela text; leitura text; escrita text;
begin
  foreach tabela in array array['clientes','profissionais','profissionais_dados_bancarios','projetos'] loop
    execute format('alter table public.%I enable row level security', tabela);
    leitura := case when tabela = 'projetos' then 'delta_cortex_private.acesso_projeto(id)'
      when tabela = 'profissionais_dados_bancarios' then '(select delta_cortex_private.perfil_efetivo()) = ''admin'''
      else '(select delta_cortex_private.perfil_efetivo()) in (''admin'',''editor'',''leitor'')' end;
    escrita := case when tabela = 'profissionais_dados_bancarios' then '(select delta_cortex_private.perfil_efetivo()) = ''admin'''
      else '(select delta_cortex_private.perfil_efetivo()) in (''admin'',''editor'')' end;
    execute format('create policy delta_perfil_leitura on public.%I as restrictive for select to authenticated using (%s)', tabela, leitura);
    execute format('create policy delta_perfil_insercao on public.%I as restrictive for insert to authenticated with check (%s)', tabela, escrita);
    execute format('create policy delta_perfil_atualizacao on public.%I as restrictive for update to authenticated using (%s) with check (%s)', tabela, escrita, escrita);
    execute format('revoke all on public.%I from public, anon', tabela);
    execute format('revoke delete, truncate on public.%I from authenticated', tabela);
  end loop;
end $$;
create policy delta_projetos_designados on public.projetos for select to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) in ('cliente','tecnico') and delta_cortex_private.acesso_projeto(id));

do $$
declare tabela text; projeto text; leitura text; gravacao text;
begin
  foreach tabela in array array['visitas_sistematicas','visitas_sistematicas_registros','visitas_sistematicas_eventos',
    'visitas_sistematicas_fotografias','visitas_sistematicas_relatorios','projeto_arquivos_geograficos'] loop
    execute format('alter table public.%I enable row level security', tabela);
    projeto := case when tabela in ('visitas_sistematicas_fotografias','visitas_sistematicas_relatorios')
      then 'delta_cortex_private.projeto_visita(visita_id)' else 'projeto_id' end;
    leitura := format('((select delta_cortex_private.perfil_efetivo()) in (''admin'',''editor'',''leitor'') or
      ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and %s and delta_cortex_private.acesso_projeto(%s)))',
      case when tabela = 'visitas_sistematicas_relatorios' then 'false' else 'true' end, projeto);
    gravacao := format('((select delta_cortex_private.perfil_efetivo()) in (''admin'',''editor'') or
      ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and %s and delta_cortex_private.acesso_projeto(%s, true)))',
      case when tabela in ('visitas_sistematicas','visitas_sistematicas_registros','visitas_sistematicas_fotografias') then 'true' else 'false' end, projeto);
    execute format('create policy delta_escopo_leitura on public.%I as restrictive for select to authenticated using (%s)', tabela, leitura);
    execute format('create policy delta_escopo_insercao on public.%I as restrictive for insert to authenticated with check (%s)', tabela, gravacao);
    execute format('create policy delta_escopo_atualizacao on public.%I as restrictive for update to authenticated using (%s) with check (%s)', tabela, gravacao, gravacao);
    execute format('create policy delta_tecnico_leitura on public.%I for select to authenticated using ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and %s)', tabela, leitura);
    if tabela in ('visitas_sistematicas','visitas_sistematicas_registros','visitas_sistematicas_fotografias') then
      execute format('create policy delta_tecnico_insercao on public.%I for insert to authenticated with check ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and criado_por = (select auth.uid()) and %s)', tabela, gravacao);
      execute format('create policy delta_tecnico_atualizacao on public.%I for update to authenticated using ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and %s) with check ((select delta_cortex_private.perfil_efetivo()) = ''tecnico'' and %s)', tabela, gravacao, gravacao);
    end if;
    execute format('revoke all on public.%I from public, anon', tabela);
    execute format('revoke delete, truncate on public.%I from authenticated', tabela);
  end loop;
end $$;

-- A trigger usa dados protegidos somente para preencher snapshots de uma visita autorizada.
create or replace function delta_cortex_private.preparar_visita()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare vinculado text;
begin
  if not delta_cortex_private.acesso_projeto(new.projeto_id, true) or new.criado_por is distinct from auth.uid() then
    raise exception 'Projeto indisponível para registro' using errcode = '42501';
  end if;
  if delta_cortex_private.perfil_efetivo() = 'tecnico' then
    select profissional_id into vinculado from public.acessos_usuarios where user_id = auth.uid();
    if vinculado is not null and vinculado <> new.executor_id then
      raise exception 'O executor deve corresponder ao profissional vinculado' using errcode = '42501';
    end if;
    new.status := 'em_andamento'; new.excluido_em := null; new.finalizada_em := null;
  end if;
  select nome into strict new.projeto_nome_snapshot from public.projetos
    where id = new.projeto_id and cliente_id = new.cliente_id and excluido_em is null for share;
  select nome_razao_social into strict new.cliente_nome_snapshot from public.clientes
    where id = new.cliente_id and excluido_em is null for share;
  select nome into strict new.executor_nome_snapshot from public.profissionais
    where id = new.executor_id and excluido_em is null for share;
  select nome into strict new.responsavel_tecnico_nome_snapshot from public.profissionais
    where id = new.responsavel_tecnico_id and excluido_em is null for share;
  return new;
exception when no_data_found then
  raise exception 'Projeto, contratante ou profissional indisponível' using errcode = '23503';
end $$;
revoke all on function delta_cortex_private.preparar_visita() from public, anon, authenticated;

create function delta_cortex_private.foto_tecnico(p_bucket text, p_nome text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select p_bucket = 'delta-cortex-visitas-sistematicas'
    and p_nome ~ '^[^/]+/fotografias/[^/]+/[^/]+\.(jpeg|png|webp)$'
    and delta_cortex_private.acesso_projeto(delta_cortex_private.projeto_visita(split_part(p_nome,'/',1)), true)
$$;

alter policy delta_cortex_arquivos_isolamento on storage.objects
using (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (select delta_cortex_private.perfil_efetivo()) in ('admin','editor','leitor','tecnico'))
with check (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (select delta_cortex_private.perfil_efetivo()) in ('admin','editor')
  or ((select delta_cortex_private.perfil_efetivo()) = 'tecnico' and delta_cortex_private.foto_tecnico(bucket_id,name)));

alter policy delta_cortex_arquivos_leitura_restrita on storage.objects
using (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (bucket_id = 'delta-cortex-geograficos' and exists (
    select 1 from public.projeto_arquivos_geograficos a where a.storage_path = name
      and a.excluido_em is null and a.status_processamento = 'pronto'))
  or (bucket_id = 'delta-cortex-visitas-sistematicas' and (
    exists (select 1 from public.visitas_sistematicas_fotografias f where f.storage_path = name and f.excluido_em is null)
    or exists (select 1 from public.visitas_sistematicas_relatorios r where r.storage_path = name)))
  or (owner_id = (select auth.uid())::text and (
    (select delta_cortex_private.perfil_efetivo()) in ('admin','editor')
    or ((select delta_cortex_private.perfil_efetivo()) = 'tecnico' and delta_cortex_private.foto_tecnico(bucket_id,name))))
);

alter policy delta_cortex_arquivos_upload_restrito on storage.objects
with check (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (owner_id = (select auth.uid())::text and ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor')
    or ((select delta_cortex_private.perfil_efetivo()) = 'tecnico' and delta_cortex_private.foto_tecnico(bucket_id,name)))));

alter policy delta_cortex_arquivos_limpar_pendentes on storage.objects
using (bucket_id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  and owner_id = (select auth.uid())::text and not delta_cortex_private.objeto_referenciado(bucket_id,name)
  and ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor')
    or ((select delta_cortex_private.perfil_efetivo()) = 'tecnico' and delta_cortex_private.foto_tecnico(bucket_id,name))));

alter policy delta_cortex_arquivos_proteger_referencias on storage.objects
using (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (owner_id = (select auth.uid())::text and not delta_cortex_private.objeto_referenciado(bucket_id,name)
  and ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor')
    or ((select delta_cortex_private.perfil_efetivo()) = 'tecnico' and delta_cortex_private.foto_tecnico(bucket_id,name)))));
create function delta_cortex_private.contexto_restrito()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare papel text := delta_cortex_private.perfil_efetivo();
begin
  if papel is null or papel not in ('cliente','tecnico') then
    raise exception 'Acesso indisponível' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nomeRazaoSocial', c.nome_razao_social))
      from public.clientes c where exists (
        select 1 from public.projetos p where p.cliente_id = c.id and delta_cortex_private.acesso_projeto(p.id))), '[]'),
    'profissionalId', (select profissional_id from public.acessos_usuarios where user_id = auth.uid()),
    'profissionais', case when papel = 'tecnico' then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome)
      from public.profissionais p where p.excluido_em is null
        and exists (select 1 from public.usuarios_projetos a where a.usuario_id = auth.uid()
          and a.revogado_em is null and delta_cortex_private.acesso_projeto(a.projeto_id))
    ), '[]') else '[]' end);
end $$;

create function public.delta_cortex_contexto_restrito()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.contexto_restrito() $$;

-- O portal só recebe a projeção necessária ao mapa, sem autores, visitas, documentos ou fotografias.
create function delta_cortex_private.ocorrencias_portal(p_projeto text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if delta_cortex_private.perfil_efetivo() is distinct from 'cliente'
      or not delta_cortex_private.acesso_projeto(p_projeto) then
    raise exception 'Projeto indisponível' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'projetoId', r.projeto_id, 'visitaId', '', 'tipo', r.tipo, 'meio', r.meio_ambiental,
    'descricao', r.descricao, 'gravidade', r.gravidade, 'situacao', r.situacao, 'latitude', r.latitude,
    'longitude', r.longitude, 'utmZona', r.utm_zona, 'utmHemisferio', r.utm_hemisferio,
    'utmEasting', r.utm_easting, 'utmNorthing', r.utm_northing, 'referenciaGeodesica', r.referencia_geodesica,
    'registradoEm', r.registrado_em
  ) order by r.registrado_em desc) from public.visitas_sistematicas_registros r
    join public.visitas_sistematicas v on v.id = r.visita_origem_id and v.excluido_em is null
    where r.projeto_id = p_projeto and r.tipo = 'Ocorrencia' and r.excluido_em is null), '[]');
end $$;

create function public.delta_cortex_ocorrencias_portal(p_projeto text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.ocorrencias_portal(p_projeto) $$;

create function delta_cortex_private.exigir_admin()
returns void language plpgsql stable security invoker set search_path = ''
as $$
begin
  if delta_cortex_private.perfil_efetivo() is distinct from 'admin' then
    raise exception 'Administração indisponível' using errcode = '42501';
  end if;
end $$;

create function delta_cortex_private.listar_usuarios_admin()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform delta_cortex_private.exigir_admin();
  return jsonb_build_object(
    'externoHabilitado', (select externo_habilitado from delta_cortex_private.administracao_config where id),
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'nome', a.nome_exibicao, 'papel', a.papel,
      'ativo', a.ativo, 'confirmado', u.email_confirmed_at is not null, 'convidadoEm', a.convidado_em,
      'profissionalId', a.profissional_id,
      'projetos', coalesce((select jsonb_agg(p.projeto_id order by p.projeto_id) from public.usuarios_projetos p
        where p.usuario_id = u.id and p.revogado_em is null), '[]')
    ) order by coalesce(a.nome_exibicao,u.email)) from public.acessos_usuarios a join auth.users u on u.id = a.user_id), '[]')
  );
end $$;

create function public.delta_cortex_listar_usuarios_admin()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.listar_usuarios_admin() $$;

create function delta_cortex_private.usuario_auth_admin(p_email text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
begin
  perform delta_cortex_private.exigir_admin();
  return (select id from auth.users where lower(email) = lower(p_email) and deleted_at is null);
end $$;
create function public.delta_cortex_usuario_auth_admin(p_email text)
returns uuid language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.usuario_auth_admin(p_email) $$;

create function delta_cortex_private.salvar_usuario_admin(
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
        and (u.email_confirmed_at is not null or a.convidado_em is null)) then
    raise exception 'O último administrador ativo deve ser preservado' using errcode = '23514';
  end if;

  insert into public.acessos_usuarios (user_id,nome_exibicao,papel,ativo,profissional_id,convidado_em)
  values (p_usuario,btrim(p_nome),p_papel,p_ativo,p_profissional,case when p_convite then now() end)
  on conflict (user_id) do update set nome_exibicao = excluded.nome_exibicao, papel = excluded.papel,
    ativo = excluded.ativo, profissional_id = excluded.profissional_id;
  insert into delta_cortex_private.auditoria_acessos(autor_id,usuario_id,operacao,alteracao)
  values (autor,p_usuario,case when p_novo and p_convite then 'convite' when p_novo then 'vincular_conta' else 'editar' end,
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

create function public.delta_cortex_salvar_usuario_admin(
  p_usuario uuid, p_nome text, p_papel text, p_ativo boolean, p_profissional text,
  p_projetos text[], p_novo boolean, p_confirmar boolean, p_convite boolean
) returns void language sql security invoker set search_path = ''
as $$ select delta_cortex_private.salvar_usuario_admin(p_usuario,p_nome,p_papel,p_ativo,p_profissional,p_projetos,p_novo,p_confirmar,p_convite) $$;

-- Concessões específicas. O schema privado não deve constar entre os schemas da Data API.
do $$
declare assinatura text;
begin
  foreach assinatura in array array[
    'delta_cortex_private.perfil_efetivo()', 'delta_cortex_private.acesso_projeto(text,boolean)',
    'delta_cortex_private.projeto_visita(text)', 'delta_cortex_private.foto_tecnico(text,text)',
    'delta_cortex_private.contexto_restrito()', 'delta_cortex_private.ocorrencias_portal(text)',
    'delta_cortex_private.listar_usuarios_admin()', 'delta_cortex_private.usuario_auth_admin(text)',
    'delta_cortex_private.salvar_usuario_admin(uuid,text,text,boolean,text,text[],boolean,boolean,boolean)',
    'public.delta_cortex_perfil_efetivo()', 'public.delta_cortex_contexto_restrito()', 'public.delta_cortex_ocorrencias_portal(text)',
    'public.delta_cortex_listar_usuarios_admin()', 'public.delta_cortex_usuario_auth_admin(text)',
    'public.delta_cortex_salvar_usuario_admin(uuid,text,text,boolean,text,text[],boolean,boolean,boolean)'
  ] loop
    execute 'revoke all on function ' || assinatura || ' from public, anon, authenticated';
    execute 'grant execute on function ' || assinatura || ' to authenticated';
  end loop;
end $$;
revoke all on function delta_cortex_private.exigir_admin() from public, anon, authenticated;

create or replace function delta_cortex_private.mudar_situacao_ocorrencia(
  p_registro_id text, p_visita_id text, p_situacao text, p_versao bigint
)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  registro public.visitas_sistematicas_registros%rowtype;
  visita public.visitas_sistematicas%rowtype;
begin
  if coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  if p_situacao is null or p_situacao not in ('em_aberto', 'resolvido') or p_versao is null then
    raise exception 'Situação ou versão inválida' using errcode = '22023';
  end if;
  select * into strict visita from public.visitas_sistematicas
    where id = p_visita_id and excluido_em is null and status = 'em_andamento'
      and delta_cortex_private.acesso_projeto(projeto_id, true) for share;
  select * into strict registro from public.visitas_sistematicas_registros
    where id = p_registro_id and projeto_id = visita.projeto_id and tipo = 'Ocorrencia'
      and excluido_em is null for update;
  if registro.versao <> p_versao then
    raise exception 'A ocorrência foi alterada. Atualize a consulta antes de tentar novamente.' using errcode = '40001';
  end if;
  if registro.situacao = p_situacao then return registro.versao; end if;
  update public.visitas_sistematicas_registros set situacao = p_situacao, versao = versao + 1 where id = registro.id;
  insert into public.visitas_sistematicas_eventos (
    registro_id, visita_id, projeto_id, situacao_anterior, nova_situacao, profissional_id, profissional_nome_snapshot
  ) values (
    registro.id, visita.id, visita.projeto_id, registro.situacao, p_situacao, visita.executor_id, visita.executor_nome_snapshot
  );
  return registro.versao + 1;
end $$;

commit;
