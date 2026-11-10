# Administração de Usuários

O projeto de produção é `znbfnayblyclavcjsbvg`. A migration [20261109175904_administracao_usuarios.sql](migrations/20261109175904_administracao_usuarios.sql) é incremental. Os papéis `editor` e `leitor` mantêm sua operação anterior até reclassificação explícita. Os administradores atuais continuam globais.

| Perfil | Entrada | Escopo |
| --- | --- | --- |
| Administrador | `/dashboard` e `/administracao/usuarios` | Acesso global, administração, convites e vínculos |
| Cliente | Trabalho de Campo em `/acompanhamento` | Aba Mapa de Ocorrências dos projetos autorizados, somente leitura |
| Técnico | Trabalho de Campo em `/acompanhamento` e ferramenta de visita | Abas Trabalhos Cadastrados e Mapa de Ocorrências dos projetos designados, com visitas, registros, fotografias e camadas desses projetos |
| Editor ou leitor legado | `/dashboard` | Comportamento anterior, sem Administração de Usuários |

`acessos_usuarios` mantém papel, estado, nome de exibição, vínculo profissional opcional e data do convite. `usuarios_projetos` registra autorização explícita por usuário e projeto, sem derivar permissões de CPF ou CNPJ. Revogações mantêm o histórico. A auditoria privada registra autor, usuário afetado, operação, data e projeto quando aplicável. A alteração de perfil e os vínculos são gravados na mesma transação. A operação serializa alterações administrativas para preservar o último administrador ativo.

As políticas restritivas se combinam com as existentes para evitar leitura ou gravação ampla. A permissão é reavaliada no banco a cada nova consulta. O portal recebe uma projeção de ocorrências sem identificadores de autores, dados cadastrais pessoais, fotografias, relatórios ou arquivos do projeto. O técnico recebe apenas nomes e identificadores dos profissionais para seleção operacional, nomes dos contratantes associados e dados dos projetos designados. CPF, RG, contatos e dados bancários ficam fora das consultas desses perfis. Atribuir um profissional fixa o executor da conta nas novas visitas. Os dois buckets continuam privados. O aplicativo baixa arquivos com sessão autenticada e não emite URLs assinadas permanentes. Links assinados previamente emitidos por outras ferramentas podem permanecer válidos até expirar.

As funções privilegiadas ficam no schema privado, usam `search_path` vazio e verificam o perfil ou vínculo antes de consultar dados protegidos. Mantenha `delta_cortex_private` fora dos schemas expostos pela Data API. As funções públicas são wrappers com `SECURITY INVOKER`.

## Ordem de implantação

1. Confira as tabelas e políticas com [verificar_estrutura.sql](verificar_estrutura.sql). A centralização e a migration [de atribuições](migrations/20261109151417_atribuicao_profissionais.sql) precisam estar aplicadas antes desta atualização. Valide a migration administrativa em um ambiente separado com contas descartáveis. Aplique-a ao projeto correto após a revisão. Os administradores continuam usando os módulos existentes, e o acesso externo nasce bloqueado.
2. Na Vercel, preserve `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Adicione `SUPABASE_SECRET_KEY` com a chave secreta `sb_secret_…` do mesmo projeto e `DELTA_CORTEX_SITE_URL=https://delta-cortex.vercel.app`. As duas novas variáveis são exclusivas do servidor. A chave secreta é usada somente para a chamada Auth Admin de convite. O painel e a edição de contas existentes usam a sessão do administrador.
3. No Supabase Auth, mantenha cadastro público desativado, confirme a entrega por SMTP e autorize o redirecionamento `https://delta-cortex.vercel.app/auth/convite`. No template **Invite user**, use um link de confirmação com:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Aceitar convite</a>
   ```

   O callback verifica o token e encaminha para definir a senha. Se o convite expirar, a tela orienta a solicitar a recuperação para o e-mail convidado. Uma conta já existente só é vinculada mediante escolha explícita. Se o envio for confirmado e a transação de acesso falhar, a conta continua sem acesso corporativo e pode ser vinculada em nova tentativa. Confira a configuração do [Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) e os [templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates).
4. Publique o frontend. Valide o administrador atual, os papéis legados e a página administrativa. Em um ambiente de teste, valide também o fluxo de convite e tente consultar projeto, ocorrência, RPC e arquivo privado com uma conta de outro projeto e novamente depois de revogar o vínculo. Confirme também que Cliente e Técnico não leem dados cadastrais sensíveis.
5. Somente depois da validação, habilite o acesso externo no SQL Editor do projeto correto:

   ```sql
   update delta_cortex_private.administracao_config set externo_habilitado = true where id;
   ```

   Em **Administração de Usuários**, confirme o perfil e selecione os projetos em **Projetos autorizados**. O painel distingue confirmação da conta e ativação do acesso.

## Reversão

Para suspender imediatamente Cliente e Técnico, execute no SQL Editor:

```sql
update delta_cortex_private.administracao_config set externo_habilitado = false where id;
```

Os vínculos, dados e auditoria ficam preservados. Se precisar reverter o frontend, mantenha esse bloqueio e as políticas restritivas. Investigue a causa antes de reabilitar os perfis externos.
