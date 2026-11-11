begin;

alter table delta_cortex_private.notificacoes_campo
  add column anexo_path text unique,
  add column anexo_nome text,
  add constraint notificacao_anexo_completo check ((anexo_path is null) = (anexo_nome is null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delta-cortex-notificacoes', 'delta-cortex-notificacoes', false, 6291456, array[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation', 'text/plain', 'text/csv'
]);

create function delta_cortex_private.anexo_notificacao_em_uso(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from delta_cortex_private.notificacoes_campo n where n.anexo_path = p_path);
$$;

create function delta_cortex_private.pode_ler_anexo_notificacao(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from delta_cortex_private.notificacoes_campo n
    cross join (select auth.uid() as usuario, delta_cortex_private.perfil_efetivo() as perfil) acesso
    where n.anexo_path = p_path and acesso.perfil in ('admin', 'tecnico') and (
      n.remetente = acesso.usuario or (acesso.perfil = 'admin' and n.remetente_admin)
      or (n.destinatario = acesso.usuario and exists (
        select 1 from unnest(n.projetos) as p(id) where delta_cortex_private.acesso_projeto(p.id, true)
      ))
    )
  );
$$;
revoke all on function delta_cortex_private.anexo_notificacao_em_uso(text),
  delta_cortex_private.pode_ler_anexo_notificacao(text) from public, anon, authenticated;
grant execute on function delta_cortex_private.anexo_notificacao_em_uso(text),
  delta_cortex_private.pode_ler_anexo_notificacao(text) to authenticated;

create policy delta_anexos_notificacoes_sem_anon on storage.objects
  as restrictive for all to anon
  using (bucket_id <> 'delta-cortex-notificacoes')
  with check (bucket_id <> 'delta-cortex-notificacoes');
create policy delta_anexos_notificacoes_leitura on storage.objects
  for select to authenticated using (bucket_id = 'delta-cortex-notificacoes');
create policy delta_anexos_notificacoes_restringir_leitura on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'delta-cortex-notificacoes'
    or delta_cortex_private.pode_ler_anexo_notificacao(name)
    or (owner_id = (select auth.uid())::text and (select delta_cortex_private.perfil_efetivo()) in ('admin', 'tecnico')
      and not delta_cortex_private.anexo_notificacao_em_uso(name))
  );
create policy delta_anexos_notificacoes_envio on storage.objects
  for insert to authenticated with check (bucket_id = 'delta-cortex-notificacoes');
