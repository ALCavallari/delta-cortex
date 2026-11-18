# Financeiro — Contratos e faturamentos

## Ativação

Revisar e aplicar **uma única vez**, antes de publicar esta versão, a migração
`migrations/20261118145714_financeiro_contratos.sql` no banco do Delta CorteX.
O desenvolvimento não executou essa migração no Supabase remoto.
Ela depende das tabelas `clientes`, `projetos` e da função existente
`delta_cortex_private.perfil_efetivo()`; não recria nem altera essas estruturas.
Não são necessárias variáveis de ambiente ou dependências adicionais.

A migração cria somente `financeiro_contratos`, `financeiro_faturas`, índices,
políticas de leitura e operações transacionais próprias do Financeiro. Usa os
mesmos IDs de cliente/projeto, sem importar dados locais ou criar demonstrações.

## Acesso

- Administradores e editores podem consultar, cadastrar/editar contratos e registrar a situação de emissão das faturas.
- Leitores podem consultar.
- Clientes, técnicos, usuários inativos, sem autorização ou com troca obrigatória de senha pendente não têm acesso financeiro.
- Não há gravação direta nas tabelas pelo navegador: as RPCs verificam o perfil no banco, validam os vínculos e executam cada alteração em uma transação.
- Conflitos de edição exigem atualizar a consulta; não sobrescrevem silenciosamente dados de outro dispositivo.

## Regras

- Até 240 parcelas por contrato. Valores positivos em reais, com duas casas decimais, armazenados como centavos inteiros (até R$ 9.999.999.999,99 por contrato).
- A soma das parcelas deve corresponder exatamente ao valor do contrato. “Distribuir valor” divide o saldo das parcelas pendentes, compensando centavos nas primeiras parcelas.
- Único/Faseado: datas manuais para cada parcela. Mensal/Bimensal/Trimestral/Semestral/Anual: intervalos de 1/2/3/6/12 meses a partir do primeiro faturamento.
- Datas preservam o dia original, limitadas ao último dia de meses menores (31/01 → 28/02 → 31/03). Não são criadas parcelas após a vigência: o usuário deve ajustar os campos quando o calendário a ultrapassar.
- Situações vigente/paralisado/encerrado são administradas explicitamente. Vigência vencida recebe indicação na lista, sem alteração automática do contrato.
- Pendências de contratos paralisados/encerrados continuam consultáveis, mas ficam fora das projeções. Faturas emitidas continuam no histórico.
- Faturas emitidas preservam número, valor, data e vínculos. Reduzir o calendário preserva as parcelas pendentes retiradas com cancelamento lógico, sem exclusão física.
- Ao editar, clientes/projetos inativos já vinculados podem ser preservados. Novos vínculos exigem cadastros ativos e o projeto deve pertencer ao cliente selecionado.

## Indicadores e emissão

O mês de referência corresponde à **data programada de faturamento**, mesmo se a
emissão tiver ocorrido em outro mês. A data real de emissão também é apresentada.
As projeções cobrem 12 meses, incluindo o atual, e a média usa esse mesmo horizonte.
Os filtros de cliente se aplicam aos indicadores, gráficos e faturamentos futuros.

“Registrar emissão” registra uma nota emitida externamente; **não gera NFS-e** e
não representa pagamento recebido. Retornar a pendente corrige a situação interna,
sem cancelar uma nota no órgão emissor. O botão “Emitir NFse” permanece desabilitado,
mesmo com parcelas selecionadas. A integração com o robô é uma etapa futura.

## Verificação desta implementação

- TypeScript e ESLint dos arquivos alterados.
- Build de produção com `npm run build -- --webpack`.
- Cálculos de moeda, centavos residuais, datas inválidas, fim de mês e anos bissextos.
- Migração executada em PostgreSQL isolado em memória (PGlite), com autenticação/perfis simulados: vínculos incompatíveis, soma divergente, datas fora da periodicidade, edição concorrente, preservação de faturas emitidas, cancelamento lógico e permissões de leitura/escrita.
- Não houve acesso ao banco remoto, emissão fiscal, teste de navegador, commit, push ou deploy. A validação funcional no ambiente real permanece para depois da aplicação da migração.
