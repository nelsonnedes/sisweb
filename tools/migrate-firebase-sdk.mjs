/**
 * Migra todas as páginas HTML para Firebase SDK v10.7.1
 *
 * Uso: node tools/migrate-firebase-sdk.mjs
 *
 * Substitui:
 *   - firebasejs/9.6.1/         → firebasejs/10.7.1/   (compat)
 *   - firebasejs/9.22.0/        → firebasejs/10.7.1/   (compat + modular)
 *   - firebasejs/9.23.0/        → firebasejs/10.7.1/   (compat)
 *   - firebasejs/10.7.1/        → mantém (já na versão alvo)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));

const VERSIONS = ['9.6.1', '9.22.0', '9.23.0'];
const TARGET = '10.7.1';

let modified = 0;
let totalReplacements = 0;

for (const file of htmlFiles) {
  const path = join(ROOT, file);
  let content = readFileSync(path, 'utf-8');
  const original = content;
  let fileChanged = false;

  for (const ver of VERSIONS) {
    const pattern = new RegExp(`firebasejs/${ver.replace(/\./g, '\\.')}/`, 'g');
    const match = content.match(pattern);
    if (match) {
      content = content.replace(pattern, `firebasejs/${TARGET}/`);
      totalReplacements += match.length;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    writeFileSync(path, content, 'utf-8');
    modified++;
    const count = VERSIONS.reduce((acc, ver) => {
      return acc + (content.match(new RegExp(`firebasejs/${TARGET}/`, 'g')) || []).length;
    }, 0);
  }
}

console.log(`✅ Migração concluída: ${modified} arquivos modificados, ${totalReplacements} substituições para v${TARGET}`);
