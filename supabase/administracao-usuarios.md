# Administração de Usuários

O projeto de produção é `znbfnayblyclavcjsbvg`. A migration [20261109175904_administracao_usuarios.sql](migrations/20261109175904_administracao_usuarios.sql) é incremental. Os papéis `editor` e `leitor` mantêm sua operação anterior até reclassificação explícita. Os administradores atuais continuam globais.

| Perfil | Entrada | Escopo |
| --- | --- | --- |
| Administrador | `/dashboard` e `/administracao/usuarios` | Acesso global, administração, cadastro de contas e vínculos |
| Cliente | Trabalho de Campo em `/acompanhamento` | Aba Mapa de Ocorrências dos projetos autorizados, somente leitura |
| Técnico | Trabalho de Campo em `/acompanhamento` e ferramenta de visita | Abas Trabalhos Cadastrados e Mapa de Ocorrências dos projetos designados, com visitas, registros, fotografias e camadas desses projetos |
| Editor ou leitor legado | `/dashboard` | Comportamento anterior, sem Administração de Usuários |

`acessos_usuarios` mantém papel, estado, nome de exibição, vínculo profissional opcional e data do convite. `usuarios_projetos` registra autorização explícita por usuário e projeto, sem derivar permissões de CPF ou CNPJ. Revogações mantêm o histórico. A auditoria privada registra autor, usuário afetado, operação, data e projeto quando aplicável. A alteração de perfil e os vínculos são gravados na mesma transação. A operação serializa alterações administrativas para preservar o último administrador ativo.

As políticas restritivas se combinam com as existentes para evitar leitura ou gravação ampla. A permissão é reavaliada no banco a cada nova consulta. O portal recebe uma projeção de ocorrências sem identificadores de autores, dados cadastrais pessoais, fotografias, relatórios ou arquivos do projeto. O técnico recebe apenas nomes e identificadores dos profissionais para seleção operacional, nomes dos contratantes associados e dados dos projetos designados. CPF, RG, contatos e dados bancários ficam fora das consultas desses perfis. Atribuir um profissional fixa o executor da conta nas novas visitas. Os dois buckets continuam privados. O aplicativo baixa arquivos com sessão autenticada e não emite URLs assinadas permanentes. Links assinados previamente emitidos por outras ferramentas podem permanecer válidos até expirar.

As funções privilegiadas ficam no schema privado, usam `search_path` vazio e verificam o perfil ou vínculo antes de consultar dados protegidos. Mantenha `delta_cortex_private` fora dos schemas expostos pela Data API. As funções públicas são wrappers com `SECURITY INVOKER`.

## Ordem de implantação

1. Confira as tabelas e políticas com [verificar_estrutura.sql](verificar_estrutura.sql). A centralização e a migration [de atribuições](migrations/20261109151417_atribuicao_profissionais.sql) precisam estar aplicadas antes desta atualização. Valide a migration administrativa em um ambiente separado com contas descartáveis. Aplique-a ao projeto correto após a revisão. Os administradores continuam usando os módulos existentes, e o acesso externo nasce bloqueado.
2. Antes de publicar a versão com cadastro manual, revise e aplique a [migration de cadastro manual](migrations/20261110153000_cadastro_manual_usuarios.sql). Na Vercel, preserve `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Configure `SUPABASE_SECRET_KEY` com a chave secreta `sb_secret_…` do mesmo projeto, exclusivamente no servidor. A chave atende à criação no Auth Admin e à confirmação da primeira troca após sucesso no Auth. O painel e a gestão dos vínculos usam a sessão do administrador.
3. Mantenha o cadastro público desativado e preserve a configuração global de confirmação de e-mail. O cadastro manual dispensa SMTP e `DELTA_CORTEX_SITE_URL`. Os convites já emitidos continuam usando o callback existente. A recuperação e códigos de reautenticação, quando solicitados pela política do Auth, dependem da configuração de e-mail.
4. Publique o frontend. Em ambiente de teste, valide o administrador atual, a criação de uma conta, o bloqueio das consultas com senha provisória, a primeira troca seguida de novo login e a alteração voluntária em **Meu Perfil**. Valide também o escopo dos projetos e o bloqueio após revogação.
5. Somente depois da validação, habilite o acesso externo no SQL Editor do projeto correto:

   ```sql
   update delta_cortex_private.administracao_config set externo_habilitado = true where id;
   ```

   Em **Administração de Usuários**, confirme o perfil e selecione os projetos em **Projetos autorizados**. O painel distingue confirmação da conta e ativação do acesso.

A senha provisória só é retornada na confirmação do cadastro. Se a conta Auth for criada e o registro dos vínculos falhar, a senha permanece indisponível. Confira a lista, vincule explicitamente a conta existente se necessário e use a recuperação de senha para restabelecer o acesso. As sessões abertas antes da conclusão da troca obrigatória precisam de um novo login.

## Relatórios do Trabalho de Campo

Aplique a [migration de gerenciamento de relatórios](migrations/20261110012723_gerenciamento_relatorios.sql) depois da administração de usuários e antes de publicar a versão com edição e exclusão. Administradores podem corrigir atividades e emitir um PDF revisado. A versão anterior é arquivada na mesma transação. A exclusão é lógica e os objetos antigos permanecem no Storage privado. A lista por projeto mantém os perfis que já tinham acesso aos relatórios.

Aplique também a [migration de emissão durante a visita](migrations/20261110015614_relatorio_visita_em_andamento.sql) antes de publicar o botão **Gerar Relatório**. Finalizar a visita apenas conclui o trabalho. Ao substituir um relatório a partir da visita, o novo PDF considera os registros disponíveis naquele momento e o anterior é arquivado.

## Reversão

Para suspender imediatamente Cliente e Técnico, execute no SQL Editor:

```sql
update delta_cortex_private.administracao_config set externo_habilitado = false where id;
```

Os vínculos, dados e auditoria ficam preservados. Se precisar reverter o frontend, mantenha esse bloqueio e as políticas restritivas. Investigue a causa antes de reabilitar os perfis externos.
