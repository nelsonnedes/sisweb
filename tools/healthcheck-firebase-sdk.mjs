#!/usr/bin/env node
/**
 * Valida o bootstrap Firebase dos artefatos que realmente entram no Hosting.
 *
 * Por padrão o escopo vem de hosting-files.json. Use --all para auditar também
 * páginas e scripts legados que não são publicados.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep
} from 'node:path';

const TARGET_VERSION = '10.7.1';
const PROJECT_ROOT = process.cwd();
const MANIFEST_PATH = join(PROJECT_ROOT, 'hosting-files.json');
const FIREBASE_INIT_MODULE = 'firebase-init.js';
const FIREBASE_BRIDGE_MODULE = 'firebase-compat-bridge.js';
const args = process.argv.slice(2);
const CHECK_PRODUCTION = args.includes('--production');
const OUTPUT_JSON = args.includes('--json');
const CI_MODE = args.includes('--ci');
const AUDIT_ALL = args.includes('--all');

const FIREBASE_CDN_RE = /https?:\/\/www\.gstatic\.com\/firebasejs\/([^/'"\s)]+)\/([^'"\s)?]+)(?:\?[^'"\s)]*)?/gi;
const FIREBASE_INIT_IMPORT_RE = /(?:from\s*|import\s*\(\s*)['"][^'"]*firebase-init\.js(?:\?[^'"]*)?['"]/gi;
const FIREBASE_BRIDGE_IMPORT_RE = /(?:from\s*|import\s*\(\s*|import\s*)['"][^'"]*firebase-compat-bridge\.js(?:\?[^'"]*)?['"]/gi;

if (args.includes('--help')) {
  console.log(`
Firebase SDK Healthcheck

Uso:
  node tools/healthcheck-firebase-sdk.mjs [--ci] [--json]

Flags:
  --all          inclui fontes legadas fora de hosting-files.json
  --production   valida as URLs do SDK com HEAD
  --json         emite relatório estruturado
  --ci           retorna exit code 1 para erro ou warning
`);
  process.exit(0);
}

function toPosix(value) {
  return value.split(sep).join('/');
}

function normalizeProjectPath(value) {
  const absolute = resolve(PROJECT_ROOT, value);
  const rel = relative(PROJECT_ROOT, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return '';
  return toPosix(normalize(rel));
}

function readManifest() {
  const entries = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('hosting-files.json inválido.');
  return entries.map(normalizeProjectPath).filter(Boolean);
}

function walkFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '.freebuff', 'hosting-dist', 'node_modules'].includes(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, output);
    else output.push(normalizeProjectPath(absolute));
  }
  return output;
}

function getScopeFiles() {
  return AUDIT_ALL ? walkFiles(PROJECT_ROOT) : readManifest();
}

function stripQueryAndHash(specifier) {
  return String(specifier || '').split(/[?#]/, 1)[0];
}

function isExternalSpecifier(specifier) {
  return /^(?:[a-z]+:)?\/\//i.test(specifier)
    || /^(?:data|blob|chrome-extension):/i.test(specifier);
}

function extractLocalDependencies(source, sourceFile) {
  const analyzableSource = extname(sourceFile).toLowerCase() === '.html'
    ? source.replace(/<!--[\s\S]*?-->/g, '')
    : source;
  const specs = [];
  const patterns = [
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
    /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(analyzableSource)) !== null) specs.push(match[1]);
  }

  const sourceDir = dirname(join(PROJECT_ROOT, sourceFile));
  return [...new Set(specs)]
    .filter(spec => !isExternalSpecifier(spec))
    .map(stripQueryAndHash)
    .filter(spec => /\.(?:js|mjs|html)$/i.test(spec))
    .map(spec => {
      if (spec.startsWith('/')) return normalizeProjectPath(spec.slice(1));
      return normalizeProjectPath(resolve(sourceDir, spec));
    })
    .filter(Boolean);
}

function extractFirebaseRefs(source, file) {
  const refs = [];
  FIREBASE_CDN_RE.lastIndex = 0;
  let match;
  while ((match = FIREBASE_CDN_RE.exec(source)) !== null) {
    refs.push({
      file,
      url: match[0],
      version: match[1],
      module: match[2]
    });
  }
  return refs;
}

function collectDependencyClosure(entryFile, allowedFiles) {
  const visited = new Set();
  const missing = new Set();
  const queue = [entryFile];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const absolute = join(PROJECT_ROOT, current);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      missing.add(current);
      continue;
    }

    const source = readFileSync(absolute, 'utf8');
    for (const dependency of extractLocalDependencies(source, current)) {
      if (!AUDIT_ALL && !allowedFiles.has(dependency)) {
        missing.add(dependency);
        continue;
      }
      if (!visited.has(dependency)) queue.push(dependency);
    }
  }

  return { visited, missing };
}

function checkFirebaseInitCompliance(entryFile, allowedFiles) {
  const { visited, missing } = collectDependencyClosure(entryFile, allowedFiles);
  const refs = [];
  let hasExplicitInitImport = false;
  let hasExplicitBridgeImport = false;

  for (const file of visited) {
    const absolute = join(PROJECT_ROOT, file);
    if (!existsSync(absolute)) continue;
    const rawSource = readFileSync(absolute, 'utf8');
    const source = extname(file).toLowerCase() === '.html'
      ? rawSource.replace(/<!--[\s\S]*?-->/g, '')
      : rawSource;
    refs.push(...extractFirebaseRefs(source, file));
    FIREBASE_INIT_IMPORT_RE.lastIndex = 0;
    FIREBASE_BRIDGE_IMPORT_RE.lastIndex = 0;
    hasExplicitInitImport ||= FIREBASE_INIT_IMPORT_RE.test(source);
    hasExplicitBridgeImport ||= FIREBASE_BRIDGE_IMPORT_RE.test(source);
  }

  const hasFirebaseBootstrap = visited.has(FIREBASE_INIT_MODULE)
    || visited.has(FIREBASE_BRIDGE_MODULE)
    || hasExplicitInitImport
    || hasExplicitBridgeImport;
  const directOutsideBootstrap = refs.filter(ref => ref.file !== FIREBASE_INIT_MODULE);
  const versions = [...new Set(refs.map(ref => ref.version))].sort();
  const issues = [];

  for (const file of missing) issues.push(`DEPENDENCIA_FORA_DO_HOSTING: ${file}`);
  for (const ref of directOutsideBootstrap) {
    issues.push(`CDN_DIRETO_FORA_DO_BOOTSTRAP: ${ref.file} -> v${ref.version}/${ref.module}`);
  }
  if (refs.length > 0 && !hasFirebaseBootstrap) {
    issues.push('BOOTSTRAP_FIREBASE_AUSENTE');
  }
  for (const version of versions) {
    if (version !== TARGET_VERSION) issues.push(`VERSAO_FIREBASE_NAO_PERMITIDA: ${version}`);
  }

  return {
    hasFirebaseBootstrap,
    hasFirebaseInitImport: hasFirebaseBootstrap,
    hasExplicitInitImport,
    hasExplicitBridgeImport,
    directCdnImports: directOutsideBootstrap.length,
    directCdnScripts: 0,
    directOutsideBootstrap,
    refs,
    versions,
    dependencies: [...visited].sort(),
    missingDependencies: [...missing].sort(),
    issues
  };
}

function httpHead(url) {
  return new Promise(resolveResult => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.request(url, { method: 'HEAD', timeout: 10000 }, response => {
      resolveResult({
        url,
        status: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 400
      });
    });
    request.on('error', () => resolveResult({ url, status: 0, ok: false }));
    request.on('timeout', () => {
      request.destroy();
      resolveResult({ url, status: 0, ok: false });
    });
    request.end();
  });
}

async function checkFile(file, allowedFiles) {
  const compliance = checkFirebaseInitCompliance(file, allowedFiles);
  const usesFirebase = compliance.refs.length > 0 || compliance.hasFirebaseBootstrap;
  const errors = [...compliance.issues];
  const urlResults = [];

  if (CHECK_PRODUCTION && usesFirebase) {
    const urls = [...new Set(compliance.refs.map(ref => ref.url))];
    urlResults.push(...await Promise.all(urls.map(httpHead)));
    for (const result of urlResults) {
      if (!result.ok) errors.push(`FALHA_CDN_HTTP: ${result.url}`);
    }
  }

  return {
    file,
    status: !usesFirebase ? 'no_firebase' : errors.length > 0 ? 'error' : 'ok',
    totalRefs: compliance.refs.length,
    versions: compliance.versions,
    errors,
    urlResults,
    compliance
  };
}

function buildSummary(results, firebaseInitExists) {
  return {
    totalPages: results.length,
    pagesWithFirebase: results.filter(item => item.status !== 'no_firebase').length,
    pagesWithoutFirebase: results.filter(item => item.status === 'no_firebase').length,
    ok: results.filter(item => item.status === 'ok').length,
    warnings: results.filter(item => item.status === 'warning').length,
    errors: results.filter(item => item.status === 'error').length,
    pagesWithBootstrap: results.filter(item => item.compliance.hasFirebaseBootstrap).length,
    directOutsideBootstrap: results.reduce(
      (total, item) => total + item.compliance.directOutsideBootstrap.length,
      0
    ),
    firebaseInitExists
  };
}

function renderText(report) {
  const lines = [
    'Firebase SDK Healthcheck',
    `Escopo: ${report.scope}`,
    `Páginas: ${report.summary.totalPages}`,
    `Com Firebase: ${report.summary.pagesWithFirebase}`,
    `Com bootstrap: ${report.summary.pagesWithBootstrap}`,
    `CDN direto fora do bootstrap: ${report.summary.directOutsideBootstrap}`,
    `Erros: ${report.summary.errors}`
  ];

  for (const result of report.results.filter(item => item.status === 'error')) {
    lines.push(`ERRO ${result.file}`);
    for (const issue of result.errors) lines.push(`  ${issue}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const scopeFiles = getScopeFiles();
  const allowedFiles = new Set(scopeFiles);
  const htmlFiles = scopeFiles.filter(file => extname(file).toLowerCase() === '.html');
  const firebaseInitExists = existsSync(join(PROJECT_ROOT, FIREBASE_INIT_MODULE));
  const results = [];

  for (const file of htmlFiles) results.push(await checkFile(file, allowedFiles));

  const report = {
    scope: AUDIT_ALL ? 'all' : 'hosting',
    targetVersion: TARGET_VERSION,
    summary: buildSummary(results, firebaseInitExists),
    results
  };

  process.stdout.write(OUTPUT_JSON ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
  if (CI_MODE && (report.summary.errors > 0 || report.summary.warnings > 0)) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
