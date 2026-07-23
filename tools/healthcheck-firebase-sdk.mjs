/**
 * tools/healthcheck-firebase-sdk.mjs
 *
 * Healthcheck do Firebase SDK + compliance com firebase-init.js.
 * Verifica se todas as páginas HTML usam o módulo compartilhado
 * firebase-init.js como ÚNICO ponto de import do Firebase SDK,
 * detectando imports diretos do CDN que bypassam o singleton.
 *
 * Uso:
 *   node tools/healthcheck-firebase-sdk.mjs               # verificação local
 *   node tools/healthcheck-firebase-sdk.mjs --production   # + HEAD requests CDN
 *   node tools/healthcheck-firebase-sdk.mjs --json         # saída JSON estruturada
 *   node tools/healthcheck-firebase-sdk.mjs --ci           # exit code 1 se erro
 *   node tools/healthcheck-firebase-sdk.mjs --help         # ajuda
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────
const TARGET_VERSION = '10.7.1';
const OBSOLETE_VERSIONS = ['9.6.1', '9.22.0', '9.23.0'];
const ALLOWED_VERSIONS = [TARGET_VERSION];
const PROJECT_ROOT = process.cwd();
const FIREBASE_INIT_MODULE = 'firebase-init.js';

// Padrões para detecção de imports diretos do CDN (bypass do singleton)
const CDN_IMPORT_RE = /(?:from\s+|import\s*\()\s*['"][^'"]*firebasejs\/([^'"]*?)\/([^'"]*?)(?:\.js|\.mjs)(?:\?[^'"]*)?['"]/gi;
const CDN_SCRIPT_RE = /(?:src|href)="[^"]*firebasejs\/([^"]*?)\/([^"]*?)(?:\.js|\.mjs)(?:\?[^"']*)?"/gi;
const FIREBASE_INIT_IMPORT_RE = /from\s*['"]\.\/firebase-init\.js['"]|import\(['"]\.\/firebase-init\.js/gi;

const args = process.argv.slice(2);
const CHECK_PRODUCTION = args.includes('--production');
const OUTPUT_JSON = args.includes('--json');
const CI_MODE = args.includes('--ci');

if (args.includes('--help')) {
  console.log(`
  Firebase SDK Healthcheck v1.1 — compliance com firebase-init.js
  ===============================================================
  Verifica versão do Firebase SDK e compliance com módulo compartilhado.

  Flags:
    --production   Testa URLs CDN com HEAD request (valida se servem)
    --json         Saída JSON estruturada (para pipelines)
    --ci           Exit code 1 se houver qualquer erro ou warning
    --help         Mostra esta ajuda

  Novas verificações (v1.1):
    • firebase-init.js existe     — módulo singleton obrigatório
    • Pages com Firebase          — devem importar via firebase-init.js
    • Pages sem import do init    — se têm Firebase direto do CDN, é ERRO

  Exemplos:
    node tools/healthcheck-firebase-sdk.mjs
    node tools/healthcheck-firebase-sdk.mjs --production --json
    node tools/healthcheck-firebase-sdk.mjs --ci
  `);
  process.exit(0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFirebaseRefs(html) {
  const refs = [];
  const urlPattern = /(?:src|href)="([^"]*firebasejs\/([^"]*?)\/([^"]*?)(?:\.js|\.mjs)(?:\?[^"']*)?)"/gi;
  const importPattern = /(?:from\s+|import\s*\()\s*['"]([^'"]*firebasejs\/([^'"]*?)\/([^'"]*?)(?:\.js|\.mjs)(?:\?[^'"]*)?)['"]/gi;

  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    refs.push({ url: match[1], version: match[2], module: match[3], type: 'script' });
  }
  while ((match = importPattern.exec(html)) !== null) {
    refs.push({ url: match[1], version: match[2], module: match[3], type: 'import' });
  }
  return refs;
}

function detectDuplication(refs) {
  const count = {};
  for (const ref of refs) {
    const key = ref.module.replace('-compat', '');
    count[key] = (count[key] || 0) + 1;
  }
  return Object.entries(count).filter(([, c]) => c > 1).map(([mod]) => mod);
}

function httpHead(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
    });
    req.on('error', () => resolve({ status: 0, ok: false, error: 'REQUEST_FAILED' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, error: 'TIMEOUT' }); });
    req.end();
  });
}

/**
 * Verifica compliance com firebase-init.js:
 * - firebase-init.js existe no projeto
 * - Páginas com Firebase devem importar de firebase-init.js
 * - Páginas NÃO devem importar Firebase diretamente do CDN
 */
