begin;

alter table public.profissionais
  add column atribuicao text
  check (atribuicao in ('Fauna', 'Flora', 'Operação', 'Projeto', 'Socioeconomia', 'Topografia'));

create or replace function delta_cortex_private.preparar_visita()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
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

create or replace function public.delta_cortex_salvar_profissional(
  p_profissional jsonb, p_atualizado_em timestamptz, p_bancarios jsonb
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare p public.profissionais%rowtype := jsonb_populate_record(null::public.profissionais, p_profissional);
begin
  if p_atualizado_em is null then
    insert into public.profissionais (id, nome, origem_temporaria, cargo, registro_profissional,
      rg, cpf, cnpj, contato, email, endereco, atribuicao, placa_veiculo)
    values (p.id, p.nome, p.origem_temporaria, p.cargo, p.registro_profissional,
      p.rg, p.cpf, p.cnpj, p.contato, p.email, p.endereco, p.atribuicao, p.placa_veiculo);
  else
    update public.profissionais set nome = p.nome, origem_temporaria = p.origem_temporaria,
      cargo = p.cargo, registro_profissional = p.registro_profissional, rg = p.rg, cpf = p.cpf,
      cnpj = p.cnpj, contato = p.contato, email = p.email, endereco = p.endereco,
      atribuicao = p.atribuicao, placa_veiculo = p.placa_veiculo
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

commit;
