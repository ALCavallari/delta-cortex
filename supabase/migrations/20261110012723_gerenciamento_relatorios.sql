begin;

alter table public.visitas_sistematicas_relatorios add column excluido_em timestamptz;

grant update (excluido_em) on public.visitas_sistematicas_relatorios to authenticated;

create policy delta_admin_arquiva_relatorio on public.visitas_sistematicas_relatorios
  for update to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) = 'admin' and excluido_em is null)
  with check ((select delta_cortex_private.perfil_efetivo()) = 'admin' and excluido_em is not null);

create policy delta_somente_admin_arquiva_relatorio on public.visitas_sistematicas_relatorios
  as restrictive for update to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) = 'admin' and excluido_em is null)
  with check ((select delta_cortex_private.perfil_efetivo()) = 'admin' and excluido_em is not null);

create policy delta_relatorio_arquivo_ativo on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'delta-cortex-visitas-sistematicas' or not exists (
    select 1 from public.visitas_sistematicas_relatorios r
    where r.storage_path = name and r.excluido_em is not null
  ));

create function public.delta_cortex_excluir_relatorio(p_id text)
returns text language plpgsql security invoker set search_path = ''
as $$
declare removido text;
begin
  if delta_cortex_private.perfil_efetivo() is distinct from 'admin' then
    raise exception 'Operação exclusiva de administradores' using errcode = '42501';
  end if;
  update public.visitas_sistematicas_relatorios set excluido_em = now()
    where id = p_id and excluido_em is null returning id into removido;
  if removido is null then
    raise exception 'Relatório indisponível ou alterado por outro usuário' using errcode = '40001';
  end if;
  return removido;
end $$;

create function public.delta_cortex_substituir_relatorio(p_original text, p_relatorio jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare substituido text;
begin
  if delta_cortex_private.perfil_efetivo() is distinct from 'admin' then
    raise exception 'Operação exclusiva de administradores' using errcode = '42501';
  end if;
  update public.visitas_sistematicas_relatorios set excluido_em = now()
    where id = p_original and visita_id = p_relatorio->>'visita_id' and excluido_em is null
    returning id into substituido;
  if substituido is null then
    raise exception 'Relatório indisponível ou alterado por outro usuário' using errcode = '40001';
  end if;
  return public.delta_cortex_adicionar_relatorio(p_relatorio);
end $$;

revoke all on function public.delta_cortex_excluir_relatorio(text) from public, anon;
revoke all on function public.delta_cortex_substituir_relatorio(text,jsonb) from public, anon;
grant execute on function public.delta_cortex_excluir_relatorio(text) to authenticated;
grant execute on function public.delta_cortex_substituir_relatorio(text,jsonb) to authenticated;

commit;
