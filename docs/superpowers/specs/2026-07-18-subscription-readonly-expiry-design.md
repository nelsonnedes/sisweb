# Design: assinatura expirada e modo leitura efetivo

## Contexto

O cadastro do tenant de validacao mantem `subscriptionStatus: active` e
`subscription.active: true`, embora `subscription.endDate` esteja vencida. O
frontend e a callable `grantReadOnlyGrace` aceitam o marcador textual antes de
avaliar a data, por isso a tela exibe estado ativo e o backend rejeita a carencia
com a mensagem de que uma assinatura ativa nao requer modo leitura.

## Decisao

Quando existir uma data final valida, ela sera a autoridade temporal para os
estados `active` e `trial_active`. Uma data futura mantem o acesso ativo; uma
data vencida resulta em `expired`, mesmo que marcadores legados ainda digam
`active`. Contas ativas sem data final permanecem compativeis com o comportamento
atual.

O modo leitura continua sendo concedido apenas pela callable autenticada, uma
unica vez por usuario e pelo prazo configurado em `lateGraceDays`. A correcao
nao habilita gravacoes para assinatura vencida e nao altera dados financeiros.

## Superficies

- `auth.js`: resolucao usada pelo guard e pela pagina de status.
- `firebaseService.js`: fallback do guard de escrita antes de `auth.js` estar
  disponivel.
- `functions/index.js`: validacao autoritativa de `grantReadOnlyGrace`.
- `subscription-status.html`: texto e fluxo do botao de modo leitura.
- `tests/subscription-readonly-expiry.test.mjs`: contrato comum e regressao.

## Criterios de aceite

- Um registro `active` com `endDate` vencida resolve para `expired`.
- Um registro `trial_active` com `endDate` vencida resolve para `expired`.
- Um registro `active` sem data final continua ativo.
- `grantReadOnlyGrace` aceita o tenant vencido, respeita consumo unico e nao
  aceita assinatura com data futura.
- O usuario em carencia acessa modulos em leitura, sem mutacoes.
- Functions e Hosting sao publicados antes do smoke autenticado.

## Fora de escopo

- Migracao massiva de todos os status historicos.
- Renovacao automatica ou alteracao de cobranca.
- Mudanca nas regras comerciais de duracao da carencia.

