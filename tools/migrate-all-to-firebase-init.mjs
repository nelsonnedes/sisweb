/**
 * tools/migrate-all-to-firebase-init.mjs
 *
 * Migração em lote: adiciona import de firebase-init.js em TODAS as páginas
 * que ainda importam Firebase diretamente do CDN.
 *
 * Abordagem segura:
 * - Páginas COMPAT: insere import de firebase-init.js ANTES dos primeiros
 *   script tags do CDN. firebase-init.js roda primeiro (define singletons),
 *   e os scripts compat continuam funcionando normalmente.
 * - Páginas MODULAR (login.html): substitui imports do CDN por imports de
 *   firebase-init.js e simplifica o bloco de inicialização.
 *
 * Uso: node tools/migrate-all-to-firebase-init.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));
const FIREBASE_INIT_IMPORT = `import { app, auth, db, storage, functions, ref, set, get, remove, child, onValue, off, push, update, serverTimestamp, query, orderByChild, limitToLast, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, reauthenticateWithCredential, httpsCallable, storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject } from './firebase-init.js';`;

let compatMigrated = 0;
let modularMigrated = 0;
let skipped = 0;

// ─── PATTERN: páginas compat (script tag) ────────────────────────────────────
for (const file of htmlFiles) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf-8');
  const original = html;

  // Pula se já tem firebase-init.js
  if (html.includes('firebase-init.js')) {
    skipped++;
    continue;
  }

  // Pula se não tem referência ao CDN
  if (!/firebasejs\/10\.7\.1\//.test(html)) {
    skipped++;
    continue;
  }

  // Detecta se é compat (script tag) ou modular (import)
  const isCompat = /src="[^"]*firebasejs\/10\.7\.1\/[^"]*-compat\.js"/.test(html);
  const isModular = /from\s*["'][^"']*firebasejs\/10\.7\.1\/(?!.*-compat)/.test(html);

  if (isCompat) {
    // Insere firebase-init.js import ANTES do primeiro script tag compat
    // Usa <script type="module"> import ... </script> logo antes do primeiro compat
    const firstCompatMatch = html.match(/(\s*)<script[^>]*src="[^"]*firebase-app-compat\.js"[^>]*><\/script>/);
    if (firstCompatMatch) {
      const insertPoint = firstCompatMatch.index;
      const prefix = firstCompatMatch[1] || '\n    ';
      const moduleTag = `${prefix}<!-- Firebase via módulo compartilhado (singleton) -->\n${prefix}<script type="module">\n${prefix}    ${FIREBASE_INIT_IMPORT}\n${prefix}</script>`;
      html = html.slice(0, insertPoint) + moduleTag + html.slice(insertPoint);
      writeFileSync(path, html, 'utf-8');
      compatMigrated++;
      console.log(`  ✓ ${file} — compat (script tag) + firebase-init.js`);
    }
  } else if (isModular && file === 'login.html') {
    // login.html: substitui imports do CDN por firebase-init.js
    // Remove os 3 imports do CDN e substitui por import único
    const importBlock = /import\s*\{[^}]*\}\s*from\s*["'][^"']*firebasejs\/10\.7\.1\/firebase-auth\.js["'][^;]*;[\s\S]*?import\s*\{[^}]*\}\s*from\s*["'][^"']*firebasejs\/10\.7\.1\/firebase-database\.js["'][^;]*;/;
    const importMatch = html.match(importBlock);
    if (importMatch) {
      const beforeImport = html.slice(0, importMatch.index);
      const afterImport = html.slice(importMatch.index + importMatch[0].length);
      html = beforeImport + `        import { app, auth, db, ref, set, get, remove, child, onValue, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase-init.js';` + afterImport;

      // Remove bloco de inicialização redundante (let app, auth; ... getAuth(app))
      const initBlock = /\/\/ Verificar se já existe uma instância do Firebase[\s\S]*?let app, auth;[\s\S]*?if \(window\._FIREBASE_APP\) \{[\s\S]*?\} else \{[\s\S]*?existingApps[\s\S]*?getApps\(\)[\s\S]*?\}[\s\S]*?if \(app && auth\) \{[\s\S]*?window\._FIREBASE_APP = app;[\s\S]*?window\.auth = auth;[\s\S]*?\}/;
      html = html.replace(initBlock, `        // Firebase já inicializado via firebase-init.js (app, auth, db disponíveis)\n        window._FIREBASE_APP = app;\n        window.auth = auth;`);

      writeFileSync(path, html, 'utf-8');
      modularMigrated++;
      console.log(`  ✓ ${file} — modular (ESM import) + firebase-init.js`);
    } else {
      skipped++;
      console.log(`  ? ${file} — modular pattern not matched`);
    }
  } else if (isModular) {
    // firebase-rules-update.html, fix-firebase-rules.html
    // substitui imports do CDN por firebase-init.js
    const importBlock = /import\s*\{[^}]*\}\s*from\s*["'][^"']*firebasejs\/10\.7\.1\//g;
    html = html.replace(importBlock, (match) => {
      if (match.includes('firebase-app.js')) {
        return `import { app } from './firebase-init.js'`;
      } else if (match.includes('firebase-database.js')) {
        return `import { db, ref, get, remove, set, update, onValue, child } from './firebase-init.js'`;
      } else if (match.includes('firebase-auth.js')) {
        return `import { auth, onAuthStateChanged, signOut } from './firebase-init.js'`;
      }
      return match;
    });
    html = html.replace(/let app;[\s\S]*?initializeApp\(/g, '// app initialized by firebase-init.js\n');
    html = html.replace(/const apps = getApps\(\);[\s\S]*?apps\[0\] : initializeApp/gs, '');
    writeFileSync(path, html, 'utf-8');
    modularMigrated++;
    console.log(`  ✓ ${file} — modular (ESM) simplified`);
  } else {
    skipped++;
    console.log(`  ? ${file} — unknown pattern`);
  }
}

console.log(`\n✅ Migração concluída:`);
console.log(`  Compat (script): ${compatMigrated} páginas`);
console.log(`  Modular (ESM):   ${modularMigrated} páginas`);
console.log(`  Puladas:         ${skipped} páginas`);
