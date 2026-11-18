-- Revisar e aplicar separadamente. Não altera cadastros ou políticas existentes.
begin;

create table public.financeiro_contratos (
  id uuid primary key,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  cliente_id text not null references public.clientes(id) on delete restrict,
  projeto_id text not null references public.projetos(id) on delete restrict,
  vigencia date not null check (vigencia between date '1900-01-01' and date '9999-12-31'),
  parcelas integer not null check (parcelas between 1 and 240),
  faturamento text not null check (faturamento in ('unico','faseado','mensal','bimensal','trimestral','semestral','anual')),
  primeiro_faturamento date,
  valor_total_centavos bigint not null check (valor_total_centavos between 1 and 999999999999),
  texto_nfse text not null default '' check (length(texto_nfse) <= 10000),
  situacao text not null check (situacao in ('vigente','encerrado','paralisado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((faturamento in ('unico','faseado') and primeiro_faturamento is null)
    or (faturamento not in ('unico','faseado') and primeiro_faturamento is not null and primeiro_faturamento between date '1900-01-01' and vigencia))
);
create index financeiro_contratos_cliente_idx on public.financeiro_contratos(cliente_id);
create index financeiro_contratos_projeto_idx on public.financeiro_contratos(projeto_id);
create table public.financeiro_faturas (
  id uuid primary key,
  contrato_id uuid not null references public.financeiro_contratos(id) on delete restrict,
  numero integer not null check (numero between 1 and 240),
  data_faturamento date not null check (data_faturamento between date '1900-01-01' and date '9999-12-31'),
  valor_centavos bigint not null check (valor_centavos between 1 and 999999999999),
  situacao text not null default 'pendente' check (situacao in ('pendente','emitida')),
  emitida_em date,
  cancelada_em timestamptz,
  check ((situacao = 'emitida' and emitida_em is not null and cancelada_em is null)
    or (situacao = 'pendente' and emitida_em is null))
);
create unique index financeiro_faturas_parcela_idx on public.financeiro_faturas(contrato_id, numero) where cancelada_em is null;
create index financeiro_faturas_mes_idx on public.financeiro_faturas(data_faturamento) where cancelada_em is null;

alter table public.financeiro_contratos enable row level security;
alter table public.financeiro_faturas enable row level security;
revoke all on public.financeiro_contratos, public.financeiro_faturas from public, anon, authenticated;
grant select on public.financeiro_contratos, public.financeiro_faturas to authenticated;
create policy financeiro_contratos_leitura on public.financeiro_contratos for select to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor','leitor'));
create policy financeiro_faturas_leitura on public.financeiro_faturas for select to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor','leitor'));

create function delta_cortex_private.salvar_contrato(p_contrato jsonb, p_faturas jsonb, p_atualizado_em timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.financeiro_contratos;
  anterior public.financeiro_contratos;
  f record;
  existente boolean;
  intervalo integer;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(), '') not in ('admin','editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  -- Apenas os campos de negócio são aceitos. Timestamps e situação de emissão não vêm do cliente.
  c := jsonb_populate_record(null::public.financeiro_contratos, p_contrato);
  select * into anterior from public.financeiro_contratos where id = c.id for update;
  existente := found;
  if (existente and (p_atualizado_em is null or anterior.atualizado_em <> p_atualizado_em))
    or (not existente and p_atualizado_em is not null) then
    raise exception 'Contrato desatualizado' using errcode = '40001';
  end if;
  if not exists (select 1 from public.projetos p join public.clientes cli on cli.id = p.cliente_id
      where p.id = c.projeto_id and p.cliente_id = c.cliente_id
        and ((p.excluido_em is null and cli.excluido_em is null)
          or (existente and anterior.projeto_id = p.id and anterior.cliente_id = cli.id))) then
    raise exception 'Cliente e projeto incompatíveis' using errcode = '23514';
  end if;
  if c.parcelas is null or c.parcelas not between 1 and 240 or jsonb_typeof(p_faturas) is distinct from 'array' then
    raise exception 'Parcelas inválidas' using errcode = '23514';
  end if;
  if jsonb_array_length(p_faturas) <> c.parcelas or exists (
    select 1 from jsonb_to_recordset(p_faturas) as x(id uuid, numero integer, data_faturamento date, valor_centavos bigint)
    where x.id is null or x.numero is null or x.numero not between 1 and c.parcelas
      or x.data_faturamento is null or x.data_faturamento not between date '1900-01-01' and c.vigencia
      or x.valor_centavos is null or x.valor_centavos not between 1 and 999999999999
  ) or (select count(distinct x.id) from jsonb_to_recordset(p_faturas) as x(id uuid)) <> c.parcelas
    or (select count(distinct x.numero) from jsonb_to_recordset(p_faturas) as x(numero integer)) <> c.parcelas
    or (select sum(x.valor_centavos) from jsonb_to_recordset(p_faturas) as x(valor_centavos bigint)) is distinct from c.valor_total_centavos then
    raise exception 'Calendário ou soma das parcelas inválidos' using errcode = '23514';
  end if;
  intervalo := case c.faturamento when 'mensal' then 1 when 'bimensal' then 2 when 'trimestral' then 3
    when 'semestral' then 6 when 'anual' then 12 else null end;
  if intervalo is not null and (c.primeiro_faturamento is null or exists (
    select 1 from jsonb_to_recordset(p_faturas) as x(numero integer, data_faturamento date)
    where x.data_faturamento <> (c.primeiro_faturamento + make_interval(months => intervalo * (x.numero - 1)))::date
  )) then
    raise exception 'Periodicidade incompatível com as datas' using errcode = '23514';
  end if;
  if exists (select 1 from public.financeiro_faturas ff
    where ff.id in (select x.id from jsonb_to_recordset(p_faturas) as x(id uuid)) and ff.contrato_id <> c.id) then
    raise exception 'Parcela de outro contrato' using errcode = '23514';
  end if;
  if existente and exists (
    select 1 from public.financeiro_faturas ff where ff.contrato_id = c.id and ff.situacao = 'emitida'
    and (anterior.cliente_id <> c.cliente_id or anterior.projeto_id <> c.projeto_id or not exists (
      select 1 from jsonb_to_recordset(p_faturas) as x(id uuid, numero integer, data_faturamento date, valor_centavos bigint)
      where x.id = ff.id and x.numero = ff.numero and x.data_faturamento = ff.data_faturamento and x.valor_centavos = ff.valor_centavos
    ))
  ) then
    raise exception 'Não é permitido alterar faturas emitidas ou seus vínculos' using errcode = '23514';
  end if;
  if existente then
    update public.financeiro_contratos set titulo = btrim(c.titulo), cliente_id = c.cliente_id, projeto_id = c.projeto_id,
      vigencia = c.vigencia, parcelas = c.parcelas, faturamento = c.faturamento, primeiro_faturamento = c.primeiro_faturamento,
      valor_total_centavos = c.valor_total_centavos, texto_nfse = coalesce(c.texto_nfse,''), situacao = c.situacao,
      atualizado_em = clock_timestamp() where id = c.id;
  else
    insert into public.financeiro_contratos(id,titulo,cliente_id,projeto_id,vigencia,parcelas,faturamento,primeiro_faturamento,valor_total_centavos,texto_nfse,situacao)
      values (c.id,btrim(c.titulo),c.cliente_id,c.projeto_id,c.vigencia,c.parcelas,c.faturamento,c.primeiro_faturamento,c.valor_total_centavos,coalesce(c.texto_nfse,''),c.situacao);
  end if;
  -- Reduções do calendário preservam as parcelas retiradas, sem exclusão física.
  update public.financeiro_faturas ff set cancelada_em = clock_timestamp()
    where ff.contrato_id = c.id and ff.situacao = 'pendente' and ff.cancelada_em is null
      and ff.id not in (select x.id from jsonb_to_recordset(p_faturas) as x(id uuid));
  for f in select * from jsonb_to_recordset(p_faturas) as x(id uuid, numero integer, data_faturamento date, valor_centavos bigint) loop
    insert into public.financeiro_faturas(id,contrato_id,numero,data_faturamento,valor_centavos)
      values (f.id,c.id,f.numero,f.data_faturamento,f.valor_centavos)
      on conflict(id) do update set numero = excluded.numero, data_faturamento = excluded.data_faturamento,
        valor_centavos = excluded.valor_centavos, cancelada_em = null
        where public.financeiro_faturas.contrato_id = excluded.contrato_id;
    if not found then
      raise exception 'Parcela de outro contrato' using errcode = '23514';
    end if;
  end loop;
  return c.id;
end $$;

create function delta_cortex_private.emissao_fatura(p_fatura uuid, p_emitida boolean, p_data date, p_atualizado_em timestamptz)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare c public.financeiro_contratos;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(),'') not in ('admin','editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  select ct.* into c from public.financeiro_contratos ct
    join public.financeiro_faturas f on f.contrato_id = ct.id where f.id = p_fatura and f.cancelada_em is null for update of ct;
  if not found then raise exception 'Fatura indisponível' using errcode = '23514'; end if;
  if p_atualizado_em is null or c.atualizado_em <> p_atualizado_em then
    raise exception 'Contrato desatualizado' using errcode = '40001';
  end if;
  if p_emitida is null or (p_emitida and (c.situacao <> 'vigente' or p_data is null
    or p_data < date '1900-01-01' or p_data > (now() at time zone 'America/Sao_Paulo')::date)) then
    raise exception 'Emissão inválida' using errcode = '23514';
  end if;
  update public.financeiro_faturas set situacao = case when p_emitida then 'emitida' else 'pendente' end,
    emitida_em = case when p_emitida then p_data else null end where id = p_fatura;
  update public.financeiro_contratos set atualizado_em = clock_timestamp() where id = c.id;
  return true;
end $$;

create function public.delta_cortex_salvar_contrato(p_contrato jsonb, p_faturas jsonb, p_atualizado_em timestamptz)
returns uuid language sql security invoker set search_path = ''
as $$ select delta_cortex_private.salvar_contrato(p_contrato,p_faturas,p_atualizado_em) $$;
create function public.delta_cortex_emissao_fatura(p_fatura uuid, p_emitida boolean, p_data date, p_atualizado_em timestamptz)
returns boolean language sql security invoker set search_path = ''
as $$ select delta_cortex_private.emissao_fatura(p_fatura,p_emitida,p_data,p_atualizado_em) $$;
revoke all on function delta_cortex_private.salvar_contrato(jsonb,jsonb,timestamptz),
  delta_cortex_private.emissao_fatura(uuid,boolean,date,timestamptz),
  public.delta_cortex_salvar_contrato(jsonb,jsonb,timestamptz),
  public.delta_cortex_emissao_fatura(uuid,boolean,date,timestamptz) from public, anon, authenticated;
grant execute on function delta_cortex_private.salvar_contrato(jsonb,jsonb,timestamptz),
  delta_cortex_private.emissao_fatura(uuid,boolean,date,timestamptz),
  public.delta_cortex_salvar_contrato(jsonb,jsonb,timestamptz),
  public.delta_cortex_emissao_fatura(uuid,boolean,date,timestamptz) to authenticated;

commit;
