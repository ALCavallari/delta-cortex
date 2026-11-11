begin;

create or replace function delta_cortex_private.notificacoes_campo(
  p_acao text, p_id uuid, p_visita text, p_destinatario uuid,
  p_projetos text[], p_mensagem text, p_permanente boolean
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
  perfil text := delta_cortex_private.perfil_efetivo();
  visita public.visitas_sistematicas%rowtype;
  nome_remetente text;
  nome_destinatario text;
  projetos_validos text[];
  projetos_selecionados text[];
begin
  if usuario is null or coalesce(perfil, '') not in ('admin', 'tecnico') then
    raise exception 'Notificações indisponíveis' using errcode = '42501';
  end if;

  if p_acao = 'destinos' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', a.user_id, 'nome', t.nome, 'projetos', coalesce(escopo.projetos, '[]'::jsonb)) order by t.nome, a.user_id)
      from public.acessos_usuarios a join public.profissionais t on t.id = a.profissional_id and t.excluido_em is null
      join auth.users u on u.id = a.user_id and u.deleted_at is null and u.email_confirmed_at is not null
      cross join lateral (
        select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome, p.id) as projetos
        from delta_cortex_private.destinos_notificacao(a.user_id) p
      ) escopo
      where a.user_id <> usuario and a.ativo and a.papel = 'tecnico'
        and (perfil = 'admin' or escopo.projetos is not null)
    ), '[]'::jsonb);
  elsif p_acao = 'salvar' then
    select array_agg(p.id) into projetos_validos from delta_cortex_private.destinos_notificacao(p_destinatario) p;
    projetos_selecionados := array(select distinct unnest(p_projetos) order by 1);
    if p_destinatario is null or p_destinatario = usuario
      or coalesce(cardinality(projetos_selecionados), 0) = 0 or array_position(projetos_selecionados, null) is not null
      or not coalesce(projetos_selecionados <@ projetos_validos, false)
      or coalesce(length(btrim(p_mensagem)), 0) not between 1 and 4000 or p_permanente is null then
      raise exception 'Confira destinatário, projetos e mensagem' using errcode = '23514';
    end if;
    select coalesce(a.nome_exibicao, t.nome, 'Usuário Delta CorteX') into nome_remetente
      from public.acessos_usuarios a left join public.profissionais t on t.id = a.profissional_id
      where a.user_id = usuario;
    select t.nome into nome_destinatario
      from public.acessos_usuarios a join public.profissionais t on t.id = a.profissional_id
      where a.user_id = p_destinatario;
    if p_id is null then
      insert into delta_cortex_private.notificacoes_campo
        (remetente, destinatario, remetente_nome, destinatario_nome, projetos, mensagem, permanente)
      values (usuario, p_destinatario, nome_remetente, nome_destinatario, projetos_selecionados, btrim(p_mensagem), p_permanente);
    else
      update delta_cortex_private.notificacoes_campo n set
        visita_unica_id = case when n.destinatario = p_destinatario and n.projetos = projetos_selecionados
          and n.permanente = p_permanente then n.visita_unica_id end,
        destinatario = p_destinatario, destinatario_nome = nome_destinatario, projetos = projetos_selecionados,
        mensagem = btrim(p_mensagem), permanente = p_permanente, lida_em = null
      where n.id = p_id and n.remetente = usuario;
      if not found then raise exception 'Notificação indisponível' using errcode = '42501'; end if;
    end if;
    return 'true'::jsonb;
  elsif p_acao = 'excluir' then
    delete from delta_cortex_private.notificacoes_campo where id = p_id and remetente = usuario;
    if not found then raise exception 'Notificação indisponível' using errcode = '42501'; end if;
    return 'true'::jsonb;
  elsif p_acao = 'ler' then
    update delta_cortex_private.notificacoes_campo n set lida_em = coalesce(n.lida_em, now())
    where n.id = p_id and n.destinatario = usuario
      and exists (select 1 from unnest(n.projetos) p(id) where delta_cortex_private.acesso_projeto(p.id, true));
    return to_jsonb(found);
  elsif p_acao = 'visita' then
    select * into visita from public.visitas_sistematicas v
    where v.id = p_visita and v.excluido_em is null and delta_cortex_private.acesso_projeto(v.projeto_id, true)
      and exists (select 1 from public.acessos_usuarios a where a.user_id = usuario and a.profissional_id = v.executor_id);
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
      'permanente', n.permanente, 'mensagem', n.mensagem, 'criadaEm', n.criada_em, 'projetos', escopo.projetos
    ) order by n.criada_em desc, n.id)
    from delta_cortex_private.notificacoes_campo n
    cross join lateral (
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome, p.id) as projetos
      from public.projetos p where p.id = any(n.projetos)
        and (n.remetente = usuario or delta_cortex_private.acesso_projeto(p.id, true))
    ) escopo
    where escopo.projetos is not null and (
      (p_acao = 'listar' and (n.remetente = usuario or n.destinatario = usuario))
      or (p_acao = 'visita' and n.destinatario = usuario and visita.projeto_id = any(n.projetos)
        and (n.permanente or n.visita_unica_id = visita.id))
    )
  ), '[]'::jsonb);
end $$;

commit;
