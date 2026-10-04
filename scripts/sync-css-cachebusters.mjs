// Sincroniza ?v= de stylesheets com o hash do conteúdo (sha256-12).
// Uso: node scripts/sync-css-cachebusters.mjs [--check]
// Regras:
// - Só mexe em href="...css?v=..." relativo (pula CDN/absoluto).
// - Preserva ?v= que já for hash [0-9a-f]{12}.
// - Escopo: *.html na raiz + folha_pagamento/*.html (fora: backup/, marqueting/,
//   subscription.html — trabalho paralelo em andamento).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['subscription.html', 'landing-vendas.html']);
const DIRS = ['', 'folha_pagamento'];

function sha12(abs) {
  const buf = readFileSync(abs);
  return createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function htmlFiles() {
  const out = [];
  for (const d of DIRS) {
    const dir = join(ROOT, d);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.html')) continue;
      if (SKIP.has(d ? `${d}/${f}` : f) || SKIP.has(f)) continue;
      out.push(join(dir, f));
    }
  }
  return out;
}

const check = process.argv.includes('--check');
let changed = 0;
let dirty = [];
for (const file of htmlFiles()) {
  const htmlDir = dirname(file);
  let text = readFileSync(file, 'utf8');
  let fileChanged = 0;
  text = text.replace(/href="([^":]+\.css)\?v=([^"]+)"/g, (m, href, v) => {
    if (/^[0-9a-f]{12}$/.test(v)) return m;
    const rel = href.replace(/^\.\//, '');
    let abs = join(htmlDir, rel);
    if (!existsSync(abs)) abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      console.warn(`AVISO: CSS não encontrado: ${href} (ref em ${file})`);
      return m;
    }
    const h = sha12(abs);
    if (h === v) return m;
    fileChanged++;
    return `href="${href}?v=${h}"`;
  });
  if (fileChanged) {
    changed += fileChanged;
    dirty.push(`${file} (${fileChanged})`);
    if (!check) writeFileSync(file, text);
  }
}
console.log(`${check ? 'Faltando' : 'Aplicadas'}: ${changed} trocas em ${dirty.length} arquivos`);
for (const d of dirty) console.log(' - ' + d);
process.exitCode = check && changed ? 1 : 0;
