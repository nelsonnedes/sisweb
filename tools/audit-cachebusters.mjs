#!/usr/bin/env node
/**
 * Audita cachebusters e versões do Firebase no pacote publicado.
 *
 * O escopo padrão é hosting-files.json. Use --all para incluir fontes legadas
 * que não fazem parte do deploy.
 */

import {
  existsSync,
  readFileSync,
  readdirSync
} from 'node:fs';
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep
} from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'hosting-files.json');
const FIREBASE_INIT_MODULE = 'firebase-init.js';
const args = process.argv.slice(2);
const OUTPUT_JSON = args.includes('--json');
const CI_MODE = args.includes('--ci');
const AUDIT_ALL = args.includes('--all');

function toPosix(value) {
  return value.split(sep).join('/');
}

function normalizeProjectPath(value) {
  const rel = relative(ROOT, resolve(ROOT, value));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return '';
  return toPosix(normalize(rel));
}

function walk(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '.freebuff', 'hosting-dist', 'node_modules'].includes(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else output.push(normalizeProjectPath(absolute));
  }
  return output;
}

function getScopeFiles() {
  if (AUDIT_ALL) return walk(ROOT);
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('hosting-files.json inválido.');
  return entries.map(normalizeProjectPath).filter(Boolean);
}

function isHashVersion(version) {
  return /^[0-9a-f]{12}$/i.test(String(version || ''));
}

function isExternal(specifier) {
  return /^(?:[a-z]+:)?\/\//i.test(specifier)
    || /^(?:data|blob|chrome-extension):/i.test(specifier);
}

