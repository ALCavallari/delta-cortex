-- Revisar com o DDL do projeto znbfnayblyclavcjsbvg antes de aplicar.
begin;

do $$
declare tabela text;
begin
  foreach tabela in array array['clientes','projetos','profissionais'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tabela and column_name = 'id' and data_type = 'text'
    ) then
      raise exception 'Dependência incompatível: public.%.id deve ser TEXT', tabela;
    end if;
  end loop;
  if to_regclass('public.profissionais_dados_bancarios') is null
     or to_regclass('public.acessos_usuarios') is null then
    raise exception 'As tabelas de cadastros e acesso precisam existir';
  end if;
end $$;

create schema if not exists delta_cortex_private;
revoke all on schema delta_cortex_private from public;
grant usage on schema delta_cortex_private to authenticated;

-- Consulta restrita à própria autorização para manter a mesma regra em tabelas e Storage.
create function delta_cortex_private.papel_operacional()
returns text language sql stable security invoker set search_path = ''
as $$
  select a.papel::text
  from public.acessos_usuarios a
  where a.user_id = (select auth.uid()) and a.ativo is true
    and a.papel::text in ('admin', 'editor', 'leitor')
$$;
revoke all on function delta_cortex_private.papel_operacional() from public;
grant execute on function delta_cortex_private.papel_operacional() to authenticated;

create table public.projeto_arquivos_geograficos (
  id text primary key,
  projeto_id text not null references public.projetos(id),
  nome_original text not null,
  formato text not null check (formato in ('KMZ', 'KML')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  storage_bucket text not null default 'delta-cortex-geograficos' check (storage_bucket = 'delta-cortex-geograficos'),
  storage_path text not null unique check (split_part(storage_path, '/', 1) = projeto_id and split_part(storage_path, '/', 2) = id),
  metadados jsonb not null check (jsonb_typeof(metadados) = 'object'),
  quantidade_pontos integer not null check (quantidade_pontos >= 0),
  quantidade_linhas integer not null check (quantidade_linhas >= 0),
  quantidade_poligonos integer not null check (quantidade_poligonos >= 0),
  limites_geograficos double precision[] not null check (cardinality(limites_geograficos) = 4),
  importado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  status_processamento text not null default 'pronto' check (status_processamento in ('pendente', 'pronto', 'falhou')),
  visivel boolean not null default true,
  excluido_em timestamptz
);

create table public.visitas_sistematicas (
  id text primary key,
  identificacao text not null check (btrim(identificacao) <> ''),
  projeto_id text not null references public.projetos(id),
  cliente_id text not null references public.clientes(id),
  data_visita date not null,
  executor_id text not null references public.profissionais(id),
  executor_nome_snapshot text not null,
  responsavel_tecnico_id text not null references public.profissionais(id),
  responsavel_tecnico_nome_snapshot text not null,
  cliente_nome_snapshot text not null,
  projeto_nome_snapshot text not null,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'cancelada')),
  atividades_realizadas text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  finalizada_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  unique (id, projeto_id)
);

create table public.visitas_sistematicas_registros (
  id text primary key,
  projeto_id text not null,
  visita_origem_id text not null,
  foreign key (visita_origem_id, projeto_id) references public.visitas_sistematicas(id, projeto_id),
  tipo text not null check (tipo in ('Observacao', 'Ocorrencia')),
  meio_ambiental text not null check (meio_ambiental in ('Fauna', 'Físico', 'Flora', 'Social')),
  descricao text not null check (btrim(descricao) <> ''),
  gravidade text check (gravidade in ('Leve', 'Grave', 'Gravíssima')),
  situacao text check (situacao in ('em_aberto', 'resolvido')),
  check ((tipo = 'Ocorrencia' and gravidade is not null and situacao is not null)
      or (tipo = 'Observacao' and gravidade is null and situacao is null)),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precisao_metros double precision check (precisao_metros >= 0 and precisao_metros < 'Infinity'::double precision),
  utm_zona smallint not null check (utm_zona between 1 and 60),
  utm_hemisferio text not null check (utm_hemisferio in ('N','S')),
  utm_easting double precision not null check (utm_easting between 0 and 1000000),
  utm_northing double precision not null check (utm_northing between 0 and 10000000),
  referencia_geodesica text not null,
  tecnico_id text not null references public.profissionais(id),
  tecnico_nome_snapshot text not null,
  registrado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  excluido_em timestamptz,
  versao bigint not null default 0 check (versao >= 0),
  unique (id, projeto_id),
  unique (id, visita_origem_id)
);