function checkFirebaseInitCompliance(html, filePath) {
  const issues = [];

  // 1. Detecta imports diretos do CDN (from "https://...gstatic.com/firebasejs/...")
  const cdnImports = [];
  let m;
  CDN_IMPORT_RE.lastIndex = 0;
  while ((m = CDN_IMPORT_RE.exec(html)) !== null) {
    cdnImports.push({ version: m[1], module: m[2], raw: m[0].trim() });
  }

  // 2. Detecta script tags diretos do CDN
  const cdnScripts = [];
  CDN_SCRIPT_RE.lastIndex = 0;
  while ((m = CDN_SCRIPT_RE.exec(html)) !== null) {
    cdnScripts.push({ version: m[1], module: m[2], raw: m[0].trim() });
  }

  // 3. Detecta se importa firebase-init.js
  FIREBASE_INIT_IMPORT_RE.lastIndex = 0;
  const hasFirebaseInitImport = FIREBASE_INIT_IMPORT_RE.test(html);

  const totalDirectCdn = cdnImports.length + cdnScripts.length;

  // Se tem referências diretas ao CDN mas NÃO importa firebase-init.js → ERRO
  if (totalDirectCdn > 0 && !hasFirebaseInitImport) {
    for (const imp of cdnImports) {
      issues.push(`IMPORT_DIRETO_CDN: ${imp.raw}`);
    }
    for (const scr of cdnScripts) {
      issues.push(`SCRIPT_DIRETO_CDN: ${scr.raw}`);
    }
  }

  // Se importa firebase-init.js MAS também tem referências diretas ao CDN → AVISO
  if (totalDirectCdn > 0 && hasFirebaseInitImport) {
    for (const imp of cdnImports) {
      issues.push(`CDN_DIRETO_MESMO_COM_INIT: ${imp.raw}`);
    }
    for (const scr of cdnScripts) {
      issues.push(`CDN_DIRETO_MESMO_COM_INIT: ${scr.raw}`);
    }
  }

  return {
    hasFirebaseInitImport,
    directCdnImports: cdnImports.length,
    directCdnScripts: cdnScripts.length,
    totalDirectCdn,
    issues
  };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function checkFile(filePath, firebaseInitExists) {
  const html = readFileSync(filePath, 'utf-8');
  const refs = extractFirebaseRefs(html);
  const compliance = checkFirebaseInitCompliance(html, filePath);

  const result = {
    file: filePath,
    totalRefs: refs.length,
    versions: {},
    obsoleteVersions: [],
    unknownVersions: [],
    compatCount: 0,
    modularCount: 0,
    dupes: [],
    urlsOk: 0,
    urlsFail: 0,
    urlResults: [],
    status: 'ok',
    errors: [],
    compliance
  };

  if (refs.length === 0) {
    result.status = 'no_firebase';
    return result;
  }

  // Parallel HTTP checks when in production mode
  const httpChecks = [];

  for (const ref of refs) {
    result.versions[ref.version] = (result.versions[ref.version] || 0) + 1;
    if (ref.module.includes('-compat')) result.compatCount++;
    else result.modularCount++;

    if (OBSOLETE_VERSIONS.includes(ref.version)) {
      result.obsoleteVersions.push(ref);
      result.errors.push(`OBSOLETO v${ref.version} -> ${ref.url}`);
    } else if (!ALLOWED_VERSIONS.includes(ref.version)) {
      result.unknownVersions.push(ref);
      result.errors.push(`DESCONHECIDO v${ref.version} -> ${ref.url}`);
    }

    if (CHECK_PRODUCTION) {
      httpChecks.push(
        httpHead(ref.url).then(httpResult => {
          if (httpResult.ok) {
            result.urlsOk++;
            result.urlResults.push({ url: ref.url, status: httpResult.status, ok: true });
          } else {
            result.urlsFail++;
            const errMsg = httpResult.error || `HTTP ${httpResult.status}`;
            result.urlResults.push({ url: ref.url, status: httpResult.status, ok: false, error: errMsg });
            result.errors.push(`HTTP ${errMsg} -> ${ref.url}`);
          }
        })
      );
    }
  }

  if (httpChecks.length > 0) {
    await Promise.all(httpChecks);
  }

  // Detect duplicates
  result.dupes = detectDuplication(refs);
  if (result.dupes.length > 0) {
    result.errors.push(`DUPLICADO: modulos carregados 2+ vezes: ${result.dupes.join(', ')}`);
  }

  // Compliance: versões obsoletas ou imports diretos do CDN sem firebase-init
  if (!compliance.hasFirebaseInitImport && compliance.totalDirectCdn > 0) {
    for (const issue of compliance.issues) {
      result.errors.push(`COMPLIANCE: ${issue}`);
    }
  } else if (compliance.hasFirebaseInitImport && compliance.totalDirectCdn > 0) {
    for (const issue of compliance.issues) {
      result.errors.push(`COMPLIANCE_WARN: ${issue}`);
    }
  }

  // Verifica se firebase-init.js existe (relatado apenas na primeira página com Firebase)
  // O report já mostra o status no resumo, não poluir cada página com o mesmo erro.

  // Final status
  const hasComplianceError = compliance.totalDirectCdn > 0 && !compliance.hasFirebaseInitImport;
  const hasComplianceWarning = compliance.totalDirectCdn > 0 && compliance.hasFirebaseInitImport;
  const hasSystemError = !firebaseInitExists && result.totalRefs > 0;

  if (result.obsoleteVersions.length > 0 || result.unknownVersions.length > 0 || hasComplianceError || hasSystemError) {
    result.status = 'error';
  } else if (result.dupes.length > 0 || result.urlsFail > 0 || hasComplianceWarning) {
    result.status = 'warning';
  }

  return result;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function buildReport(results, firebaseInitExists) {
  const total = results.length;
  const withFirebase = results.filter(r => r.status !== 'no_firebase');
  const ok = results.filter(r => r.status === 'ok' && r.totalRefs > 0);
  const warnings = results.filter(r => r.status === 'warning');
  const errors = results.filter(r => r.status === 'error');
  const noFb = results.filter(r => r.status === 'no_firebase');

  const pagesWithInit = results.filter(r => r.compliance && r.compliance.hasFirebaseInitImport).length;
  const pagesWithDirectCdn = results.filter(r => r.compliance && r.compliance.totalDirectCdn > 0).length;

  let report = '';
  const t = (s) => { report += s + '\n'; };

  t('╔══════════════════════════════════════════════════════════╗');
  t('║      Firebase SDK Healthcheck Report                    ║');
  t('╚══════════════════════════════════════════════════════════╝');
  t('');
  t(`  Versão alvo:        v${TARGET_VERSION}`);
  t(`  Verificação:        ${CHECK_PRODUCTION ? 'CDN URLs (HTTP)' : 'Padrões locais'}`);
  t(`  Modo CI:            ${CI_MODE ? 'SIM' : 'não'}`);
  t(`  firebase-init.js:   ${firebaseInitExists ? '✅ presente' : '❌ AUSENTE'}`);
  t('');
  t(`  ─── Resumo ───`);
  t(`  Total HTMLs:              ${total}`);
  t(`  Com Firebase SDK:         ${withFirebase.length}`);
  t(`  Sem Firebase:             ${noFb.length}`);
  t(`  OK:                       ${ok.length}`);
  t(`  Warnings:                 ${warnings.length}`);
  t(`  Erros:                    ${errors.length}`);
  t('');
  t(`  ─── Compliance firebase-init.js ───`);
  t(`  Pages importando init:    ${pagesWithInit}`);
  t(`  Pages com CDN direto:     ${pagesWithDirectCdn}`);
  t('');

  if (errors.length > 0) {
    t('  ─── PÁGINAS COM ERRO ───');
    for (const r of errors) {
      t(`  ❌ ${pathRelative(r.file)}`);
      for (const e of r.errors) t(`     ${e}`);
      t('');
    }
  }

  if (warnings.length > 0) {
    t('  ─── PÁGINAS COM WARNING ───');
    for (const r of warnings) {
      t(`  ⚠️  ${pathRelative(r.file)}`);
      for (const e of r.errors) t(`     ${e}`);
      t('');
    }
  }

  if (ok.length > 0) {
    t('  ─── PÁGINAS OK ───');
    for (const r of ok) {
      const stats = [];
      if (r.compatCount > 0) stats.push(`${r.compatCount} compat`);
      if (r.modularCount > 0) stats.push(`${r.modularCount} modular`);
      let line = `  ✅ ${pathRelative(r.file)}  [${stats.join(', ')}]`;
      if (r.dupes.length > 0) line += ` ⚠️ duplicado: ${r.dupes.join(',')}`;
      if (r.compliance && r.compliance.hasFirebaseInitImport) line += ' 📦 init';
      t(line);
    }
    t('');
  }

  if (noFb.length > 0) {
    t(`  ─── SEM FIREBASE (${noFb.length}) ───`);
    for (const r of noFb) t(`  ➖ ${pathRelative(r.file)}`);
    t('');
  }

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const summaryStatus = !hasErrors && !hasWarnings ? '✅ SAUDÁVEL' :
    hasErrors ? `❌ ${errors.length} página(s) com erro` :
    `⚠️  ${warnings.length} página(s) com warning`;

  t(`  Status: ${summaryStatus}`);
  t('');

  return { report, hasErrors, hasWarnings };
}

function pathRelative(fullPath) {
  const normPath = fullPath.replace(/\\/g, '/');
  const normRoot = PROJECT_ROOT.replace(/\\/g, '/');
  return normPath.replace(normRoot, '').replace(/^\/+/, '') || fullPath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const htmlFiles = readdirSync(PROJECT_ROOT).filter(f => f.endsWith('.html'));
  const firebaseInitExists = existsSync(join(PROJECT_ROOT, FIREBASE_INIT_MODULE));
  const results = [];

  for (const file of htmlFiles) {
    const filePath = join(PROJECT_ROOT, file);
    const result = await checkFile(filePath, firebaseInitExists);
    results.push(result);
  }

  if (OUTPUT_JSON) {
    const output = results.map(r => ({
      file: pathRelative(r.file),
      status: r.status,
      totalRefs: r.totalRefs,
      versions: r.versions,
      obsoleteVersions: r.obsoleteVersions.length,
      unknownVersions: r.unknownVersions.length,
      compatCount: r.compatCount,
      modularCount: r.modularCount,
      dupes: r.dupes,
      errors: r.errors,
      urlResults: r.urlResults.length > 0 ? r.urlResults : undefined,
      compliance: r.compliance ? {
        hasFirebaseInitImport: r.compliance.hasFirebaseInitImport,
        directCdnImports: r.compliance.directCdnImports,
        directCdnScripts: r.compliance.directCdnScripts
      } : undefined
    }));
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else {
    const { report, hasErrors, hasWarnings } = buildReport(results, firebaseInitExists);
    process.stdout.write(report);
    if (CI_MODE && (hasErrors || hasWarnings)) {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
