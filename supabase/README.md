# Centralização operacional do Delta CorteX

Projeto de destino `znbfnayblyclavcjsbvg`. O DDL inicial fornecido serve como referência para as cinco tabelas existentes. A migration versionada só acrescenta estruturas e validações.

## Instalação em outro ambiente

1. No SQL Editor do projeto de destino, execute [verificar_estrutura.sql](verificar_estrutura.sql). Compare colunas, políticas e buckets com o DDL inicial. Se houver divergências, revise o SQL incremental antes de aplicar.
2. Revise e execute [a migration de centralização](migrations/20261109133323_centralizacao_visitas_sistematicas.sql) uma única vez. Ela usa uma transação. Rode novamente a conferência e confirme RLS nas seis tabelas novas e `public = false` nos buckets.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Verifique as permissões em ambiente de teste com os papéis admin, editor e leitor e com usuário inativo.

## Fonte dos dados e integridade

- Clientes, Projetos, Corpo Técnico, Trabalho de Campo e mapas consultam o Supabase. Uma falha remota é reportada pela interface. O IndexedDB é acessado exclusivamente pelo painel de legado.
- Projetos vinculam o contratante de `public.clientes`. Visitas exigem projeto ativo e profissionais habilitados e gravam os nomes históricos. Os dados bancários ficam na tabela separada e as telas de campo consultam apenas os dados operacionais.
- Observações pertencem à visita de origem. Ocorrências pertencem também ao projeto, e eventos de resolução ou reabertura exigem uma visita do mesmo projeto. A mudança de situação e seu evento são gravados juntos, com rejeição da versão desatualizada. As tabelas de visita, registros e eventos são específicas de Visita Sistemática e permitem que levantamentos futuros tenham seus próprios modelos.
- KMZ/KML ficam em `delta-cortex-geograficos`. Fotografias carimbadas e PDFs ficam em `delta-cortex-visitas-sistematicas`. Os dois buckets são privados. A referência permanente é bucket/caminho, e a leitura é feita com download autenticado. PDFs recebem identificadores próprios por versão.
- O navegador processa e valida KMZ/KML antes de enviar. Arquivos acima de 6 MiB usam TUS. O banco confirma os metadados somente após verificar o objeto. Projeto e metadados, registro e fotografias, e relatório e atividades usam transações PostgreSQL. O upload e o banco são sistemas distintos. Após uma falha, a aplicação tenta remover apenas os objetos ainda sem referência. Uma interrupção pode deixar um objeto pendente, que deve ser revisado com os metadados antes de qualquer remoção administrativa.
- RLS concede leitura a membros ativos e gravação operacional a admin/editor. A função que altera a situação valida o papel e a versão antes de atualizar. O compartilhamento continua por envio deliberado de uma cópia do PDF, sem URL pública permanente.

## Backup e limpeza seletiva

1. Na origem e no perfil de navegador usados originalmente, entre como administrador ativo e abra **Dados locais anteriores à centralização**. Clique em **Inventariar dados locais**.
2. Examine os totais e os itens protegidos. A limpeza exige assinatura igual à amostra original, datas compatíveis e ausência de vínculos com conjuntos preservados. O histórico do código contém 2 clientes, 2 projetos, 4 profissionais, 1 visita e 2 registros de campo de demonstração. O código original não gerava fotografias, relatórios nem KMZ/KML de demonstração.
3. Clique em **Baixar backup ZIP**, confirme que o arquivo foi salvo e guarde-o em local restrito. O ZIP contém os dados e os binários originais.
4. Selecione somente os itens aptos que quer remover, confira os totais por tipo e digite **EXCLUIR**. A limpeza revalida o administrador, o conteúdo dos itens e os vínculos antes de confirmar uma única transação. Gere um novo inventário depois da operação.

## Migração de dados legítimos

Se o inventário contiver acervo legítimo, preserve o ZIP e revise a correspondência com o Supabase antes de importar. Compare clientes por CPF/CNPJ normalizado e profissionais por documento ou registro profissional validado. Reconcilie projetos pelo contratante e visitas pelo projeto, data e identificação. Trate visitas sem projeto por associação explícita. Importe primeiro cadastros e visitas, depois registros e eventos em ordem cronológica, e por fim fotografias, arquivos geográficos e PDFs originais. Verifique duplicidades por ID e pelo vínculo de negócio, preserve os IDs compatíveis, grave somente itens aprovados e confirme por leitura remota. O importador com reconciliação e preservação de histórico ainda precisa ser implementado. O painel atual inventaria, exporta e limpa somente exemplos comprovados.

O responsável confirmou a aplicação da migration e a operação centralizada no ambiente publicado. Esta etapa não introduz SQL adicional.

Referências oficiais para [segurança da Data API](https://supabase.com/docs/guides/api/securing-your-api) e [uploads TUS](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
