-- Consulta somente leitura. Executar no SQL Editor de znbfnayblyclavcjsbvg.
-- Antes da migration, conferir os cinco cadastros com o DDL original.
-- Depois, conferir também as tabelas operacionais e administrativas e os dois buckets privados.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name in ('clientes','projetos','profissionais','profissionais_dados_bancarios','acessos_usuarios',
     'projeto_arquivos_geograficos','usuarios_projetos') or table_name like 'visitas_sistematicas%')
order by table_name, ordinal_position;

select c.conrelid::regclass as tabela, c.conname, pg_get_constraintdef(c.oid) as definicao
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace s on s.oid = t.relnamespace
where s.nspname = 'public'
  and (t.relname in ('clientes','projetos','profissionais','profissionais_dados_bancarios','acessos_usuarios',
    'projeto_arquivos_geograficos','usuarios_projetos') or t.relname like 'visitas_sistematicas%')
order by tabela, c.conname;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
  and (table_name in ('clientes','projetos','profissionais','profissionais_dados_bancarios','acessos_usuarios',
    'projeto_arquivos_geograficos','usuarios_projetos') or table_name like 'visitas_sistematicas%')
order by table_name, grantee, privilege_type;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and (tablename in ('clientes','projetos','profissionais','profissionais_dados_bancarios','acessos_usuarios',
     'projeto_arquivos_geograficos','usuarios_projetos') or tablename like 'visitas_sistematicas%')
order by tablename;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'storage' and tablename = 'objects')
   or (schemaname = 'public' and (tablename in ('clientes','projetos','profissionais',
      'profissionais_dados_bancarios','acessos_usuarios','projeto_arquivos_geograficos','usuarios_projetos')
      or tablename like 'visitas_sistematicas%'))
order by schemaname, tablename, policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('delta-cortex-geograficos','delta-cortex-visitas-sistematicas');