create policy delta_anexos_notificacoes_restringir_envio on storage.objects
  as restrictive for insert to authenticated with check (
    bucket_id <> 'delta-cortex-notificacoes'
    or (owner_id = (select auth.uid())::text and (select delta_cortex_private.perfil_efetivo()) in ('admin', 'tecnico')
      and split_part(name, '/', 1) = (select auth.uid())::text
      and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$')
  );
create policy delta_anexos_notificacoes_sem_sobrescrita on storage.objects
  as restrictive for update to public
  using (bucket_id <> 'delta-cortex-notificacoes')
  with check (bucket_id <> 'delta-cortex-notificacoes');
create policy delta_anexos_notificacoes_exclusao on storage.objects
  for delete to authenticated using (bucket_id = 'delta-cortex-notificacoes');
create policy delta_anexos_notificacoes_restringir_exclusao on storage.objects
  as restrictive for delete to authenticated using (
    bucket_id <> 'delta-cortex-notificacoes'
    or (owner_id = (select auth.uid())::text and (select delta_cortex_private.perfil_efetivo()) in ('admin', 'tecnico')
      and not delta_cortex_private.anexo_notificacao_em_uso(name))
  );

create or replace function delta_cortex_private.notificacoes_campo(
  p_acao text, p_id uuid, p_visita text, p_destinatario uuid,
  p_projetos text[], p_mensagem text, p_permanente boolean, p_anexo jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
  perfil text := delta_cortex_private.perfil_efetivo();
  visita public.visitas_sistematicas%rowtype;
  nome_remetente text;
  nome_destinatario text;
  destinatario_tecnico_atual boolean;
  manter_destinatario_proprio boolean := false;
  anexo_path_novo text;
  anexo_nome_novo text;
  anexo_anterior text;
  projetos_validos text[];
  projetos_selecionados text[];
begin
  if usuario is null or coalesce(perfil, '') not in ('admin', 'tecnico') then
    raise exception 'Notificações indisponíveis' using errcode = '42501';
  end if;

  if p_id is not null and perfil = 'admin' and p_acao in ('destinos', 'salvar') then
    select exists (
      select 1 from delta_cortex_private.notificacoes_campo n
      where n.id = p_id and n.destinatario = usuario and n.remetente_admin
    ) into manter_destinatario_proprio;
  end if;

  if p_acao = 'destinos' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', a.user_id, 'nome', coalesce(t.nome, nullif(btrim(a.nome_exibicao), ''), u.email, 'Administrador'), 'papel', a.papel, 'projetos', coalesce(escopo.projetos, '[]'::jsonb)) order by coalesce(t.nome, a.nome_exibicao, u.email), a.user_id)
      from public.acessos_usuarios a left join public.profissionais t on t.id = a.profissional_id and t.excluido_em is null
      join auth.users u on u.id = a.user_id and u.deleted_at is null and u.email_confirmed_at is not null
      cross join lateral (
        select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome, p.id) as projetos
        from delta_cortex_private.destinos_notificacao(a.user_id) p
      ) escopo
      where (a.user_id <> usuario or manter_destinatario_proprio) and a.ativo
        and ((a.papel = 'tecnico' and t.id is not null) or (a.papel = 'admin' and perfil = 'admin'))
        and (perfil = 'admin' or escopo.projetos is not null)
    ), '[]'::jsonb);
  elsif p_acao = 'salvar' then
    select array_agg(p.id) into projetos_validos from delta_cortex_private.destinos_notificacao(p_destinatario) p;
    projetos_selecionados := array(select distinct unnest(p_projetos) order by 1);
    if p_destinatario is null or (p_destinatario = usuario and not manter_destinatario_proprio)
      or coalesce(cardinality(projetos_selecionados), 0) = 0 or array_position(projetos_selecionados, null) is not null
      or not coalesce(projetos_selecionados <@ projetos_validos, false)
      or coalesce(length(btrim(p_mensagem)), 0) not between 1 and 4000 or p_permanente is null then
      raise exception 'Confira destinatário, projetos e mensagem' using errcode = '23514';
    end if;
    select coalesce(a.nome_exibicao, t.nome, 'Usuário Delta CorteX') into nome_remetente
      from public.acessos_usuarios a left join public.profissionais t on t.id = a.profissional_id
      where a.user_id = usuario;
    select coalesce(t.nome, nullif(btrim(a.nome_exibicao), ''), u.email, 'Administrador'), a.papel = 'tecnico'
      into nome_destinatario, destinatario_tecnico_atual
      from public.acessos_usuarios a join auth.users u on u.id = a.user_id
      left join public.profissionais t on t.id = a.profissional_id
      where a.user_id = p_destinatario;
    if p_anexo is not null and p_anexo <> '{}'::jsonb then
      anexo_path_novo := p_anexo->>'path';
      anexo_nome_novo := btrim(p_anexo->>'nome');
      if jsonb_typeof(p_anexo) <> 'object'
        or coalesce(length(anexo_nome_novo), 0) not between 1 and 180
        or anexo_nome_novo ~ '[/\\[:cntrl:]]'
        or anexo_nome_novo !~* '\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|csv)$'
        or not coalesce(anexo_path_novo ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$', false)
        or split_part(anexo_path_novo, '/', 1) <> usuario::text then
        raise exception 'Anexo inválido' using errcode = '23514';
      end if;
      perform 1 from storage.objects o
      where o.bucket_id = 'delta-cortex-notificacoes' and o.name = anexo_path_novo
        and o.owner_id = usuario::text
      for share;
      if not found then raise exception 'Anexo indisponível' using errcode = '23503'; end if;
    end if;

    if p_id is null then
      insert into delta_cortex_private.notificacoes_campo
        (remetente, destinatario, remetente_nome, destinatario_nome, projetos, mensagem, permanente, remetente_admin, destinatario_tecnico, anexo_path, anexo_nome)
      values (usuario, p_destinatario, nome_remetente, nome_destinatario, projetos_selecionados, btrim(p_mensagem), p_permanente, perfil = 'admin', destinatario_tecnico_atual, anexo_path_novo, anexo_nome_novo);
    else
      if p_anexo is not null then
        select n.anexo_path into anexo_anterior from delta_cortex_private.notificacoes_campo n
        where n.id = p_id and (n.remetente = usuario or (perfil = 'admin' and n.remetente_admin))
        for update;
      end if;
      update delta_cortex_private.notificacoes_campo n set
        anexo_path = case when p_anexo is null then n.anexo_path else anexo_path_novo end,
        anexo_nome = case when p_anexo is null then n.anexo_nome else anexo_nome_novo end,
        visita_unica_id = case when n.destinatario = p_destinatario and n.projetos = projetos_selecionados
          and n.permanente = p_permanente then n.visita_unica_id end,
        destinatario = p_destinatario, destinatario_nome = nome_destinatario, projetos = projetos_selecionados,
        mensagem = btrim(p_mensagem), permanente = p_permanente, lida_em = null, destinatario_tecnico = destinatario_tecnico_atual
      where n.id = p_id and (n.remetente = usuario or (perfil = 'admin' and n.remetente_admin))
        and (p_destinatario <> usuario or n.destinatario = usuario);
      if not found then raise exception 'Notificação indisponível' using errcode = '42501'; end if;
    end if;
    return jsonb_build_object('anexoAnterior', anexo_anterior);
  elsif p_acao = 'excluir' then
    delete from delta_cortex_private.notificacoes_campo n
      where n.id = p_id and (n.remetente = usuario or (perfil = 'admin' and n.remetente_admin))
      returning n.anexo_path into anexo_anterior;
    if not found then raise exception 'Notificação indisponível' using errcode = '42501'; end if;
    return jsonb_build_object('anexoAnterior', anexo_anterior);
  elsif p_acao = 'ler' then
    update delta_cortex_private.notificacoes_campo n set lida_em = coalesce(n.lida_em, now())
    where n.id = p_id and n.destinatario = usuario
      and exists (select 1 from unnest(n.projetos) p(id) where delta_cortex_private.acesso_projeto(p.id, true));
    return to_jsonb(found);
  elsif p_acao = 'visita' then
    select * into visita from public.visitas_sistematicas v
    where v.id = p_visita and v.excluido_em is null and delta_cortex_private.acesso_projeto(v.projeto_id, true)
      and ((perfil = 'admin' and v.criado_por = usuario)
        or exists (select 1 from public.acessos_usuarios a where a.user_id = usuario and a.profissional_id = v.executor_id));
    if not found then return '[]'::jsonb; end if;
    if visita.status = 'em_andamento' then
      -- Uma única visita pode receber cada notificação única, inclusive sob concorrência.
      perform 1 from delta_cortex_private.notificacoes_campo n
        where n.destinatario = usuario and not n.permanente and n.visita_unica_id is null
          and visita.criado_em >= n.criada_em and visita.projeto_id = any(n.projetos) order by n.id for update;
      update delta_cortex_private.notificacoes_campo n set visita_unica_id = visita.id
      where n.destinatario = usuario and not n.permanente and n.visita_unica_id is null
        and visita.criado_em >= n.criada_em and visita.projeto_id = any(n.projetos);
    end if;
  elsif p_acao is distinct from 'listar' then
    raise exception 'Operação inválida' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'remetente', n.remetente_nome, 'destinatario', n.destinatario_nome,
      'destinatarioId', n.destinatario, 'enviada', coalesce(n.remetente = usuario, false), 'nova', n.destinatario = usuario and n.lida_em is null,
      'podeGerenciar', coalesce(n.remetente = usuario, false) or (perfil = 'admin' and n.remetente_admin),
      'visaoAdministrativa', perfil = 'admin' and n.remetente_admin and n.remetente is distinct from usuario and n.destinatario <> usuario,
      'anexo', case when n.anexo_path is not null then jsonb_build_object('path', n.anexo_path, 'nome', n.anexo_nome) end,
      'permanente', n.permanente, 'mensagem', n.mensagem, 'criadaEm', n.criada_em, 'projetos', escopo.projetos
    ) order by n.criada_em desc, n.id)
    from delta_cortex_private.notificacoes_campo n
    cross join lateral (
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome, p.id) as projetos
      from public.projetos p where p.id = any(n.projetos)
        and (n.remetente = usuario or delta_cortex_private.acesso_projeto(p.id, true))
    ) escopo
    where escopo.projetos is not null and (
      (p_acao = 'listar' and (n.remetente = usuario or n.destinatario = usuario
        or (perfil = 'admin' and n.remetente_admin)))
      or (p_acao = 'visita' and n.destinatario = usuario and visita.projeto_id = any(n.projetos)
        and (n.permanente or n.visita_unica_id = visita.id))
    )
  ), '[]'::jsonb);
end $$;

-- Mantém os parâmetros anteriores opcionais para clientes já abertos.
drop function public.delta_cortex_notificacoes_campo(text,uuid,text,uuid,text[],text,boolean);
drop function delta_cortex_private.notificacoes_campo(text,uuid,text,uuid,text[],text,boolean);

create function public.delta_cortex_notificacoes_campo(
  p_acao text, p_id uuid default null, p_visita text default null, p_destinatario uuid default null,
  p_projetos text[] default null, p_mensagem text default null, p_permanente boolean default null, p_anexo jsonb default null
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select delta_cortex_private.notificacoes_campo(p_acao, p_id, p_visita, p_destinatario, p_projetos, p_mensagem, p_permanente, p_anexo);
$$;
revoke all on function public.delta_cortex_notificacoes_campo(text,uuid,text,uuid,text[],text,boolean,jsonb),
  delta_cortex_private.notificacoes_campo(text,uuid,text,uuid,text[],text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.delta_cortex_notificacoes_campo(text,uuid,text,uuid,text[],text,boolean,jsonb),
  delta_cortex_private.notificacoes_campo(text,uuid,text,uuid,text[],text,boolean,jsonb) to authenticated;

commit;
