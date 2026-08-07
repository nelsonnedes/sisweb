#!/usr/bin/env node
/**
 * smoke-preview-hosting.mjs
 *
 * Smoke tests para Hosting (live ou preview channel).
 * Valida rotas críticas, presença de scripts Firebase e assets referenciados.
 *
 * Uso:
 *   SISWEB_BASE_URL=https://sisweb-7ce82.web.app node tools/smoke-preview-hosting.mjs
 *   SISWEB_BASE_URL=https://sisweb-7ce82--preview-abc.web.app node tools/smoke-preview-hosting.mjs
 */

const DEFAULT_BASE_URL = 'https://sisweb-7ce82.web.app/';
const baseUrl = new URL(process.env.SISWEB_BASE_URL || DEFAULT_BASE_URL);
const timeoutMs = Number.parseInt(process.env.SISWEB_CHECK_TIMEOUT_MS || '15000', 10);
const checkAssets = process.env.SISWEB_SMOKE_CHECK_ASSETS !== '0';

/** @type {{ path: string; title: string; mustMatch: RegExp[]; scriptHints?: RegExp[] }[]} */
const CRITICAL_ROUTES = [
  {
    path: '/',
    title: 'Home',
    mustMatch: [/<html[\s>]/i, /firebase-init\.js|firebaseService\.js|auth\.js/i],
  },
  {
    path: '/login.html',
    title: 'Login',
    mustMatch: [/<html[\s>]/i, /firebase-init\.js/i, /firebaseService\.js/i],
    scriptHints: [/firebase-init\.js\?v=[0-9a-f]{12}/i],
  },
  {
    path: '/company.html',
    title: 'Empresa',
    mustMatch: [/<html[\s>]/i, /firebase-init\.js/i, /firebaseService\.js/i, /updateMyCompanyProfile/i],
  },
  {
    path: '/admin.html',
    title: 'Admin',
    mustMatch: [/<html[\s>]/i, /auth\.js|firebase-init\.js|firebaseService\.js/i],
  },
  {
    path: '/compras.html',
    title: 'Compras',
    mustMatch: [/<html[\s>]/i, /compras\.js/i, /auth\.js|firebase-init\.js/i],
    scriptHints: [/financeSyncCompra|compras\.js/i],
  },
  {
    path: '/romaneiotora.html',
    title: 'Romaneio Tora',
    mustMatch: [/<html[\s>]/i, /auth\.js|firebase-init\.js|firebaseService\.js/i],
  },
];

function targetUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

/**
 * @param {string} pathname
 */
async function fetchPage(pathname) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl(pathname), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'cache-control': 'no-cache' },
    });

    const body = response.status === 200 ? await response.text() : '';
    return { ok: true, status: response.status, body, headers: response.headers };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {string} html
 * @param {string} pagePath
 */
function extractLocalScriptSrc(html, pagePath) {
  const scripts = [];
  const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const regex = /<script[^>]*src\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(htmlWithoutComments)) !== null) {
    const src = match[1].trim();
    if (!src || src.startsWith('http') || src.startsWith('//')) continue;
    scripts.push(new URL(src, targetUrl(pagePath)).pathname);
  }

  return [...new Set(scripts)];
}

/**
 * @param {string} assetPath
 */
async function headAsset(assetPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl(assetPath), {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'cache-control': 'no-cache' },
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printResult(result) {
  const marker = result.pass ? 'PASS' : 'FAIL';
  console.log(`${marker} ${result.kind} ${result.path} ${result.detail || ''}`.trim());
}

async function checkRoute(route) {
  /** @type {{ kind: string; path: string; pass: boolean; detail?: string }[]} */
  const results = [];
  const response = await fetchPage(route.path);

  if (!response.ok) {
    results.push({
      kind: 'route',
      path: route.path,
      pass: false,
      detail: `fetch error: ${response.error}`,
    });
    return results;
  }

  if (response.status !== 200) {
    results.push({
      kind: 'route',
      path: route.path,
      pass: false,
      detail: `status=${response.status} expected 200`,
    });
    return results;
  }

  results.push({
    kind: 'route',
    path: route.path,
    pass: true,
    detail: `${route.title} status=200`,
  });

  for (const pattern of route.mustMatch) {
    const pass = pattern.test(response.body);
    results.push({
      kind: 'content',
      path: `${route.path}#${pattern.source.slice(0, 40)}`,
      pass,
      detail: pass ? 'match OK' : `missing pattern /${pattern.source}/`,
    });
  }

  if (route.scriptHints) {
    for (const hint of route.scriptHints) {
      const pass = hint.test(response.body);
      results.push({
        kind: 'hint',
        path: `${route.path}#hint`,
        pass,
        detail: pass ? 'script hint OK' : `hint not found /${hint.source}/`,
      });
    }
  }

  const brokenScript = /<script[^>]*src\s*=\s*["']\s*["']/i.test(response.body.replace(/<!--[\s\S]*?-->/g, ''));
  results.push({
    kind: 'integrity',
    path: `${route.path}#empty-script-src`,
    pass: !brokenScript,
    detail: brokenScript ? 'script com src vazio detectado' : 'sem src vazio',
  });

  if (checkAssets && response.body) {
    const assets = extractLocalScriptSrc(response.body, route.path).slice(0, 8);
    for (const assetPath of assets) {
      const asset = await headAsset(assetPath);
      const pass = asset.ok && asset.status >= 200 && asset.status < 400;
      results.push({
        kind: 'asset',
        path: assetPath,
        pass,
        detail: pass ? `status=${asset.status}` : `asset missing status=${asset.status || asset.error}`,
      });
    }
  }

  return results;
}

async function main() {
  console.log(`Sisweb smoke preview: ${baseUrl.origin}`);
  console.log(`Asset HEAD checks: ${checkAssets ? 'on' : 'off (SISWEB_SMOKE_CHECK_ASSETS=0)'}\n`);

  /** @type {{ kind: string; path: string; pass: boolean; detail?: string }[]} */
  const allResults = [];

  for (const route of CRITICAL_ROUTES) {
    const routeResults = await checkRoute(route);
    allResults.push(...routeResults);
  }

  for (const result of allResults) {
    printResult(result);
  }

  const failures = allResults.filter((r) => !r.pass);
  const passed = allResults.length - failures.length;

  console.log(`\nSummary: ${passed}/${allResults.length} checks passed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
