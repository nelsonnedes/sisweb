# Story: Padronização de cliente NF-e e menu global

## Contexto e Objetivo
Padronizar os botões de Novo Cliente e Editar cliente selecionado em `notas-fiscais.html` para usar o mesmo modal operacional de cliente já usado nos pedidos, com campos fiscais opcionais para NF-e, rodapé fixo e corpo rolável.

Padronizar o menu superior para manter a aparência do `index.html` nas demais páginas, reduzindo interferência de CSS local em itens e dropdowns do componente `main-menu`.

## Checklist de Implementação
- [x] Reutilizar o modal canônico de cliente em criação e edição operacional.
- [x] Fazer NF-e delegar edição para `openEditClientModal` sem manter modal paralelo.
- [x] Compatibilizar carregamento de cidades com `cities-loader.js` e `cities.js`.
- [x] Escopar estilos do menu principal em `main-menu .sisweb-menu-shell`.
- [x] Atualizar cachebusters e Service Worker para publicação PWA.
- [x] Cobrir regressão com testes automatizados.

## Alterações de Código Efetuadas
- **[MODIFY] `openNewClientModal.js`**: modal de cliente agora suporta criação e edição, preserva aliases fiscais e expõe `openEditClientModal`.
- **[MODIFY] `notas-fiscais.html`**: edição de destinatário NF-e passa a usar o modal compartilhado e recarrega o cliente selecionado após salvar.
- **[MODIFY] `menu-component.js`**: menu superior recebeu regras escopadas para itens e dropdowns.
- **[MODIFY] `menu.css`**: reforço CSS escopado para manter consistência visual entre páginas.
- **[MODIFY] `sw.js` / cachebusters**: versão `2026-07-01-nf-client-menu-v1`.

## Evidências
- `node --check openNewClientModal.js`
- `node --check menu-component.js`
- `git diff --check`
- `node --test tests/client-supplier-fiscal-fields.test.mjs tests/company-logo-storage-policy.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/financas-contas-pagar-edit.test.mjs` -> 42/42
- `npm run lint`
- `npm run typecheck`
- `npm run build --if-present`
- `npm test` -> 192/192
- CodeRabbit: GitHub App instalado no PR; CLI local `coderabbit` não encontrado no PATH do Windows e WSL indisponível nesta máquina.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`
- `npm run security:postdeploy` -> 37/37
- Smoke publicado em `https://sisweb-7ce82.web.app`: cachebuster NF-e, `sw.js`, `openEditClientModal` e menu escopado confirmados.

## File List
- `openNewClientModal.js`
- `notas-fiscais.html`
- `menu-component.js`
- `menu.css`
- `vendas.html`
- `sw.js`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/financas-contas-pagar-edit.test.mjs`
- `docs/stories/2026-07-01-nf-cliente-menu-global.md`
