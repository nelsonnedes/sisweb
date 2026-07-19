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
- [x] Remover links móveis duplicados (.mobile-menu-link, .mobile-logout-link) que já existiam no dropdown engrenagem.
- [x] Corrigir inconsistência Font Awesome no `financas.html` (5.15.4 → 6.0.0).
- [x] Analisar `folha-menu-original-completo.css` por conflitos — sem conflitos, apenas z-index e display.
- [x] Verificação visual in loco via browser-use: menu consistente entre páginas, dropdowns funcionais, gear com itens corretos, sem duplicação no mobile.
- [x] Padronizar fonte do menu com Inter via `menu.css` — todas as páginas agora exibem o menu com a mesma fonte do `index.html` (Home).
- [x] Font Awesome 5.15.4 → 6.0.0 no `login.html` (consistência com demais páginas).
- [x] Teste `global-first-wave.test.mjs` atualizado para refletir remoção de `.mobile-menu-link`/`.mobile-logout-link`.
- [x] Classificar CPF/CNPJ no modal operacional pela sequencia alfanumerica limpa, compativel com CNPJ alfanumerico.
- [x] Preservar largura desktop do painel de alertas contra a especificidade do CSS generico de dropdown.

## Alterações de Código Efetuadas
- **[MODIFY] `openNewClientModal.js`**: modal de cliente agora suporta criação e edição, preserva aliases fiscais e expõe `openEditClientModal`.
- **[MODIFY] `openNewClientModal.js`**: classificacao fiscal usa 11 digitos para CPF e 14 caracteres, com os dois DVs numericos, para CNPJ alfanumerico; `documento` original continua preservado.
- **[MODIFY] `notas-fiscais.html`**: edição de destinatário NF-e passa a usar o modal compartilhado e recarrega o cliente selecionado após salvar.
- **[MODIFY] `menu-component.js`**: menu superior recebeu regras escopadas para itens e dropdowns. Removidos `.mobile-menu-link` e `.mobile-logout-link` (já disponíveis no dropdown engrenagem).
- **[MODIFY] `menu.css`**: reforço CSS escopado para manter consistência visual entre páginas. Removidas regras `.mobile-logout-link`.
- **[MODIFY] `menu.css`**: regra `main-menu .sisweb-menu-shell .alerts-panel` preserva largura de 420 px no desktop sem depender da ordem da cascata.
- **[MODIFY] `sw.js` / cachebusters**: versão `2026-07-01-alerts-overflow-fix-v1`.
- **[MODIFY] `financas.html`**: corrigido Font Awesome de v5.15.4 para v6.0.0 (consistência com demais páginas).
- **[MODIFY] `login.html`**: corrigido Font Awesome de v5.15.4 para v6.0.0 (mesmo motivo).
- **[MODIFY] `menu.css`**: adicionado `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` e `font-family: 'Inter', Arial, sans-serif` em todos os seletores do menu (`.menu-item`, `.dropdown-content a`, `.user-info`, etc.) — padroniza a fonte do menu em **todas as páginas**.
- **[MODIFY] `tests/global-first-wave.test.mjs`**: atualizadas asserções para remover verificações de `.mobile-menu-link`/`.mobile-logout-link` (deduplicados); adicionados `doesNotMatch` para confirmar ausência.
- **[ANALYSIS] `folha-menu-original-completo.css`**: apenas z-index e display — sem conflitos com menu global escopado.

## Evidências
- `node --check openNewClientModal.js`
- `node --check menu-component.js`
- `git diff --check`
- `node --test tests/client-supplier-fiscal-fields.test.mjs tests/company-logo-storage-policy.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/financas-contas-pagar-edit.test.mjs` -> 42/42
- `node --test tests/pwa-mobile-menu-session.test.mjs tests/client-supplier-fiscal-fields.test.mjs tests/commerce-responsive-pwa.test.mjs tests/pwa-install-icon.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/financas-contas-pagar-edit.test.mjs` -> 33/33
- `npm run lint`
- `npm run typecheck`
- `npm run build --if-present`
- `npm test` -> 192/192
- Revisao CodeRabbit de 2026-07-15: 32/32 testes focados e suite completa 223/223; lint, typecheck e build do Hosting aprovados.
- Preview `coderabbit-review-20260715` e Hosting live `a6dee04d9afafb59` publicados somente com frontend; os marcadores de menu, modal e CSS retornaram HTTP 200.
- Smoke HTTP pós-deploy:
  - `menu-component.js?v=2026-07-01-alerts-overflow-fix-v1` -> 200, sem `.mobile-menu-link`, com `settings-section settings-exit`
  - `sw.js` -> 200, `APP_VERSION = 2026-07-01-alerts-overflow-fix-v1`
  - `index.html` e `financas.html` -> 200, cachebuster do menu atualizado
- CodeRabbit: GitHub App instalado no PR; CLI local `coderabbit` não encontrado no PATH do Windows e WSL indisponível nesta máquina.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`
- `npm run security:postdeploy` -> 37/37
- Smoke publicado em `https://sisweb-7ce82.web.app`: cachebuster NF-e, `sw.js`, `openEditClientModal` e menu escopado confirmados.
- **Verificação visual/DOM em Chrome autenticado (2026-07-01):**
  - ✅ Menu principal horizontal com dropdowns funcionais (Vendas, Estoque, Financeiro, Cadastros, Romaneios)
  - ✅ Dropdown engrenagem com itens corretos: Instalar, Meu Perfil, Assinatura, Empresa, Ajuda, Suporte, Sobre, Sair
  - ✅ Sem links duplicados no menu mobile
  - ✅ Menu consistente entre Home, Vendas, Finanças e Folha de Pagamento
  - ⚠️ Folha de Pagamento redireciona para cadastro de empresa quando sem tenant configurado (comportamento esperado)
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive` (re-deploy pós-correção FA)
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive` (deploy pós-padronização fonte Inter + login.html FA)

## File List
- `openNewClientModal.js`
- `notas-fiscais.html`
- `menu-component.js`
- `menu.css`
- `vendas.html`
- `sw.js`
- `financas.html`
- `login.html`
- `tests/global-first-wave.test.mjs`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/financas-contas-pagar-edit.test.mjs`
- `docs/stories/2026-07-01-nf-cliente-menu-global.md`

## Status Final
**Story concluída.** Navegação visual validada. Menu padronizado com fonte Inter em todas as páginas. Próximo Codex que retornar saberá que:
- Menu global padronizado e escopado
- Itens duplicados removidos
- Visual verificado in loco
- `folha-menu-original-completo.css` não conflita com menu global
- Finanças e Login agora usam Font Awesome 6 (consistente)
- **Fonte Inter adicionada ao `menu.css`** — menu com mesma aparência em todas as páginas (Home, Financeiro, Vendas, Estoque, etc.)
- Deploy Firebase publicado com todas as correções
