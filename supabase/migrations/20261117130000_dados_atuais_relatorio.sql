begin;

-- Retorna somente os dados de identificação necessários à emissão do PDF.
create function delta_cortex_private.dados_atuais_relatorio(p_visita text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  dados jsonb;
begin
  if auth.uid() is null
    or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin', 'editor', 'tecnico') then
    raise exception 'Emissão de relatório indisponível' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'clienteId', c.id, 'clienteNome', c.nome_razao_social,
    'projetoId', p.id, 'identificacaoProjeto', p.nome, 'abreviacaoProjeto', p.abreviacao,
    'executorNome', executor.nome, 'responsavelTecnicoNome', responsavel.nome
  ) into dados
  from public.visitas_sistematicas v
  join public.projetos p on p.id = v.projeto_id
  join public.clientes c on c.id = p.cliente_id
  join public.profissionais executor on executor.id = v.executor_id
  join public.profissionais responsavel on responsavel.id = v.responsavel_tecnico_id
  where v.id = p_visita and v.excluido_em is null and v.status in ('em_andamento', 'concluida')
    and delta_cortex_private.acesso_projeto(v.projeto_id, true);

  if dados is null then
    raise exception 'Cadastros atuais indisponíveis para emissão' using errcode = '42501';
  end if;
  return dados;
end $$;

create function public.delta_cortex_dados_atuais_relatorio(p_visita text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select delta_cortex_private.dados_atuais_relatorio(p_visita) $$;

revoke all on function delta_cortex_private.dados_atuais_relatorio(text),
  public.delta_cortex_dados_atuais_relatorio(text) from public, anon, authenticated;
grant execute on function delta_cortex_private.dados_atuais_relatorio(text),
  public.delta_cortex_dados_atuais_relatorio(text) to authenticated;

commit;
