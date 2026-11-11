begin;

create or replace function delta_cortex_private.registrar_senha_provisoria()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_app_meta_data @> '{"delta_senha_provisoria":true}'::jsonb then
    insert into delta_cortex_private.senhas_provisorias (usuario_id)
    values (new.id)
    on conflict (usuario_id) do nothing;
  end if;
  return new;
end $$;

drop trigger delta_cortex_registrar_senha_provisoria on auth.users;
-- O Auth Admin pode gravar app_metadata após a inserção da conta.
create trigger delta_cortex_registrar_senha_provisoria
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function delta_cortex_private.registrar_senha_provisoria();

-- Recupera as pendências ausentes sem sobrescrever trocas já confirmadas.
insert into delta_cortex_private.senhas_provisorias (usuario_id)
select id from auth.users
where deleted_at is null and raw_app_meta_data @> '{"delta_senha_provisoria":true}'::jsonb
on conflict (usuario_id) do nothing;

commit;