create table public.visitas_sistematicas_eventos (
  id bigint generated always as identity primary key,
  registro_id text not null,
  visita_id text not null,
  projeto_id text not null,
  foreign key (registro_id, projeto_id) references public.visitas_sistematicas_registros(id, projeto_id),
  foreign key (visita_id, projeto_id) references public.visitas_sistematicas(id, projeto_id),
  situacao_anterior text not null check (situacao_anterior in ('em_aberto','resolvido')),
  nova_situacao text not null check (nova_situacao in ('em_aberto','resolvido') and nova_situacao <> situacao_anterior),
  ocorrido_em timestamptz not null default clock_timestamp(),
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  profissional_id text not null references public.profissionais(id),
  profissional_nome_snapshot text not null
);

create table public.visitas_sistematicas_fotografias (
  id text primary key,
  registro_id text not null,
  visita_id text not null,
  foreign key (registro_id, visita_id) references public.visitas_sistematicas_registros(id, visita_origem_id),
  nome_arquivo text not null,
  storage_bucket text not null default 'delta-cortex-visitas-sistematicas' check (storage_bucket = 'delta-cortex-visitas-sistematicas'),
  storage_path text not null unique check (
    split_part(storage_path, '/', 1) = visita_id and split_part(storage_path, '/', 2) = 'fotografias'
    and split_part(storage_path, '/', 3) = id),
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  tipo_mime text not null check (tipo_mime in ('image/jpeg','image/png','image/webp')),
  capturada_em timestamptz not null,
  utm_info text not null,
  cliente_projeto_info text not null,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  excluido_em timestamptz
);

create table public.visitas_sistematicas_relatorios (
  id text primary key,
  visita_id text not null references public.visitas_sistematicas(id),
  nome_arquivo text not null,
  storage_bucket text not null default 'delta-cortex-visitas-sistematicas' check (storage_bucket = 'delta-cortex-visitas-sistematicas'),
  storage_path text not null unique check (
    split_part(storage_path, '/', 1) = visita_id and split_part(storage_path, '/', 2) = 'relatorios'
    and split_part(storage_path, '/', 3) = id),
  gerado_em timestamptz not null default now(),
  atividades text[] not null,
  registro_ids text[] not null,
  fotografia_ids text[] not null,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null
);

create index on public.projeto_arquivos_geograficos (projeto_id, importado_em) where excluido_em is null;
create index on public.visitas_sistematicas (projeto_id, data_visita desc);
create index on public.visitas_sistematicas (cliente_id);
create index on public.visitas_sistematicas (executor_id);
create index on public.visitas_sistematicas (responsavel_tecnico_id);
create index on public.visitas_sistematicas_registros (visita_origem_id, registrado_em);
create index on public.visitas_sistematicas_registros (projeto_id, tipo, situacao, registrado_em) where excluido_em is null;
create index on public.visitas_sistematicas_registros (tecnico_id);
create index on public.visitas_sistematicas_eventos (registro_id, ocorrido_em, id);
create index on public.visitas_sistematicas_eventos (visita_id);
create index on public.visitas_sistematicas_eventos (profissional_id);
create index on public.visitas_sistematicas_fotografias (registro_id);
create index on public.visitas_sistematicas_relatorios (visita_id, gerado_em desc);

