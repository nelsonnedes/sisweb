# MDF-e: Persistencia e Operacao Fiscal Real

## Escopo

Substituir a emissao simulada do MDF-e por um fluxo seguro que gera o XML modelo 58/v3.00 no cliente a partir do formulario, reserva numeracao no backend, assina com certificado A1 no backend e transmite por mTLS a SEFAZ. Consulta e encerramento usam o mesmo tenant e certificado.

## Decisoes

- O tenant e resolvido pela sessao autenticada; o cliente nao escolhe um tenant arbitrario.
- O PFX e a senha nunca sao enviados para o navegador como segredo persistente; a senha e usada apenas na chamada fiscal e o certificado e descriptografado no backend.
- Homologacao e o ambiente padrao. Producao depende da configuracao fiscal persistida e de confirmacao explicita na interface.
- O primeiro roteamento usa os webservices SVRS oficiais para MDF-e; UFs com endpoint proprio devem ser adicionadas por configuracao antes de uso produtivo.
- XML assinado e retorno fiscal ficam no Storage/Realtime Database tenant-scoped, sem salvar senha ou PFX.

## Componentes

- `mdfe-xml-builder.js`: gera chave, XML pre-assinatura e dados obrigatorios de percurso, veiculo, condutor, documentos e totais.
- `mdf-e.js`: resolve tenant, carrega MDF-es, reserva numero, chama as Functions e atualiza a UI somente depois da resposta autoritativa.
- `functions/mdfe-functions.js`: valida acesso, reserva sequencia, assina XML, transmite/consulta/encerra via mTLS e persiste status/retorno.
- `cities-loader.js`: expoe consulta de codigo IBGE para que nomes de municipios nao sejam enviados sem codigo fiscal.

## Contratos

- Colecao: `companies/{tenantId}/fiscal/mdfe/{mdfeId}`.
- Sequencia: `companies/{tenantId}/fiscal/sequences/mdfe`.
- XML: `companies/{tenantId}/fiscal/xmls/mdfe/{mdfeId}.xml`.
- Callables: `mdfe_reservarNumero`, `mdfe_emitir`, `mdfe_consultar` e `mdfe_encerrar`.

## Seguranca e falhas

- Acesso exige Auth e membership ativa no tenant.
- O backend valida estrutura minima do XML, certificado A1, ambiente e retorno SEFAZ.
- Falha de assinatura/transmissao marca o registro como `erro_envio` ou `rejeitado`, sem informar sucesso ao usuario.
- Nao ha chamada real de producao durante smoke automatizado; homologacao exige certificado, senha e dados fiscais fornecidos pelo owner.

## Validacao

- Testes estaticos para contrato de tenant, sequencia, modelo 58, endpoints e ausencia de simulacao.
- `node --check` no builder e Functions, lint de Functions e suite raiz.
- Smoke autenticado visual em `390x844`/`1280x800` sem emitir documento real.
