import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const IGNORED_DIRS = new Set(['.git', '.aiox-core', 'node_modules', '.firebase', 'audits']);
const INTERNAL_PATTERNS = [
  /^admin/i,
  /legacy/i,
  /template/i,
  /backup/i,
  /_bak/i,
  /_back/i,
  /_otimizado/i,
  /_versao_dev/i,
  /^aplicar_/i,
  /^corrigir_/i,
  /^limpar_/i,
  /^migrar/i,
  /^migrate/i,
  /^reset-/i,
  /^fix-/i,
  /^firebase-rules/i,
  /^verificar_/i,
  /^extrator_/i,
  /^auto_sync/i,
  /^sincronizar/i,
  /^migration-tool/i,
  /teste-/i,
  /normalizar-/i
];

const stripHtml = (value = '') => value
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function classifyRoute(route) {
  const file = route.replace(/\\/g, '/').split('/').pop() || route;
  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(file))) return 'internal';
  if (/^(login|oauth-callback|subscription|subscription-status|user-profile|company|ajuda|ajudabitolas)\.html$/i.test(file)) return 'account-support';
  return 'public-operational';
}

function findAround(source, index, size = 900) {
  return source.slice(Math.max(0, index), Math.min(source.length, index + size));
}

function extractTabs(source) {
  const tabs = [];
  const buttonRe = /<button\b[^>]*class=["'][^"']*\btab\b[^"']*["'][^>]*>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = buttonRe.exec(source))) {
    const html = match[0];
    const onclick = html.match(/onclick=["']([^"']+)["']/i)?.[1] || '';
    tabs.push({
      id: onclick.match(/showTab\(['"]([^'"]+)['"]\)/)?.[1] || '',
      label: stripHtml(match[1]),
      trigger: onclick
    });
  }
  const contentRe = /<div\b[^>]*id=["']([^"']+)["'][^>]*class=["'][^"']*\btab-content\b[^"']*["'][^>]*>/gi;
  while ((match = contentRe.exec(source))) {
    tabs.push({ id: match[1], label: match[1], trigger: 'tab-content' });
  }
  return uniqueBy(tabs, (tab) => `${tab.id}|${tab.label}`);
}

function extractModals(source) {
  const modals = [];
  const modalRe = /<div\b[^>]*id=["']([^"']+)["'][^>]*class=["'][^"']*(?:modal|modal-overlay)[^"']*["'][^>]*>/gi;
  let match;
  while ((match = modalRe.exec(source))) {
    const chunk = findAround(source, match.index);
    const title = chunk.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] || '';
    modals.push({
      id: match[1],
      title: stripHtml(title) || match[1]
    });
  }
  return uniqueBy(modals, (modal) => modal.id);
}

function extractActions(source) {
  const actions = [];
  const actionRe = /<button\b[^>]*(?:onclick=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/button>/gi;
  const keywords = /(relat|imprimir|exportar|csv|pdf|colunas|listar|modal|recibo|qrcode|danfe|mdf|folhas fechadas|resumo)/i;
  let match;
  while ((match = actionRe.exec(source))) {
    const label = stripHtml(match[2]);
    const onclick = match[1] || '';
    if (keywords.test(`${label} ${onclick}`)) {
      actions.push({ label, onclick });
    }
  }
  return uniqueBy(actions, (action) => `${action.label}|${action.onclick}`).slice(0, 80);
}

function extractLinks(source) {
  const links = [];
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(source))) {
    links.push({
      href: match[1],
      label: stripHtml(match[2])
    });
  }
  return uniqueBy(links, (link) => `${link.href}|${link.label}`);
}

function extractPage(file) {
  const source = readFileSync(file, 'utf8');
  const route = path.relative(ROOT, file).replace(/\\/g, '/');
  const title = stripHtml(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const h1 = stripHtml(source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  return {
    route,
    category: classifyRoute(route),
    title: title || h1 || route,
    h1,
    tabs: extractTabs(source),
    modals: extractModals(source),
    reportAndWindowActions: extractActions(source),
    links: extractLinks(source)
  };
}

function extractMenu() {
  const menuPath = path.join(ROOT, 'menu-component.js');
  const source = readFileSync(menuPath, 'utf8');
  const resolveRe = /resolveUrl\(['"]([^'"]+)['"]\)[^>]*>\s*(?:<i[^>]*><\/i>\s*)?([^<\n]+)/g;
  const menuRoutes = [];
  let match;
  while ((match = resolveRe.exec(source))) {
    menuRoutes.push({
      href: match[1],
      label: stripHtml(match[2]),
      category: classifyRoute(match[1])
    });
  }
  const loose = [
    ...source.matchAll(/class=["'][^"']*(support-link|about-link|logout-link|global-footer-contact|pwa-install-link)[^"']*["'][\s\S]{0,120}?>([^<]+)/g)
  ].map((item) => ({ kind: item[1], label: stripHtml(item[2]) }));
  return {
    routes: uniqueBy(menuRoutes, (route) => `${route.href}|${route.label}`),
    looseActions: uniqueBy(loose, (item) => `${item.kind}|${item.label}`)
  };
}

function buildInventory() {
  const pages = walk(ROOT)
    .map(extractPage)
    .sort((a, b) => a.route.localeCompare(b.route));
  return {
    generatedAt: new Date().toISOString(),
    menu: extractMenu(),
    summary: {
      totalPages: pages.length,
      publicOperational: pages.filter((page) => page.category === 'public-operational').length,
      accountSupport: pages.filter((page) => page.category === 'account-support').length,
      internal: pages.filter((page) => page.category === 'internal').length,
      tabs: pages.reduce((acc, page) => acc + page.tabs.length, 0),
      modals: pages.reduce((acc, page) => acc + page.modals.length, 0),
      reportAndWindowActions: pages.reduce((acc, page) => acc + page.reportAndWindowActions.length, 0)
    },
    pages
  };
}

const inventory = buildInventory();
const json = JSON.stringify(inventory, null, 2);
if (process.argv.includes('--write')) {
  const out = path.join(ROOT, 'docs', 'help-manual-inventory.generated.json');
  writeFileSync(out, `${json}\n`, 'utf8');
  console.log(`[inventory] ${out}`);
}
console.log(JSON.stringify(inventory.summary, null, 2));