do $$
declare tabela text;
begin
  foreach tabela in array array[
    'projeto_arquivos_geograficos', 'visitas_sistematicas', 'visitas_sistematicas_registros',
    'visitas_sistematicas_eventos', 'visitas_sistematicas_fotografias', 'visitas_sistematicas_relatorios'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on public.%I from public, anon, authenticated', tabela);
    execute format('grant select on public.%I to authenticated', tabela);
    execute format('create policy leitura_operacional on public.%I for select to authenticated using ((select delta_cortex_private.papel_operacional()) is not null)', tabela);
    if tabela <> 'visitas_sistematicas_eventos' then
      execute format('grant insert on public.%I to authenticated', tabela);
      execute format('create policy insercao_operacional on public.%I for insert to authenticated with check ((select delta_cortex_private.papel_operacional()) in (''admin'', ''editor'') and criado_por = (select auth.uid()))', tabela);
    end if;
    if tabela not in ('visitas_sistematicas_eventos', 'visitas_sistematicas_relatorios') then
      execute format('create policy atualizacao_operacional on public.%I for update to authenticated using ((select delta_cortex_private.papel_operacional()) in (''admin'', ''editor'')) with check ((select delta_cortex_private.papel_operacional()) in (''admin'', ''editor''))', tabela);
    end if;
  end loop;
end $$;

grant update (visivel, excluido_em) on public.projeto_arquivos_geograficos to authenticated;
grant update (status, atividades_realizadas, atualizado_em, finalizada_em, excluido_em) on public.visitas_sistematicas to authenticated;
grant update (excluido_em) on public.visitas_sistematicas_registros to authenticated;
grant update (excluido_em) on public.visitas_sistematicas_fotografias to authenticated;

-- Implementação privada. O RPC exposto apenas delega e mantém a verificação de papel.
create function delta_cortex_private.mudar_situacao_ocorrencia(
  p_registro_id text, p_visita_id text, p_situacao text, p_versao bigint
)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  registro public.visitas_sistematicas_registros%rowtype;
  visita public.visitas_sistematicas%rowtype;
begin
  if coalesce(delta_cortex_private.papel_operacional(), '') not in ('admin', 'editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  if p_situacao is null or p_situacao not in ('em_aberto', 'resolvido') or p_versao is null then
    raise exception 'Situação ou versão inválida' using errcode = '22023';
  end if;
  select * into strict visita from public.visitas_sistematicas
    where id = p_visita_id and excluido_em is null and status = 'em_andamento' for share;
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

revoke all on function delta_cortex_private.mudar_situacao_ocorrencia(text,text,text,bigint) from public;
grant execute on function delta_cortex_private.mudar_situacao_ocorrencia(text,text,text,bigint) to authenticated;

create function public.delta_cortex_mudar_situacao_ocorrencia(
  p_registro_id text, p_visita_id text, p_situacao text, p_versao bigint
)
returns bigint language sql security invoker set search_path = ''
as $$
  select delta_cortex_private.mudar_situacao_ocorrencia(p_registro_id, p_visita_id, p_situacao, p_versao)
$$;
revoke all on function public.delta_cortex_mudar_situacao_ocorrencia(text,text,text,bigint) from public, anon;
grant execute on function public.delta_cortex_mudar_situacao_ocorrencia(text,text,text,bigint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('delta-cortex-geograficos', 'delta-cortex-geograficos', false, 52428800,
   array['application/vnd.google-earth.kml+xml','application/vnd.google-earth.kmz']),
  ('delta-cortex-visitas-sistematicas', 'delta-cortex-visitas-sistematicas', false, 52428800,
   array['image/jpeg','image/png','image/webp','application/pdf']);

-- Restringe também políticas preexistentes mais amplas da mesma instância.
create policy delta_cortex_arquivos_sem_anon on storage.objects as restrictive for all to anon
using (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'))
with check (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'));

create policy delta_cortex_arquivos_isolamento on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (select delta_cortex_private.papel_operacional()) is not null
)
with check (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (select delta_cortex_private.papel_operacional()) in ('admin','editor')
);

create policy delta_cortex_arquivos_leitura on storage.objects for select to authenticated
using (bucket_id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'));

create policy delta_cortex_arquivos_leitura_restrita on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (bucket_id = 'delta-cortex-geograficos' and exists (
    select 1 from public.projeto_arquivos_geograficos a
    where a.storage_path = name and a.excluido_em is null and a.status_processamento = 'pronto'
  ))
  or (bucket_id = 'delta-cortex-visitas-sistematicas' and (
    exists (select 1 from public.visitas_sistematicas_fotografias f where f.storage_path = name and f.excluido_em is null)
    or exists (select 1 from public.visitas_sistematicas_relatorios r where r.storage_path = name)
  ))
  or (bucket_id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
    and owner_id = (select auth.uid())::text
    and (select delta_cortex_private.papel_operacional()) in ('admin','editor'))
);

create policy delta_cortex_arquivos_upload on storage.objects for insert to authenticated
with check (bucket_id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'));

create policy delta_cortex_arquivos_upload_restrito on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or ((select delta_cortex_private.papel_operacional()) in ('admin','editor')
      and owner_id = (select auth.uid())::text)
);

create policy delta_cortex_arquivos_sem_sobrescrita on storage.objects as restrictive for update to public
using (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'))
with check (bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas'));


create function delta_cortex_private.objeto_referenciado(bucket text, caminho text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case bucket
    when 'delta-cortex-geograficos' then exists (
      select 1 from public.projeto_arquivos_geograficos a where a.storage_path = caminho)
    when 'delta-cortex-visitas-sistematicas' then exists (
      select 1 from public.visitas_sistematicas_fotografias f where f.storage_path = caminho)
      or exists (select 1 from public.visitas_sistematicas_relatorios r where r.storage_path = caminho)
    else false end
$$;
revoke all on function delta_cortex_private.objeto_referenciado(text,text) from public;
grant execute on function delta_cortex_private.objeto_referenciado(text,text) to authenticated;

create policy delta_cortex_arquivos_limpar_pendentes on storage.objects for delete to authenticated
using (
  bucket_id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  and owner_id = (select auth.uid())::text
  and (select delta_cortex_private.papel_operacional()) in ('admin','editor')
  and not delta_cortex_private.objeto_referenciado(bucket_id, name)
);

create policy delta_cortex_arquivos_proteger_referencias on storage.objects as restrictive for delete to authenticated
using (
  bucket_id not in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas')
  or (owner_id = (select auth.uid())::text and (select delta_cortex_private.papel_operacional()) in ('admin','editor')
      and not delta_cortex_private.objeto_referenciado(bucket_id, name))
);

create function delta_cortex_private.conferir_objeto()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = new.storage_bucket and o.name = new.storage_path
      and o.owner_id = (select auth.uid())::text
  ) then
    raise exception 'O arquivo privado precisa existir e pertencer ao autor do envio' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function delta_cortex_private.conferir_objeto() from public;
create trigger conferir_arquivo_geografico before insert on public.projeto_arquivos_geograficos
  for each row execute function delta_cortex_private.conferir_objeto();
create trigger conferir_fotografia before insert on public.visitas_sistematicas_fotografias
  for each row execute function delta_cortex_private.conferir_objeto();
create trigger conferir_relatorio before insert on public.visitas_sistematicas_relatorios
  for each row execute function delta_cortex_private.conferir_objeto();

create function delta_cortex_private.validar_cliente_projeto()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.cliente_id = new.cliente_id then return new; end if;
  end if;
  perform 1 from public.clientes where id = new.cliente_id and excluido_em is null for share;
  if not found then raise exception 'Contratante indisponível' using errcode = '23503'; end if;
  return new;
end $$;
create trigger delta_cortex_projeto_cliente before insert or update of cliente_id on public.projetos
  for each row execute function delta_cortex_private.validar_cliente_projeto();

create function delta_cortex_private.preparar_visita()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  select nome into strict new.projeto_nome_snapshot from public.projetos
    where id = new.projeto_id and cliente_id = new.cliente_id and excluido_em is null for share;
  select nome_razao_social into strict new.cliente_nome_snapshot from public.clientes
    where id = new.cliente_id and excluido_em is null for share;
  select nome into strict new.executor_nome_snapshot from public.profissionais
    where id = new.executor_id and habilitado and excluido_em is null for share;
  select nome into strict new.responsavel_tecnico_nome_snapshot from public.profissionais
    where id = new.responsavel_tecnico_id and habilitado and excluido_em is null for share;
  return new;
exception when no_data_found then
  raise exception 'Projeto, contratante ou profissional indisponível' using errcode = '23503';
end $$;
create trigger delta_cortex_preparar_visita before insert on public.visitas_sistematicas
  for each row execute function delta_cortex_private.preparar_visita();
create trigger delta_cortex_visita_atualizada before update on public.visitas_sistematicas
  for each row execute function public.delta_cortex_atualizar_timestamp();

create function delta_cortex_private.preparar_registro()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v public.visitas_sistematicas%rowtype;
begin
  select * into strict v from public.visitas_sistematicas
    where id = new.visita_origem_id and projeto_id = new.projeto_id and excluido_em is null
      and status = 'em_andamento' for share;
  new.tecnico_id := v.executor_id;
  new.tecnico_nome_snapshot := v.executor_nome_snapshot;
  new.situacao := case when new.tipo = 'Ocorrencia' then 'em_aberto' else null end;
  new.versao := 0;
  return new;
exception when no_data_found then
  raise exception 'Visita indisponível para registro' using errcode = '23503';
end $$;
create trigger delta_cortex_preparar_registro before insert on public.visitas_sistematicas_registros
  for each row execute function delta_cortex_private.preparar_registro();

create function public.delta_cortex_salvar_projeto(
  p_projeto jsonb, p_editar boolean, p_atualizado_em timestamptz, p_adicionar jsonb, p_remover text[]
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare p public.projetos%rowtype := jsonb_populate_record(null::public.projetos, p_projeto);
begin
  if p_editar then
    update public.projetos set cliente_id = p.cliente_id, nome = p.nome, descricao = p.descricao,
      prazo = p.prazo, link_google_maps_original = p.link_google_maps_original, utm_easting = p.utm_easting,
      utm_northing = p.utm_northing, utm_zona = p.utm_zona, utm_hemisferio = p.utm_hemisferio,
      datum = p.datum, latitude = p.latitude, longitude = p.longitude
    where id = p.id and excluido_em is null and atualizado_em = p_atualizado_em;
    if not found then raise exception 'Projeto indisponível ou atualizado por outro usuário' using errcode = '40001'; end if;
  else
    insert into public.projetos (id, cliente_id, nome, descricao, prazo, link_google_maps_original,
      utm_easting, utm_northing, utm_zona, utm_hemisferio, datum, latitude, longitude)
    values (p.id, p.cliente_id, p.nome, p.descricao, p.prazo, p.link_google_maps_original,
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
revoke all on function public.delta_cortex_salvar_projeto(jsonb,boolean,timestamptz,jsonb,text[]) from public, anon;
grant execute on function public.delta_cortex_salvar_projeto(jsonb,boolean,timestamptz,jsonb,text[]) to authenticated;

create function public.delta_cortex_salvar_profissional(
  p_profissional jsonb, p_atualizado_em timestamptz, p_bancarios jsonb
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare p public.profissionais%rowtype := jsonb_populate_record(null::public.profissionais, p_profissional);
begin
  if p_atualizado_em is null then
    insert into public.profissionais (id, nome, origem_temporaria, cargo, registro_profissional,
      rg, cpf, cnpj, contato, email, endereco, habilitado, placa_veiculo)
    values (p.id, p.nome, p.origem_temporaria, p.cargo, p.registro_profissional,
      p.rg, p.cpf, p.cnpj, p.contato, p.email, p.endereco, p.habilitado, p.placa_veiculo);
  else
    update public.profissionais set nome = p.nome, origem_temporaria = p.origem_temporaria,
      cargo = p.cargo, registro_profissional = p.registro_profissional, rg = p.rg, cpf = p.cpf,
      cnpj = p.cnpj, contato = p.contato, email = p.email, endereco = p.endereco,
      habilitado = p.habilitado, placa_veiculo = p.placa_veiculo
    where id = p.id and atualizado_em = p_atualizado_em and excluido_em is null;
    if not found then raise exception 'Profissional indisponível ou atualizado por outro usuário' using errcode = '40001'; end if;
  end if;
  if p_bancarios is not null then
    insert into public.profissionais_dados_bancarios (profissional_id, chave_pix, banco, agencia, conta_corrente)
    values (p.id, p_bancarios->>'chave_pix', p_bancarios->>'banco', p_bancarios->>'agencia', p_bancarios->>'conta_corrente')
    on conflict (profissional_id) do update set chave_pix = excluded.chave_pix, banco = excluded.banco,
      agencia = excluded.agencia, conta_corrente = excluded.conta_corrente;
  end if;
  return (select to_jsonb(t) from public.profissionais t where t.id = p.id);
end $$;
revoke all on function public.delta_cortex_salvar_profissional(jsonb,timestamptz,jsonb) from public, anon;
grant execute on function public.delta_cortex_salvar_profissional(jsonb,timestamptz,jsonb) to authenticated;

create function public.delta_cortex_salvar_registro(p_registro jsonb, p_fotografias jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare r public.visitas_sistematicas_registros%rowtype := jsonb_populate_record(null::public.visitas_sistematicas_registros, p_registro);
begin
  insert into public.visitas_sistematicas_registros (id, projeto_id, visita_origem_id, tipo, meio_ambiental,
    descricao, gravidade, latitude, longitude, precisao_metros, utm_zona, utm_hemisferio, utm_easting,
    utm_northing, referencia_geodesica, registrado_em)
  values (r.id, r.projeto_id, r.visita_origem_id, r.tipo, r.meio_ambiental, r.descricao, r.gravidade,
    r.latitude, r.longitude, r.precisao_metros, r.utm_zona, r.utm_hemisferio, r.utm_easting, r.utm_northing,
    r.referencia_geodesica, r.registrado_em);
  insert into public.visitas_sistematicas_fotografias (id, registro_id, visita_id, nome_arquivo, storage_path,
    tamanho_bytes, tipo_mime, capturada_em, utm_info, cliente_projeto_info)
  select f.id, r.id, r.visita_origem_id, f.nome_arquivo, f.storage_path, f.tamanho_bytes, f.tipo_mime,
    f.capturada_em, f.utm_info, f.cliente_projeto_info
  from jsonb_populate_recordset(null::public.visitas_sistematicas_fotografias, p_fotografias) f;
  return r.id;
end $$;
revoke all on function public.delta_cortex_salvar_registro(jsonb,jsonb) from public, anon;
grant execute on function public.delta_cortex_salvar_registro(jsonb,jsonb) to authenticated;

create function delta_cortex_private.validar_relatorio()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v public.visitas_sistematicas%rowtype;
begin
  select * into strict v from public.visitas_sistematicas where id = new.visita_id
    and status = 'concluida' and excluido_em is null for share;
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
  raise exception 'Visita concluída não encontrada' using errcode = '23503';
end $$;
create trigger delta_cortex_validar_relatorio before insert on public.visitas_sistematicas_relatorios
  for each row execute function delta_cortex_private.validar_relatorio();

create function public.delta_cortex_adicionar_relatorio(p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare r public.visitas_sistematicas_relatorios%rowtype := jsonb_populate_record(null::public.visitas_sistematicas_relatorios, p_relatorio);
begin
  update public.visitas_sistematicas set atividades_realizadas = r.atividades
    where id = r.visita_id and status = 'concluida' and excluido_em is null;
  if not found then raise exception 'Visita concluída não encontrada' using errcode = '23503'; end if;
  insert into public.visitas_sistematicas_relatorios (id, visita_id, nome_arquivo, storage_path,
    gerado_em, atividades, registro_ids, fotografia_ids)
  values (r.id, r.visita_id, r.nome_arquivo, r.storage_path, r.gerado_em,
    r.atividades, r.registro_ids, r.fotografia_ids);
  return r.id;
end $$;
revoke all on function public.delta_cortex_adicionar_relatorio(jsonb) from public, anon;
grant execute on function public.delta_cortex_adicionar_relatorio(jsonb) to authenticated;

commit;