function splitSpecifier(specifier) {
  const match = String(specifier || '').match(/^([^?#]+)(?:\?([^#]*))?(?:#.*)?$/);
  const query = new URLSearchParams(match?.[2] || '');
  return {
    path: match?.[1] || '',
    version: query.get('v')
  };
}

function resolveLocalTarget(htmlFile, specifier) {
  const { path } = splitSpecifier(specifier);
  if (path.startsWith('/')) return normalizeProjectPath(path.slice(1));
  return normalizeProjectPath(resolve(ROOT, dirname(htmlFile), path));
}

function isCanonicalFirebaseModule(entry) {
  return entry.type !== 'script'
    && /(?:^|\/)firebase-(?:init|compat-bridge)\.js$/i.test(entry.target);
}

function extractScriptSpecifiers(source) {
  const entries = [];
  const patterns = [
    { type: 'script', regex: /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi },
    { type: 'dynamic-import', regex: /import\s*\(\s*["']([^"']+\.js(?:\?[^"']*)?)["']\s*\)/gi },
    { type: 'static-import', regex: /(?:from\s*|import\s*)["']([^"']+\.js(?:\?[^"']*)?)["']/gi }
  ];

  for (const { type, regex } of patterns) {
    let match;
    while ((match = regex.exec(source)) !== null) {
      entries.push({ type, specifier: match[1] });
    }
  }

  return entries.filter((entry, index, all) => (
    all.findIndex(candidate => (
      candidate.type === entry.type && candidate.specifier === entry.specifier
    )) === index
  ));
}

function collectHtmlEntries(htmlFiles, allowedFiles) {
  const entries = [];
  for (const html of htmlFiles) {
    const source = readFileSync(join(ROOT, html), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const item of extractScriptSpecifiers(source)) {
      const { path, version } = splitSpecifier(item.specifier);
      const external = isExternal(path);
      const target = external ? '' : resolveLocalTarget(html, item.specifier);
      entries.push({
        html,
        type: item.type,
        src: path,
        target,
        version,
        isHash: isHashVersion(version),
        external,
        exists: external || existsSync(join(ROOT, target)),
        published: external || allowedFiles.has(target)
      });
    }
  }
  return entries;
}

function collectFirebaseSdk(files) {
  const refs = [];
  const regex = /https?:\/\/www\.gstatic\.com\/firebasejs\/([^/'"\s)]+)\/([^'"\s)?]+)(?:\?[^'"\s)]*)?/gi;

  for (const file of files.filter(item => ['.html', '.js', '.mjs'].includes(extname(item).toLowerCase()))) {
    const absolute = join(ROOT, file);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, 'utf8');
    let match;
    while ((match = regex.exec(source)) !== null) {
      refs.push({
        file,
        version: match[1],
        module: match[2],
        url: match[0],
        outsideBootstrap: file !== FIREBASE_INIT_MODULE
      });
    }
  }
  return refs;
}

function findConflicts(localEntries) {
  const byTarget = new Map();
  for (const entry of localEntries) {
    if (!byTarget.has(entry.target)) byTarget.set(entry.target, []);
    byTarget.get(entry.target).push(entry);
  }

  const conflicts = [];
  for (const [target, refs] of byTarget) {
    const versions = [...new Set(refs.map(ref => ref.version || 'none'))];
    if (versions.length > 1) {
      conflicts.push({
        target,
        versions,
        refs: refs.map(ref => ({ html: ref.html, version: ref.version }))
      });
    }
  }
  return conflicts;
}

function renderText(report) {
  const lines = [
    'Auditoria de Cachebusters - Sisweb',
    `Escopo: ${report.scope}`,
    `Referências locais: ${report.summary.localScripts}`,
    `Sem cachebuster: ${report.summary.localWithoutVersion}`,
    `Conflitos: ${report.summary.conflicts}`,
    `Firebase SDK: ${report.firebaseSdk.versions.join(', ') || 'nenhum'}`,
    `SDK direto fora do bootstrap: ${report.firebaseSdk.directOutsideBootstrap}`
  ];

  for (const entry of report.localWithoutVersion) {
    lines.push(`SEM CACHE ${entry.html} -> ${entry.src}`);
  }
  for (const entry of report.missingFromHosting) {
    lines.push(`FORA DO HOSTING ${entry.html} -> ${entry.target}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const scopeFiles = getScopeFiles();
  const allowedFiles = new Set(scopeFiles);
  const htmlFiles = scopeFiles.filter(file => extname(file).toLowerCase() === '.html');
  const scriptEntries = collectHtmlEntries(htmlFiles, allowedFiles);
  const localEntries = scriptEntries.filter(entry => !entry.external);
  const localWithoutVersion = localEntries.filter(entry => (
    !entry.version && !isCanonicalFirebaseModule(entry)
  ));
  const staticVersions = localEntries.filter(entry => entry.version && !entry.isHash);
  const missingFromHosting = localEntries.filter(entry => !entry.exists || !entry.published);
  const conflicts = findConflicts(localEntries);
  const firebaseRefs = collectFirebaseSdk(scopeFiles);
  const firebaseVersions = [...new Set(firebaseRefs.map(ref => ref.version))].sort();
  const directOutsideBootstrap = firebaseRefs.filter(ref => ref.outsideBootstrap);

  const report = {
    scope: AUDIT_ALL ? 'all' : 'hosting',
    summary: {
      htmlFiles: htmlFiles.length,
      totalScriptReferences: scriptEntries.length,
      localScripts: localEntries.length,
      externalScripts: scriptEntries.length - localEntries.length,
      localWithHash: localEntries.filter(entry => entry.isHash).length,
      localWithStaticVersion: staticVersions.length,
      localWithoutVersion: localWithoutVersion.length,
      missingFromHosting: missingFromHosting.length,
      conflicts: conflicts.length
    },
    localWithoutVersion,
    staticVersions,
    missingFromHosting,
    conflicts,
    firebaseSdk: {
      versions: firebaseVersions,
      refs: firebaseRefs,
      directOutsideBootstrap: directOutsideBootstrap.length,
      directRefs: directOutsideBootstrap
    }
  };

  process.stdout.write(OUTPUT_JSON ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));

  const failed = localWithoutVersion.length > 0
    || missingFromHosting.length > 0
    || conflicts.length > 0
    || firebaseVersions.some(version => version !== '10.7.1')
    || directOutsideBootstrap.length > 0;
  if (CI_MODE && failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
}
