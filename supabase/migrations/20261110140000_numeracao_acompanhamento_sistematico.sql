begin;

create table delta_cortex_private.numeracao_acompanhamentos (
  ano integer primary key check (ano between 1 and 9999),
  ultimo bigint not null check (ultimo >= 0)
);
alter table delta_cortex_private.numeracao_acompanhamentos enable row level security;
revoke all on delta_cortex_private.numeracao_acompanhamentos from public, anon, authenticated;

-- Impede novas inserções entre a leitura dos códigos existentes e a criação do gatilho.
lock table public.visitas_sistematicas in share row exclusive mode;
insert into delta_cortex_private.numeracao_acompanhamentos (ano, ultimo)
select partes[2]::integer, max(partes[1]::bigint)
from public.visitas_sistematicas
cross join lateral regexp_match(identificacao, '^AS-([0-9]{1,18})-([0-9]{4})$') as codigo(partes)
where partes[2] <> '0000'
group by partes[2];

create function delta_cortex_private.numerar_acompanhamento()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  ano_visita integer := extract(year from new.data_visita)::integer;
  numero text;
begin
  if (select auth.uid()) is null
    or not coalesce(delta_cortex_private.acesso_projeto(new.projeto_id, true), false)
    or new.criado_por is distinct from (select auth.uid()) then
    raise exception 'Projeto indisponível para registro' using errcode = '42501';
  end if;
  if ano_visita is null or ano_visita not between 1 and 9999 then
    raise exception 'Data da visita inválida' using errcode = '23514';
  end if;

  insert into delta_cortex_private.numeracao_acompanhamentos as contagem (ano, ultimo)
  values (ano_visita, 1)
  on conflict (ano) do update set ultimo = contagem.ultimo + 1
  returning ultimo::text into numero;

  new.identificacao := 'AS-' || lpad(numero, greatest(3, length(numero)), '0')
    || '-' || lpad(ano_visita::text, 4, '0');
  return new;
end $$;

revoke all on function delta_cortex_private.numerar_acompanhamento() from public, anon, authenticated;
create trigger delta_cortex_registrar_numero_acompanhamento
  before insert on public.visitas_sistematicas
  for each row execute function delta_cortex_private.numerar_acompanhamento();

commit;
