# Story: QR Code PIX pagável no aplicativo bancário

## Status
Ready for Review

## Contexto
A story `2026-06-05-folha-pix-qrcode-favorecido.md` separou o favorecido PIX e criou um modal de QR Code nos lançamentos da folha. No teste real com o funcionário Fabio Da Silva, o app Mercado Pago exibiu a mensagem: "Não é possível pagar com este QR Code".

## Problema
O QR Code estava codificando apenas a chave PIX. Aplicativos bancários esperam que o QR Code PIX contenha um BR Code/EMV válido, equivalente ao Pix Copia e Cola, com os campos do arranjo PIX e CRC16.

## Objetivo
Gerar o QR Code PIX do modal com payload BR Code estático válido, contendo chave PIX, favorecido, cidade, valor líquido, txid e CRC16, para que aplicativos bancários consigam iniciar o pagamento.

## Acceptance Criteria
- [x] O QR Code do modal usa payload BR Code/EMV, não apenas a chave PIX.
- [x] O payload inclui GUI `br.gov.bcb.pix`, chave PIX, moeda BRL, país BR, favorecido, cidade, valor líquido, txid e CRC16.
- [x] O valor líquido exibido no modal é o mesmo valor usado no payload do QR Code.
- [x] O QR continua sem expor a chave PIX na célula da tabela de lançamentos.
- [x] Dados multi-tenant continuam usando os managers/cadastros existentes, sem alteração de paths Firebase.
- [x] O cadastro de funcionário PIX permite informar o tipo da chave (`CPF`, `CNPJ`, `Telefone`, `E-mail`, `Aleatória`) em `pixTipo`.
- [x] Chaves PIX CPF/CNPJ são enviadas no payload apenas com dígitos válidos.
- [x] Chaves PIX telefone são enviadas no payload em formato internacional `+55DDDNUMERO`.
- [x] Chaves PIX e-mail e aleatória são canonicalizadas sem alterar o significado da chave.
- [x] O modal exibe `Chave Pix` abaixo do QR Code para fallback manual do RH.
- [x] O modal do QR Code permite abrir a edição do funcionário e focar diretamente no campo `Chave PIX`.
- [x] Quando o campo `Nome` do PIX estiver vazio, o modal do QR usa o nome do funcionário como favorecido.
- [x] Campos de cadastro/edição PIX exibem instruções claras de formato para compatibilidade com o QR Code.
- [x] QR Code estático usa `txid` compatível `***` por padrão quando não há identificador Pix explícito.
- [x] O cache do QR Code no navegador é segregado por tenant para evitar reuso stale em troca de empresa sem reload.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Criar story para rastrear a correção.
- [x] Confirmar causa provável com documentação oficial do Pix.
- [x] Implementar gerador BR Code estático com CRC16.
- [x] Integrar QR Code do modal ao payload BR Code.
- [x] Adicionar testes de regressão para payload, CRC e ausência de chave na tabela.
- [x] Normalizar chave PIX por tipo antes de montar o BR Code.
- [x] Cobrir CPF, telefone, e-mail e chave aleatória em testes.
- [x] Adicionar `pixTipo` ao cadastro, snapshot de lançamento e QR Code.
- [x] Exibir chave Pix normalizada no modal do QR para uso manual em caso de erro no scanner.
- [x] Adicionar botão discreto de edição no modal do QR com foco no campo `funcionarioPix`.
- [x] Garantir fallback do favorecido PIX para o nome do funcionário quando `favorecidoPix` estiver vazio.
- [x] Adicionar textos de ajuda nos campos Nome, Chave PIX, Tipo da chave e Banco.
- [x] Ajustar QR estático para usar `62070503***` por padrão no campo EMV 62-05.
- [x] Rodar gates finais e atualizar File List.

## File List
- `docs/stories/2026-06-05-folha-pix-brcode-pagavel.md`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha.css`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-utils.js`
- `tests/folha-pix-qrcode.test.mjs`

## Análise técnica
- O Banco Central define que QR Code Pix segue o padrão BR Code/EMV.
- QR Code estático Pix contém a chave Pix obrigatória e pode conter valor, identificador de transação e informação adicional.
- A funcionalidade Pix Copia e Cola representa exatamente a mesma sequência de caracteres lida no QR Code.
- A correção deve ser local ao payload gerado para o QR; não exige mudança de schema Firebase nem migração de dados.
- O valor do QR vem do salário líquido já calculado para a linha/modal.
- A cidade do payload usa dados disponíveis do funcionário/empresa multi-tenant quando houver; caso contrário, usa fallback `BRASILIA`.
- O txid é derivado do ID da folha, limitado e normalizado para o BR Code.
- Chave telefone cadastrada como `DDDNUMERO`, `(DD) NUMERO` ou `55DDDNUMERO` precisa entrar no BR Code como `+55DDDNUMERO`, porque o DICT usa formato internacional para telefone.
- Sem `pixTipo`, uma chave numérica de 11 dígitos pode ser CPF ou telefone; por isso o cadastro agora persiste o tipo explicitamente e usa detecção apenas como compatibilidade para dados antigos.
- As instruções de campo orientam CPF/CNPJ sem máscara, telefone com DDD, e-mail completo e chave aleatória UUID para reduzir cadastro incompatível com QR Code.
- O botão de edição no modal do QR usa o `funcionarioId` preservado no cache do QR; a tabela de lançamentos continua exibindo apenas `Ver Qrcode`.
- Para PIX, `beneficiario` legado só é usado se não houver favorecido PIX nem nome do funcionário; isso evita exibir titular de conta bancária quando o campo `Nome` do PIX estiver vazio.
- O cache em `window.__folhaPixQrCodeData` é reiniciado quando o tenant atual muda, evitando QR gerado com dados de outra empresa na mesma sessão.
- Payload informado no teste real de Fabio Da Silva tinha CRC válido e chave CPF válida em formato de dígitos, mas usava txid alfanumérico interno (`62-05`); para compatibilidade com QR estático gerado fora de PSP, o sistema passa a usar `***` por padrão nesse campo.

## Validações
- `node --check folha_pagamento/folha-funcionarios.js`
- `node --check folha_pagamento/folha-utils.js`
- `node --check folha_pagamento/folha-main.js`
- `node --check folha_pagamento/folha-lancamentos.js`
- `node --test tests/folha-pix-qrcode.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test`
