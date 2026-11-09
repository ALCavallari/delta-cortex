# Centralização operacional do Delta CorteX

Projeto de destino `znbfnayblyclavcjsbvg`. O DDL inicial fornecido serve como referência para as cinco tabelas existentes. A migration versionada só acrescenta estruturas e validações.

## Ordem de ativação

1. No SQL Editor do projeto de destino, execute [verificar_estrutura.sql](verificar_estrutura.sql). Compare colunas, políticas e buckets com o DDL inicial. Se houver divergências, revise o SQL incremental antes de aplicar.
2. Revise e execute [a migration de centralização](migrations/20261109133323_centralizacao_visitas_sistematicas.sql) uma única vez. Ela usa uma transação. Rode novamente a conferência e confirme RLS nas seis tabelas novas e `public = false` nos buckets.
3. Antes de desativar a operação local, exporte os dados dos dispositivos que registraram trabalho legítimo. Faça isso na mesma origem, perfil de navegador e dispositivo usados originalmente. O painel **Dados locais anteriores à centralização** exige um administrador ativo e gera um ZIP com inventário, dados e binários originais.
4. Revise os vínculos do legado antes de importar. Confirme clientes por CPF/CNPJ normalizado, profissionais por identificação validada, projetos pelo contratante e visitas por projeto. Separe dados inequívocos de demonstração, preserve conjuntos que contenham trabalho potencialmente real e reconcilie duplicidades com o banco. Mantenha as chaves originais onde forem compatíveis. Faça a importação somente após aprovação explícita do inventário e valide cada conjunto com leitura remota.
5. Configure `NEXT_PUBLIC_OPERACAO_SUPABASE=true` no ambiente que será compilado. Use também as duas variáveis Supabase já existentes. Valide primeiro em um ambiente de teste com os papéis admin, editor e leitor e com um usuário inativo. Publique somente depois de verificar o esquema, as permissões, os arquivos privados e a disponibilidade dos dados necessários.

## Fonte dos dados e integridade

- Clientes sempre usa `public.clientes`. Com a operação centralizada ativa, Projetos, Corpo Técnico, Trabalho de Campo e mapas consultam o Supabase. Falhas remotas são devolvidas para a interface. A chave de ativação permite manter a versão local durante o preparo da publicação.
- Projetos vinculam o contratante de `public.clientes`. Visitas exigem projeto ativo e profissionais habilitados e gravam os nomes históricos. Os dados bancários ficam na tabela separada e as telas de campo consultam apenas os dados operacionais.
- Observações pertencem à visita de origem. Ocorrências pertencem também ao projeto, e eventos de resolução ou reabertura exigem uma visita do mesmo projeto. A mudança de situação e seu evento são gravados juntos, com rejeição da versão desatualizada. As tabelas de visita, registros e eventos são específicas de Visita Sistemática e permitem que levantamentos futuros tenham seus próprios modelos.
- KMZ/KML ficam em `delta-cortex-geograficos`. Fotografias carimbadas e PDFs ficam em `delta-cortex-visitas-sistematicas`. Os dois buckets são privados. A referência permanente é bucket/caminho, e a leitura é feita com download autenticado. PDFs recebem identificadores próprios por versão.
- O navegador processa e valida KMZ/KML antes de enviar. Arquivos acima de 6 MiB usam TUS. O banco confirma os metadados somente após verificar o objeto. Projeto e metadados, registro e fotografias, e relatório e atividades usam transações PostgreSQL. O upload e o banco são sistemas distintos. Após uma falha, a aplicação tenta remover apenas os objetos ainda sem referência. Uma interrupção pode deixar um objeto pendente, que deve ser revisado com os metadados antes de qualquer remoção administrativa.
- RLS concede leitura a membros ativos e gravação operacional a admin/editor. A função que altera a situação valida o papel e a versão antes de atualizar. O compartilhamento continua por envio deliberado de uma cópia do PDF, sem URL pública permanente.

## Legado e verificação

O inventário aponta IDs históricos associados às sementes para revisão. Um ID sozinho não prova que a linha permaneceu fictícia. O ZIP inclui todos os dados e não altera o IndexedDB. A limpeza seletiva e o importador com reconciliação de IDs e preservação de histórico ainda precisam ser concluídos antes de transferir acervos reais. Em particular, visitas antigas sem projeto exigem associação administrativa explícita.

O esquema original não foi reaplicado. A migration foi ensaiada com um PostgreSQL local usando um esquema de teste. Ainda é necessário comparar o estado atual do projeto Supabase com o DDL fornecido e validar TUS, RLS e a leitura em dispositivos diferentes no ambiente de destino.

Referências oficiais para [segurança da Data API](https://supabase.com/docs/guides/api/securing-your-api) e [uploads TUS](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
