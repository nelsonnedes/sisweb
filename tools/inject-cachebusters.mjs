#!/usr/bin/env node
/**
 * Atualiza cachebusters de scripts locais usados pelos HTMLs publicados.
 *
 * Por padrão processa apenas os HTMLs de hosting-files.json. Use --all para
 * incluir páginas legadas fora do Hosting.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import {
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep
} from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'hosting-files.json');
const AUDIT_ALL = process.argv.includes('--all');

function toPosix(value) {
  return value.split(sep).join('/');
}

function normalizeProjectPath(value) {
  const rel = relative(ROOT, resolve(ROOT, value));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return '';
  return toPosix(rel);
}

function walkHtml(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '.freebuff', 'hosting-dist', 'node_modules'].includes(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walkHtml(absolute, output);
    else if (extname(entry.name).toLowerCase() === '.html') {
      output.push(normalizeProjectPath(absolute));
    }
  }
  return output;
}

function getHtmlFiles() {
  if (AUDIT_ALL) return walkHtml(ROOT);
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('hosting-files.json inválido.');
  return entries.filter(entry => extname(entry).toLowerCase() === '.html');
}

function hashFile(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12);
}

function isExternal(src) {
  return /^(?:[a-z]+:)?\/\//i.test(src)
    || /^(?:data|blob|chrome-extension):/i.test(src);
}

function resolveScriptPath(htmlPath, src) {
  const clean = String(src || '').split(/[?#]/, 1)[0];
  if (!clean || isExternal(clean)) return '';
  if (clean.startsWith('/')) return resolve(ROOT, clean.slice(1));
  return resolve(dirname(htmlPath), clean);
}

function isCanonicalFirebaseModule(src) {
  return /(?:^|\/)firebase-(?:init|compat-bridge)\.js$/i.test(String(src || '').replace(/\\/g, '/'));
}

function updateExecutableSegment(segment, htmlPath) {
  const patterns = [
    { type: 'script', regex: /(<script\b[^>]*\bsrc\s*=\s*["'])([^"'?#]+\.js)(?:\?v=[^"'#\s]*)?(["'])/gi },
    { type: 'dynamic-import', regex: /(import\s*\(\s*["'])([^"'?#]+\.js)(?:\?v=[^"'#\s]*)?(["']\s*\))/gi },
    { type: 'static-import', regex: /((?:from\s*|import\s*)["'])([^"'?#]+\.js)(?:\?v=[^"'#\s]*)?(["'])/gi }
  ];

  let updated = segment;
  let replacements = 0;
  for (const { type, regex } of patterns) {
    updated = updated.replace(regex, (match, prefix, src, suffix) => {
      if (type !== 'script' && isCanonicalFirebaseModule(src)) {
        const replacement = `${prefix}${src}${suffix}`;
        if (replacement !== match) replacements += 1;
        return replacement;
      }
      const absolute = resolveScriptPath(htmlPath, src);
      const hash = absolute ? hashFile(absolute) : null;
      if (!hash) return match;
      const replacement = `${prefix}${src}?v=${hash}${suffix}`;
      if (replacement !== match) replacements += 1;
      return replacement;
    });
  }
  return { updated, replacements };
}

function processHtml(relativePath) {
  const absolute = resolve(ROOT, relativePath);
  const source = readFileSync(absolute, 'utf8');
  const segments = source.split(/(<!--[\s\S]*?-->)/g);
  let replacements = 0;

  const updated = segments.map(segment => {
    if (segment.startsWith('<!--')) return segment;
    const result = updateExecutableSegment(segment, absolute);
    replacements += result.replacements;
    return result.updated;
  }).join('');

  if (updated !== source) writeFileSync(absolute, updated, 'utf8');
  return replacements;
}

let filesUpdated = 0;
let referencesUpdated = 0;
for (const file of getHtmlFiles()) {
  const count = processHtml(file);
  if (count > 0) {
    filesUpdated += 1;
    referencesUpdated += count;
    console.log(`Atualizado ${file}: ${count} referência(s)`);
  }
}

console.log(
  `Cachebusters concluídos: ${referencesUpdated} referência(s) em ${filesUpdated} HTML(s).`
);
