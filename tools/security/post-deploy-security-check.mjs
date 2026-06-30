#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://sisweb-7ce82.web.app/';
const baseUrl = new URL(process.env.SISWEB_BASE_URL || DEFAULT_BASE_URL);
const timeoutMs = Number.parseInt(process.env.SISWEB_CHECK_TIMEOUT_MS || '10000', 10);

const sensitivePaths = [
  '/service-account.json',
  '/Clients.json',
  '/fornecedores.json',
  '/contasReceber.json',
  '/romaneiosTora.json',
  '/sisweb-7ce82-default-rtdb-export%20(5).json',
  '/.env',
  '/.env.backup.1776951502484',
  '/database.rules.json',
  '/storage.rules',
  '/firebase-rules.json',
  '/firebase.json',
  '/package.json',
  '/package-lock.json',
  '/functions/index.js',
  '/functions/nf-functions.js',
  '/.firebase/hosting..cache',
  '/cors.json',
  '/firestore.rules',
  '/firestore.indexes.json',
  '/vercel.json',
  '/src.txt',
  '/date_vars.txt',
  '/Logs%20do%20console.txt',
  '/Analise%20o%20sistema%20sisweb%20Como%20Umo%20Todo%20Seguran%C3%A7a.txt',
  '/romaneiopct-tabela.js.backup.2025-08-01',
  '/romaneiopct.html.backup.2025-08-01',
  '/tmp-cart-card-v2-vendas.png',
  '/Logo%20JN.png',
];

const publicRoutes = ['/', '/index.html', '/login.html', '/manifest.json', '/sw.js'];

const requiredHeaders = [
  { path: '/login.html', header: 'x-content-type-options', expected: 'nosniff' },
  { path: '/login.html', header: 'x-frame-options', expected: 'DENY' },
  { path: '/login.html', header: 'referrer-policy', expected: 'strict-origin-when-cross-origin' },
];

function targetUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function fetchWithTimeout(pathname, method = 'HEAD') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl(pathname), {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'cache-control': 'no-cache',
      },
    });

    return {
      ok: true,
      method,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    return {
      ok: false,
      method,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probe(pathname) {
  const head = await fetchWithTimeout(pathname, 'HEAD');

  if (head.ok && head.status !== 405) {
    return head;
  }

  return fetchWithTimeout(pathname, 'GET');
}

function printResult(result) {
  const marker = result.pass ? 'PASS' : 'FAIL';
  const status = result.status ? `status=${result.status}` : `error=${result.error}`;
  console.log(`${marker} ${result.kind} ${result.path} ${status} ${result.detail || ''}`.trim());
}

async function checkSensitivePaths() {
  const results = [];

  for (const path of sensitivePaths) {
    const response = await probe(path);
    const status = response.status;
    const pass = response.ok && (status === 403 || status === 404);

    results.push({
      kind: 'sensitive',
      path,
      pass,
      status,
      error: response.error,
      detail: pass ? 'blocked' : 'expected 403/404',
    });
  }

  return results;
}

async function checkPublicRoutes() {
  const results = [];

  for (const path of publicRoutes) {
    const response = await probe(path);
    const status = response.status;
    const pass = response.ok && status === 200;

    results.push({
      kind: 'public',
      path,
      pass,
      status,
      error: response.error,
      detail: pass ? 'available' : 'expected 200',
    });
  }

  return results;
}

async function checkHeaders() {
  const results = [];

  for (const expectation of requiredHeaders) {
    const response = await probe(expectation.path);
    const actual = response.headers?.get(expectation.header) || '';
    const pass = response.ok && response.status === 200 && actual === expectation.expected;

    results.push({
      kind: 'header',
      path: `${expectation.path}#${expectation.header}`,
      pass,
      status: response.status,
      error: response.error,
      detail: pass ? actual : `expected "${expectation.expected}", got "${actual || '<missing>'}"`,
    });
  }

  return results;
}

async function main() {
  console.log(`Sisweb post-deploy security check: ${baseUrl.origin}`);

  const results = [
    ...(await checkSensitivePaths()),
    ...(await checkPublicRoutes()),
    ...(await checkHeaders()),
  ];

  for (const result of results) {
    printResult(result);
  }

  const failures = results.filter((result) => !result.pass);
  const passed = results.length - failures.length;

  console.log(`Summary: ${passed}/${results.length} checks passed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
