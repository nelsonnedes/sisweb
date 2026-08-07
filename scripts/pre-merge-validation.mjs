#!/usr/bin/env node
/**
 * pre-merge-validation.mjs
 *
 * Orquestra validações locais/CI antes de merge ou deploy do PR.
 * Não altera arquivos (read-only), exceto build:hosting que recria hosting-dist/.
 *
 * Uso:
 *   node scripts/pre-merge-validation.mjs
 *   node scripts/pre-merge-validation.mjs --with-emulator
 *   node scripts/pre-merge-validation.mjs --with-build --with-smoke
 *   SISWEB_BASE_URL=https://preview-xxx.web.app node scripts/pre-merge-validation.mjs --with-smoke
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const withEmulator = args.has('--with-emulator');
const withBuild = args.has('--with-build');
const withSmoke = args.has('--with-smoke');
const skipUnit = args.has('--skip-unit');

function runStep(name, command, commandArgs, optional = false) {
  const started = Date.now();
  const quotedCommand = command.includes(' ') ? `"${command}"` : command;
  process.stdout.write(`\n▶ ${name}\n   $ ${quotedCommand} ${commandArgs.join(' ')}\n`);

  const result = spawnSync(quotedCommand, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  const elapsedMs = Date.now() - started;
  const ok = result.status === 0;

  return {
    name,
    ok,
    optional,
    elapsedMs,
    status: result.status ?? 1,
  };
}

function checkStaticArtifacts() {
  const required = [
    'tools/inject-cachebusters.mjs',
    'database.rules.json',
    'hosting-files.json',
    'firebase-init.js',
    'functions/index.js',
    'functions/finance-functions.js',
  ];

  const missing = required.filter((rel) => !existsSync(join(ROOT, rel)));
  if (missing.length > 0) {
    console.error(`FAIL artefatos estáticos: arquivos ausentes:\n  - ${missing.join('\n  - ')}`);
    return false;
  }

  const functionsIndex = readFileSync(join(ROOT, 'functions/index.js'), 'utf8');
  const callables = [
    'financeSyncCompra',
    'updateMyCompanyProfile',
    'setCompanyClaim',
  ];
  const missingExports = callables.filter((name) => !new RegExp(`exports\\.${name}\\s*=`).test(functionsIndex));

  if (missingExports.length > 0) {
    console.error(`FAIL callables esperadas não exportadas em functions/index.js:\n  - ${missingExports.join('\n  - ')}`);
    return false;
  }

  console.log('PASS artefatos estáticos e callables esperadas');
  return true;
}

function main() {
  console.log('='.repeat(72));
  console.log('Sisweb — validação pré-merge');
  console.log('='.repeat(72));

  /** @type {{ name: string; ok: boolean; optional?: boolean; elapsedMs: number; status: number }[]} */
  const results = [];

  if (!checkStaticArtifacts()) {
    results.push({ name: 'artefatos estáticos', ok: false, elapsedMs: 0, status: 1 });
  } else {
    results.push({ name: 'artefatos estáticos', ok: true, elapsedMs: 0, status: 0 });
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const node = process.execPath;

  results.push(runStep('lint', npm, ['run', 'lint']));
  results.push(runStep('typecheck', npm, ['run', 'typecheck']));

  if (!skipUnit) {
    results.push(runStep('unit tests (tests/*.test.mjs)', npm, ['test']));
    results.push(runStep('PR focus: auth + company + compras', node, [
      '--test',
      'tests/auth-session-phase2.test.mjs',
      'tests/company-profile-permissions.test.mjs',
      'tests/compras-financeiro-status.test.mjs',
      'tests/finance-transactions.test.mjs',
      'tests/security-rbac-multitenant.test.mjs',
    ]));
  }

  results.push(runStep('audit cachebusters (read-only)', node, [join('tools', 'audit-cachebusters.mjs')]));

  if (withEmulator) {
    results.push(runStep('RBAC emulator (database.rules.json)', npm, ['run', 'test:security:emulator']));
  } else {
    console.log('\n⏭ RBAC emulator omitido (use --with-emulator para incluir)');
  }

  if (withBuild) {
    results.push(runStep('build hosting-dist', npm, ['run', 'build:hosting']));
    const hostingInit = join(ROOT, 'hosting-dist', 'firebase-init.js');
    if (!existsSync(hostingInit)) {
      console.error('FAIL build:hosting — hosting-dist/firebase-init.js ausente');
      results.push({ name: 'hosting-dist/firebase-init.js', ok: false, elapsedMs: 0, status: 1 });
    } else {
      console.log('PASS hosting-dist/firebase-init.js presente');
      results.push({ name: 'hosting-dist/firebase-init.js', ok: true, elapsedMs: 0, status: 0 });
    }
  } else {
    console.log('\n⏭ build:hosting omitido (use --with-build para incluir)');
  }

  if (withSmoke) {
    if (!process.env.SISWEB_BASE_URL) {
      console.error('FAIL smoke — defina SISWEB_BASE_URL (ex.: preview channel URL)');
      results.push({ name: 'smoke preview', ok: false, elapsedMs: 0, status: 1 });
    } else {
      results.push(runStep('smoke preview hosting', node, [join('tools', 'smoke-preview-hosting.mjs')]));
    }
  } else {
    console.log('\n⏭ smoke preview omitido (use --with-smoke e SISWEB_BASE_URL)');
  }

  console.log('\n' + '='.repeat(72));
  console.log('Resumo');
  console.log('='.repeat(72));

  for (const result of results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    const suffix = result.optional ? ' (opcional)' : '';
    console.log(`${marker} ${result.name}${suffix} — ${result.elapsedMs}ms`);
  }

  const failures = results.filter((r) => !r.ok && !r.optional);
  const passed = results.filter((r) => r.ok).length;

  console.log(`\nTotal: ${passed}/${results.length} etapas OK`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} etapa(s) falharam. Corrija antes do merge/deploy.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nValidação pré-merge concluída com sucesso.');
  if (!withEmulator) {
    console.log('Lembrete: rode também `npm run test:security:emulator` antes de merge.');
  }
  if (!withBuild) {
    console.log('Lembrete: rode `node tools/inject-cachebusters.mjs` antes do deploy.');
  }
}

main();
