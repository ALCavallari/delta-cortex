-- Aplicar após financeiro_contratos, separadamente e somente após revisão.
begin;

create table public.financeiro_configuracao_nfse (
  id boolean primary key default true check (id),
  razao_social text not null check (length(btrim(razao_social)) between 1 and 200),
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  inscricao_municipal text not null default '' check (length(inscricao_municipal) <= 30),
  email text not null check (length(email) between 3 and 254 and email like '%@%'),
  telefone text not null check (telefone ~ '^[0-9]{10,13}$'),
  cep text not null check (cep ~ '^[0-9]{8}$'),
  logradouro text not null check (length(btrim(logradouro)) between 1 and 200),
  numero text not null check (length(btrim(numero)) between 1 and 30),
  complemento text not null default '' check (length(complemento) <= 200),
  bairro text not null check (length(btrim(bairro)) between 1 and 100),
  municipio text not null check (length(btrim(municipio)) between 1 and 100),
  codigo_municipio text not null check (codigo_municipio ~ '^[0-9]{7}$'),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  codigo_tributacao_nacional text not null check (codigo_tributacao_nacional ~ '^[0-9]{6}$'),
  codigo_tributacao_municipal text not null check (codigo_tributacao_municipal ~ '^[0-9]{3}$'),
  codigo_nbs text not null check (codigo_nbs ~ '^[0-9]{9}$'),
  descricao_servico text not null check (length(btrim(descricao_servico)) between 1 and 200),
  atualizado_em timestamptz not null default clock_timestamp()
);
create table public.financeiro_percentuais_nfse (
  id date primary key check (id between date '1900-01-01' and date '9999-12-01' and extract(day from id) = 1),
  percentual_centesimos integer not null check (percentual_centesimos between 0 and 10000),
  atualizado_em timestamptz not null default clock_timestamp()
);
alter table public.financeiro_configuracao_nfse enable row level security;
alter table public.financeiro_percentuais_nfse enable row level security;
revoke all on public.financeiro_configuracao_nfse, public.financeiro_percentuais_nfse from public, anon, authenticated;
grant select on public.financeiro_configuracao_nfse, public.financeiro_percentuais_nfse to authenticated;
create policy financeiro_configuracao_nfse_leitura on public.financeiro_configuracao_nfse for select to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor','leitor'));
create policy financeiro_percentuais_nfse_leitura on public.financeiro_percentuais_nfse for select to authenticated
  using ((select delta_cortex_private.perfil_efetivo()) in ('admin','editor','leitor'));

alter table public.financeiro_faturas
  add column competencia_nfse date check (competencia_nfse between date '1900-01-01' and date '9999-12-31'),
  add column periodo_servicos text check (length(periodo_servicos) <= 200),
  add column descricao_nfse text check (length(descricao_nfse) <= 10000),
  add column preparacao_emissao jsonb;

create function delta_cortex_private.configurar_nfse(p_dados jsonb, p_atualizado_em timestamptz)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare c public.financeiro_configuracao_nfse; versao timestamptz;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(),'') not in ('admin','editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  select atualizado_em into versao from public.financeiro_configuracao_nfse where id for update;
  if versao is distinct from p_atualizado_em then
    raise exception 'Configuração desatualizada' using errcode = '40001';
  end if;
  c := jsonb_populate_record(null::public.financeiro_configuracao_nfse,p_dados);
  insert into public.financeiro_configuracao_nfse(id,razao_social,cnpj,inscricao_municipal,email,telefone,cep,
    logradouro,numero,complemento,bairro,municipio,codigo_municipio,uf,codigo_tributacao_nacional,codigo_tributacao_municipal,codigo_nbs,descricao_servico)
  values (true,btrim(c.razao_social),c.cnpj,coalesce(c.inscricao_municipal,''),btrim(c.email),c.telefone,c.cep,
    btrim(c.logradouro),btrim(c.numero),coalesce(c.complemento,''),btrim(c.bairro),btrim(c.municipio),c.codigo_municipio,c.uf,
    c.codigo_tributacao_nacional,c.codigo_tributacao_municipal,c.codigo_nbs,btrim(c.descricao_servico))
  on conflict(id) do update set razao_social=excluded.razao_social,cnpj=excluded.cnpj,inscricao_municipal=excluded.inscricao_municipal,
    email=excluded.email,telefone=excluded.telefone,cep=excluded.cep,logradouro=excluded.logradouro,numero=excluded.numero,
    complemento=excluded.complemento,bairro=excluded.bairro,municipio=excluded.municipio,codigo_municipio=excluded.codigo_municipio,
    uf=excluded.uf,codigo_tributacao_nacional=excluded.codigo_tributacao_nacional,codigo_tributacao_municipal=excluded.codigo_tributacao_municipal,
    codigo_nbs=excluded.codigo_nbs,descricao_servico=excluded.descricao_servico,atualizado_em=clock_timestamp()
    where public.financeiro_configuracao_nfse.atualizado_em = p_atualizado_em;
  if not found then raise exception 'Configuração desatualizada' using errcode = '40001'; end if;
  return true;
end $$;

create function delta_cortex_private.percentual_nfse(p_mes date, p_percentual integer, p_atualizado_em timestamptz)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare versao timestamptz;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(),'') not in ('admin','editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  select atualizado_em into versao from public.financeiro_percentuais_nfse where id = p_mes for update;
  if versao is distinct from p_atualizado_em then
    raise exception 'Percentual desatualizado' using errcode = '40001';
  end if;
  insert into public.financeiro_percentuais_nfse(id,percentual_centesimos) values(p_mes,p_percentual)
    on conflict(id) do update set percentual_centesimos=excluded.percentual_centesimos,atualizado_em=clock_timestamp()
    where public.financeiro_percentuais_nfse.atualizado_em = p_atualizado_em;
  if not found then raise exception 'Percentual desatualizado' using errcode = '40001'; end if;
  return true;
end $$;

create function delta_cortex_private.preparar_fatura_nfse(p_fatura uuid,p_competencia date,p_periodo text,p_descricao text,p_atualizado_em timestamptz)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare c public.financeiro_contratos;
begin
  if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(),'') not in ('admin','editor') then
    raise exception 'Operação não autorizada' using errcode = '42501';
  end if;
  select ct.* into c from public.financeiro_contratos ct join public.financeiro_faturas f on f.contrato_id = ct.id
    where f.id = p_fatura and f.cancelada_em is null for update of ct;
  if not found then raise exception 'Fatura indisponível' using errcode = '23514'; end if;
  if p_atualizado_em is null or c.atualizado_em <> p_atualizado_em then
    raise exception 'Fatura desatualizada' using errcode = '40001';
  end if;
  if p_competencia is null or p_competencia not between date '1900-01-01' and date '9999-12-31'
    or coalesce(length(btrim(p_periodo)),0) not between 1 and 200
    or coalesce(length(btrim(p_descricao)),0) not between 1 and 10000 then
    raise exception 'Dados fiscais incompletos' using errcode = '23514';
  end if;
  update public.financeiro_faturas set competencia_nfse=p_competencia,periodo_servicos=btrim(p_periodo),descricao_nfse=btrim(p_descricao)
    where id=p_fatura and situacao='pendente' and cancelada_em is null;
  if not found then raise exception 'Fatura emitida não pode ser editada' using errcode = '23514'; end if;
  update public.financeiro_contratos set atualizado_em=clock_timestamp() where id=c.id;
  return true;
