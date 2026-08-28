# Spec: Adaptação Mobile do Emissor NF-e

**Data:** 2026-08-26  
**Status:** Aprovado pelo usuário para implementação

## Objetivo

Adaptar a emissão, consulta e configuração de NF-e para uso em telas pequenas, eliminando overflow e sobreposição sem alterar payload fiscal, XML, Storage ou emissão.

## Decisão

- As tabelas operacionais de itens, volumes, consulta e naturezas usam o contrato tabela → cards até 768px.
- Cada célula preserva seu valor e recebe `data-label`; a coluna de ações permanece acessível com botões touch-friendly.
- O stepper continua com rolagem horizontal; os painéis e campos internos ficam em uma coluna.
- Seletores compostos de cliente e natureza mudam de flex horizontal para grid responsivo.
- Modais dinâmicos de item, cliente, eventos fiscais e natureza respeitam `100dvh`, body rolável e footer acessível.
- A versão do Service Worker será atualizada para evitar mistura de HTML/CSS antigo no PWA.

## Fora de escopo

- Alterar regras fiscais, cálculo, XML, emissão, Functions, Rules, Storage ou dados reais.
- Transformar DANFE/PDF em cards, pois são documentos de impressão.

## Validação

- Testes estáticos para classes, labels, layout mobile e diagnóstico válido.
- Smoke sem persistência em `320x480`, `390x844`, `768x1024` e `1280x800`.
