# Preparação da emissão nacional de NFS-e — v1.14.0

## Ativação

Revisar e aplicar separadamente a migração
`migrations/20261118173644_preparacao_nfse.sql`, **após**
`20261118145714_financeiro_contratos.sql`.
Nenhuma migração foi aplicada ao Supabase remoto durante este desenvolvimento.

A migração adiciona duas tabelas (`financeiro_configuracao_nfse` e
`financeiro_percentuais_nfse`) e campos opcionais em `financeiro_faturas`.
Não remove registros, não importa notas existentes e não altera valores de
contratos ou parcelas. Faturas antigas continuam válidas com os novos campos nulos.

Não são necessárias novas dependências ou variáveis de ambiente. Nenhum campo
recebe certificado ou senha. As notas reais fornecidas como referência não foram
copiadas para o repositório, para a pasta pública ou para o banco.

## Uso

1. Em Financeiro → Configurações de NFS-e, conferir município/códigos de serviço e preencher os dados do emitente. Os valores iniciais de município e classificação do serviço são referências editáveis; não representam uma configuração já salva.
2. Cadastrar o percentual aproximado total do Simples Nacional recebido da contabilidade para cada mês/ano.
3. Em Faturamentos e Projeções, abrir Dados da NFS-e de cada fatura pendente.
4. Definir competência fiscal, período dos serviços e descrição individual. O texto do contrato é uma sugestão inicial; é preciso salvar explicitamente o texto da fatura.
5. Selecionar as faturas e usar Revisar NFS-e. A revisão consulta os dados atuais do Supabase e destaca pendências de preenchimento.

O tomador é obtido pelo ID do cliente vinculado ao contrato. A descrição é da
fatura e o valor vem da parcela; não há cadastro duplicado de tomadores ou valores
fiscais independentes dos faturamentos.

O percentual do exemplo analisado (14,23%) corresponde a **pTotTribSN**:
percentual aproximado total dos tributos do Simples Nacional. Não é alíquota de
ISS nem um desconto automático do valor da nota. É armazenado em centésimos de
ponto percentual (1423), sem aritmética monetária ou arredondamento implícito.
Aceita 0 a 100%, com até duas casas decimais.

A seleção do percentual usa exclusivamente o **mês da competência fiscal salva**,
que pode ser diferente do período dos serviços ou da data de faturamento.
Não há fallback para mês anterior nem preenchimento automático com 14,23%.

## Preservação e acesso

- Admin/editor podem editar configurações, percentuais e preparação de faturas pendentes. Leitor pode consultar. Cliente/técnico/anon não têm acesso a esses dados financeiros.
- Tabelas possuem RLS e somente SELECT direto para usuários autorizados. Gravações passam por RPCs com validação de perfil, campos e controle de concorrência.
- A preparação de uma fatura emitida não pode ser editada.
- Registrar uma emissão manual preserva, no banco, a configuração, o percentual daquele mês e os dados da preparação disponíveis naquele momento. Alterar a configuração ou o percentual posteriormente não muda essa cópia.
- Essa cópia é um registro interno da preparação, **não uma prova dos dados autorizados na NFS-e externa**. Campos ausentes permanecem ausentes. Não há reconstrução retroativa para faturas antigas.
- Retornar a pendente mantém a cópia anterior armazenada. Uma nova confirmação de emissão manual substitui a cópia pela preparação daquele momento; isso não cancela nem reemite notas perante o órgão fiscal.

## Limites desta etapa

“Emitir NFse” permanece desabilitado. Não há comunicação com o emissor, assinatura,
XML fiscal, certificado, consulta de autorização nem emissão real. A revisão é
uma conferência dos dados básicos, não uma validação de todas as regras fiscais.

A próxima etapa depende do certificado, validação contábil de ISS/retenções/local
de prestação e demais parâmetros, implementação do leiaute vigente de DPS,
numeração própria da DPS, prevenção de duplicidades e testes em Produção Restrita.

## Verificações

TypeScript, ESLint e build de produção. Verificações locais de percentual e
competência, além de execução das duas migrações em PostgreSQL em memória com
perfis simulados: preservação de faturas antigas, concorrência, edição bloqueada
de emitidas, congelamento do percentual e isolamento por RLS. Não houve navegador,
emissão fiscal, consulta ao banco remoto, commit, push ou deploy.