end $$;

-- Preserva a preparação existente no momento em que se registra uma emissão manual.
-- Não representa XML autorizado nem confirma os dados de uma nota externa.
create function delta_cortex_private.congelar_preparacao_nfse()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c public.financeiro_contratos;
begin
  if new.situacao='emitida' and old.situacao='pendente' then
    if auth.uid() is null or coalesce(delta_cortex_private.perfil_efetivo(),'') not in ('admin','editor') then
      raise exception 'Operação não autorizada' using errcode='42501';
    end if;
    select * into c from public.financeiro_contratos where id=new.contrato_id;
    new.preparacao_emissao := jsonb_build_object('origem','registro_manual','registrado_em',clock_timestamp(),
      'competencia',new.competencia_nfse,'periodo',new.periodo_servicos,'descricao',new.descricao_nfse,
      'valor_centavos',new.valor_centavos,'contrato',c.titulo,
      'emitente',(select to_jsonb(cfg)-'id' from public.financeiro_configuracao_nfse cfg where id),
      'percentual',(select to_jsonb(p) from public.financeiro_percentuais_nfse p where p.id=date_trunc('month',new.competencia_nfse)::date),
      'tomador',(select jsonb_build_object('nome',cli.nome_razao_social,'cpf_cnpj',cli.cpf_cnpj,
        'cep',cli.cep,'logradouro',cli.logradouro,'numero',cli.numero,'complemento',cli.complemento,
        'bairro',cli.bairro,'cidade',cli.cidade,'estado',cli.estado) from public.clientes cli where cli.id=c.cliente_id));
  end if;
  return new;
end $$;
create trigger financeiro_congelar_preparacao before update on public.financeiro_faturas
  for each row execute function delta_cortex_private.congelar_preparacao_nfse();
revoke all on function delta_cortex_private.congelar_preparacao_nfse() from public,anon,authenticated;

create function public.delta_cortex_configurar_nfse(p_dados jsonb,p_atualizado_em timestamptz)
returns boolean language sql security invoker set search_path='' as $$select delta_cortex_private.configurar_nfse(p_dados,p_atualizado_em)$$;
create function public.delta_cortex_percentual_nfse(p_mes date,p_percentual integer,p_atualizado_em timestamptz)
returns boolean language sql security invoker set search_path='' as $$select delta_cortex_private.percentual_nfse(p_mes,p_percentual,p_atualizado_em)$$;
create function public.delta_cortex_preparar_fatura_nfse(p_fatura uuid,p_competencia date,p_periodo text,p_descricao text,p_atualizado_em timestamptz)
returns boolean language sql security invoker set search_path='' as $$select delta_cortex_private.preparar_fatura_nfse(p_fatura,p_competencia,p_periodo,p_descricao,p_atualizado_em)$$;
revoke all on function delta_cortex_private.configurar_nfse(jsonb,timestamptz),delta_cortex_private.percentual_nfse(date,integer,timestamptz),
  delta_cortex_private.preparar_fatura_nfse(uuid,date,text,text,timestamptz),public.delta_cortex_configurar_nfse(jsonb,timestamptz),
  public.delta_cortex_percentual_nfse(date,integer,timestamptz),public.delta_cortex_preparar_fatura_nfse(uuid,date,text,text,timestamptz) from public,anon,authenticated;
grant execute on function delta_cortex_private.configurar_nfse(jsonb,timestamptz),delta_cortex_private.percentual_nfse(date,integer,timestamptz),
  delta_cortex_private.preparar_fatura_nfse(uuid,date,text,text,timestamptz),public.delta_cortex_configurar_nfse(jsonb,timestamptz),
  public.delta_cortex_percentual_nfse(date,integer,timestamptz),public.delta_cortex_preparar_fatura_nfse(uuid,date,text,text,timestamptz) to authenticated;
commit;
