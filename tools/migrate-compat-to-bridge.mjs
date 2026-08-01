/**
 * tools/migrate-compat-to-bridge.mjs
 *
 * Remove os script tags compat do CDN e substitui pelo import de
 * firebase-compat-bridge.js (que emula firebase.xxx() via modular SDK).
 *
 * Uso: node tools/migrate-compat-to-bridge.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Lista de páginas compat identificadas
const COMPAT_PAGES = [
  'client.html', 'company.html', 'fornecedor.html',
  'importar_especies.html', 'index.html',
  'migrate-to-firebase.html', 'preromaneio.html',
  'reset-system.html', 'romaneiotl.html',
  'romaneiotora.html', 'romaneiotora_otimizado.html',
  'romaneiotora_versao_dev.html', 'species.html'
];

// Remove blocos de script tags compat do CDN (firebase-app-compat, firebase-database-compat, etc.)
function removeCompatScriptTags(html) {
  // Remove todos os <script src="...firebasejs/.../firebase-*-compat.js"></script>
  // Inclui quebras de linha entre tags
  return html.replace(
    /(\s*)<script[^>]*src="[^"]*firebasejs\/10\.7\.1\/[^"]*-compat\.js"[^>]*><\/script>\s*/gi,
    ''
  );
}

// Detecta se a página já tem a bridge importada
function hasBridgeImport(html) {
  return /firebase-compat-bridge\.js/.test(html);
}

// Encontra o local ideal para inserir o import da bridge
function insertBridgeImport(html) {
  // Após qualquer import de firebase-init.js já existente
  const initImportMatch = html.match(/(import\s+.*from\s+['"]\.\/firebase-init\.js(?:\?v=[^'"]+)?['"].*)\n/);
  if (initImportMatch) {
    const after = initImportMatch.index + initImportMatch[0].length;
    return html.slice(0, after) + `import './firebase-compat-bridge.js?v=21eb04e409d8';  // compat shim\n` + html.slice(after);
  }

  // Se não tiver firebase-init, insere antes do primeiro <script> com conteúdo
  const firstScriptMatch = html.match(/(\s*)<script[^>]*>/);
  if (firstScriptMatch) {
    const at = firstScriptMatch.index;
    const prefix = firstScriptMatch[1] || '\n    ';
    const bridgeImport = `${prefix}<!-- Compat bridge (substitui SDK compat do CDN) -->\n${prefix}<script type="module">\n${prefix}    import './firebase-compat-bridge.js?v=21eb04e409d8';\n${prefix}</script>\n`;
    return html.slice(0, at) + bridgeImport + html.slice(at);
  }

  return html;
}

let modified = 0;
let skipped = 0;

for (const file of COMPAT_PAGES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.log(`  ? ${file} — não encontrado`);
    skipped++;
    continue;
  }

  let html = readFileSync(path, 'utf-8');
  const original = html;

  // Remove script tags compat do CDN
  html = removeCompatScriptTags(html);

  // Se não tinha tags compat, pula
  if (html === original && hasBridgeImport(html)) {
    console.log(`  ✓ ${file} — já migrado`);
    skipped++;
    continue;
  }

  // Insere import da bridge
  if (!hasBridgeImport(html)) {
    html = insertBridgeImport(html);
  }

  if (html !== original) {
    writeFileSync(path, html, 'utf-8');
    modified++;
    console.log(`  ✓ ${file} — compat removido + bridge adicionada`);
  } else {
    console.log(`  ? ${file} — sem alterações`);
    skipped++;
  }
}

console.log(`\n✅ Migração concluída: ${modified} páginas, ${skipped} puladas`);
