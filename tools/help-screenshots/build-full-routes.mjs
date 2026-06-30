import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const inventoryPath = path.join(projectRoot, 'docs', 'help-manual-inventory.generated.json');
const outputPath = path.join(__dirname, 'routes.full-training.generated.json');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

const excludedRoutes = new Set(['oauth-callback.html']);
const scenarioByRoute = new Map([
  ['index.html', 'inicio'],
  ['company.html', 'empresa'],
  ['client.html', 'cadastros'],
  ['fornecedor.html', 'cadastros-fornecedor'],
  ['species.html', 'cadastros-especies'],
  ['importar_especies.html', 'cadastros-importar-especies'],
  ['preromaneio.html', 'romaneios'],
  ['romaneiotl.html', 'romaneio-tl'],
  ['romaneiopct.html', 'romaneio-pct'],
  ['romaneiopes.html', 'romaneio-pes'],
  ['romaneiotora.html', 'romaneio-tora'],
  ['vendas.html', 'vendas'],
  ['compras.html', 'compras'],
  ['estoque.html', 'estoque'],
  ['financas.html', 'financas'],
  ['folha_pagamento/folha.html', 'folha'],
  ['notas-fiscais.html', 'fiscal'],
  ['mdf-e.html', 'mdfe'],
  ['subscription-status.html', 'assinatura'],
  ['subscription.html', 'assinatura-pagamento'],
  ['user-profile.html', 'perfil'],
  ['ajuda.html', 'ajuda'],
  ['ajudabitolas.html', 'ajuda-bitolas'],
  ['login.html', 'login']
]);

const slug = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\.html$/i, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72) || 'item';

const routeSlug = (route) => slug(route.replace(/^folha_pagamento\//, 'folha-'));

function baseActions(route) {
  const actions = [{ type: 'trainingPage', route }];
  const scenario = scenarioByRoute.get(route);
  if (scenario) actions.push({ type: 'training', name: scenario });
  return actions;
}

function pushUnique(routes, seen, item) {
  if (seen.has(item.id)) return;
  seen.add(item.id);
  routes.push(item);
}

function buildRoutes() {
  const routes = [];
  const seen = new Set();
  const pages = inventory.pages
    .filter((page) => page.category !== 'internal')
    .filter((page) => !excludedRoutes.has(page.route));

  for (const page of pages) {
    const pageId = routeSlug(page.route);
    pushUnique(routes, seen, {
      id: `${pageId}-overview`,
      path: page.route,
      title: page.title,
      actions: baseActions(page.route)
    });

    for (const tab of page.tabs || []) {
      const tabId = tab.id || tab.label;
      if (!tabId) continue;
      pushUnique(routes, seen, {
        id: `${pageId}-tab-${slug(tabId)}`,
        path: page.route,
        title: `${page.title} - ${tab.label || tabId}`,
        actions: [
          ...baseActions(page.route),
          { type: 'trainingTab', id: tabId, label: tab.label || tabId }
        ]
      });
    }

    for (const modal of page.modals || []) {
      pushUnique(routes, seen, {
        id: `${pageId}-modal-${slug(modal.id)}`,
        path: page.route,
        title: `${page.title} - ${modal.title || modal.id}`,
        actions: [
          ...baseActions(page.route),
          { type: 'trainingModal', id: modal.id, title: modal.title || modal.id }
        ]
      });
    }

    for (const [index, action] of (page.reportAndWindowActions || []).entries()) {
      const label = action.label || action.onclick || `acao-${index + 1}`;
      pushUnique(routes, seen, {
        id: `${pageId}-acao-${slug(label).slice(0, 48) || index + 1}`,
        path: page.route,
        title: `${page.title} - ${label}`,
        actions: [
          ...baseActions(page.route),
          { type: 'trainingAction', label, onclick: action.onclick || '' }
        ]
      });
    }
  }

  const mobilePages = ['index.html', 'vendas.html', 'compras.html', 'estoque.html', 'financas.html', 'folha_pagamento/folha.html', 'ajuda.html'];
  for (const route of mobilePages) {
    if (!pages.some((page) => page.route === route)) continue;
    const pageId = routeSlug(route);
    pushUnique(routes, seen, {
      id: `${pageId}-mobile`,
      path: route,
      title: `${route} - Mobile/PWA`,
      viewport: { width: 390, height: 844 },
      actions: [
        ...baseActions(route),
        { type: 'trainingMobile' }
      ]
    });
  }

  return routes;
}

const routes = buildRoutes();
writeFileSync(outputPath, `${JSON.stringify(routes, null, 2)}\n`, 'utf8');
console.log(`[routes] ${outputPath}`);
console.log(JSON.stringify({ routes: routes.length }, null, 2));
