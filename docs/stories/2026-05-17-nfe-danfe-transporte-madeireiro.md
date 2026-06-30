# Story: Melhorias NF-e DANFE transporte e volumes

## Status
Ready for Review

## Contexto
Foi analisado o DANFE de referencia `15260318615107000100550010000016671252229617.pdf`, uma NF-e de venda de madeira serrada. O objetivo e melhorar o emissor NF-e, o XML e o PDF DANFE do Sisweb, com foco inicial em transporte, volumes, pesos, placa, ANTT/RNTC e cabecalho profissional, sem criar campos especificos de segmento neste primeiro ciclo.

## Diagnostico do PDF de referencia
- O DANFE informa `Pagina: 1 de 1`, mas o PDF gerou 2 paginas.
- A pagina 2 contem apenas data de impressao, placa e ANTT: `PLACA: QLD9056 /AL` e `ANTT: 044277243`.
- Placa, UF e ANTT/RNTC existem na operacao, mas nao ficaram nos campos proprios do quadro `Transportador/Volumes transportados`.
- O quadro de transporte contem transportador, frete, quantidade, especie, marca e pesos, mas deixa campos de placa e ANTT visualmente vazios.
- A quantidade `18152` parece representar `18,152 m3` sem separador decimal, enquanto no DANFE o campo `qVol` representa quantidade de volumes transportados.
- Produtos madeireiros usam NCM `44079990`, CFOP `6.101`, unidade `M3` e descricoes como madeira serrada em ripa, sarrafo, viga e vigota.

## Diagnostico do sistema atual
- `notas-fiscais.html` coleta apenas modalidade do frete e valor do frete.
- `nf-service.js` monta `transp` apenas com `{ modFrete }`.
- `nf-xml-builder.js` gera apenas `<transp><modFrete>...</modFrete></transp>`.
- `nf-danfe.js` imprime apenas `Modalidade do Frete`, sem transportadora, placa, ANTT/RNTC, volumes ou pesos.
- O DANFE e gerado no browser com jsPDF a partir de `nfeData`, nao a partir do XML autorizado.
- Ha risco no pos-emissao: `notas-fiscais.html` verifica `result.xmlData`, mas `nf-service.js` retorna `xml`.

## Acceptance Criteria
- [x] Tela de emissao permite preencher transporte completo de forma opcional e clara.
- [x] XML NF-e gera grupos `transporta`, `veicTransp`, `reboque`, `vol` e `lacres` apenas quando houver dados validos.
- [x] DANFE imprime transportador, CNPJ/CPF, IE, endereco, municipio, UF, placa, UF da placa, ANTT/RNTC, quantidade, especie, marca, numeracao, peso bruto e peso liquido.
- [x] DANFE nao gera pagina extra apenas por estouro de campos de transporte ou observacoes.
- [x] O escopo permanece generico, sem campos obrigatorios por segmento.
- [x] Configuracoes fiscais salvam preferencias por tenant sem apagar outros dados fiscais.
- [x] Testes cobrem XML/DANFE/transporte e campos opcionais.

## Implementacao
- `notas-fiscais.html` recebeu o bloco generico `Transporte e Volumes` na tela de emissao.
- Modalidades de frete `3` e `4` foram adicionadas ao select da NF-e.
- `montarTransporteFromForm()` monta `transp` com transportador, veiculo, ANTT/RNTC, volumes e pesos.
- Rascunho e emissao agora preservam `transp` completo.
- O prompt de DANFE pos-emissao deixou de depender de `result.xmlData`; o servico retorna `xml`, mas o DANFE usa o objeto NF-e.
- `nf-service.js` normaliza transporte de forma aditiva e limpa campos vazios.
- `nf-xml-builder.js` gera `transporta`, `veicTransp`, `reboque`, `vol` e `lacres` somente quando houver dados validos.
- `nf-danfe.js` passou a imprimir o quadro completo de transporte/volumes e a controlar quebra antes de totais/transporte.
- `nf-validator.js` valida placa, UF, documento do transportador, ANTT/RNTC, volumes e pesos.
- `nf-preferencias.js` ganhou defaults genericos de transporte por tenant, salvos em `preferencias` via `saveConfigSection`.

## Plano profissional de correcoes
1. Corrigir base de dados da NF-e de forma aditiva:
   - `transp.modFrete`
   - `transp.transporta.{cnpj,cpf,xNome,ie,xEnder,xMun,uf}`
   - `transp.veicTransp.{placa,uf,rntc}`
   - `transp.reboque[]`
   - `transp.vol[].{qVol,esp,marca,nVol,pesoL,pesoB,lacres[]}`
2. Melhorar tela de emissao:
   - bloco colapsavel `Transporte e volumes`;
   - presets `Sem transporte`, `Transportadora`, `Veiculo proprio`, `Destinatario retira`;
   - validacao visual de placa, UF, ANTT/RNTC, peso e volumes;
3. Atualizar XML:
   - preservar compatibilidade com notas sem transporte;
   - gerar tags opcionais somente se preenchidas;
   - evitar tags vazias que causam rejeicao;
   - mapear corretamente `RNTC` no XML e `ANTT` no DANFE.
4. Redesenhar DANFE:
   - cabecalho mais proximo do modelo oficial, com logo Storage-first quando disponivel;
   - chave de acesso em 11 grupos de 4 digitos;
   - bloco de transporte completo na primeira pagina;
   - tabela de itens com colunas fiscais e leitura mais clara;
   - dados adicionais com quebra controlada e continuacao correta.
5. Configuracoes por tenant:
   - criar preferencias de DANFE por empresa: mostrar logo, defaults de especie/marca/unidade, modelo de observacoes;
   - salvar via merge seguro/secao especifica, sem substituir o no fiscal inteiro.
6. Validacoes e observabilidade:
   - alertas antes da emissao para campos incoerentes;
   - teste automatico para XML de transporte;
   - teste automatico para DANFE nao vazar placa/ANTT para pagina extra;
   - log de payload fiscal sem dados sensiveis.

## File List
- `docs/stories/2026-05-17-nfe-danfe-transporte-madeireiro.md`
- `15260318615107000100550010000016671252229617.pdf`
- `notas-fiscais.html`
- `nf-service.js`
- `nf-xml-builder.js`
- `nf-danfe.js`
- `nf-validator.js`
- `nf-config.js`
- `nf-preferencias.js`
- `nf-tables.js`
- `tests/company-logo-storage-policy.test.mjs`

## Fontes tecnicas consultadas
- MOC 7.0 Anexo I - Leiaute e Regras de Validacao da NF-e/NFC-e.
- MOC 7.0 Anexo II - Manual de Especificacoes Tecnicas do DANFE e Codigo de Barras.
- FAQ SEFAZ RJ sobre diferenca entre NF-e e DANFE.

## Validacao desta etapa
- Analise estatica e extracao de texto do PDF de referencia.
- Analise do codigo atual sem edicao funcional.
- Consulta a documentacao fiscal oficial.
- `node --check` passou para os arquivos NF-e alterados.
- `npm test` passou com 6 testes.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `git diff --check` passou no escopo alterado, com apenas aviso LF/CRLF do Git no HTML.
