#!/usr/bin/env node
/**
 * Guard fail-closed de ambiente para deploys e scripts de escrita.
 * Uso:
 *   node scripts/assert-firebase-env.mjs --env sandbox --project sisweb-sandbox-romaneios
 *   node scripts/assert-firebase-env.mjs --env production --project sisweb-7ce82
 *   node scripts/assert-firebase-env.mjs --env emulator --project demo-sisweb-sandbox
 */
import process from 'node:process';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
function fail(message) {
  console.error(`[assert-firebase-env] ${message}`);
  process.exit(1);
}

const env = String(arg('--env', '') || '').trim().toLowerCase();
const project = String(arg('--project', process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '') || '').trim();
const databaseUrl = String(
  arg('--database-url', process.env.FIREBASE_DATABASE_URL || process.env.DATABASE_URL || '')
    || '',
).trim();
const productionProject = 'sisweb-7ce82';
const productionHosts = /(^|\.)siswebsoftware\.com\.br$|^sisweb-7ce82\.(web\.app|firebaseapp\.com)$/i;

if (!['sandbox', 'production', 'emulator'].includes(env)) {
  fail('Informe --env sandbox|production|emulator.');
}
if (!project) fail('Informe --project ou GCLOUD_PROJECT.');

if (env === 'production') {
  if (project !== productionProject) fail(`Produção exige project ${productionProject}.`);
  if (databaseUrl && !/sisweb-7ce82/.test(databaseUrl)) {
    fail('Produção com FIREBASE_DATABASE_URL de outro projeto.');
  }
  console.log(`[assert-firebase-env] produção OK (${project}).`);
  process.exit(0);
}

if (project === productionProject || /sisweb-7ce82/.test(databaseUrl)) {
  fail('Sandbox/emulator não pode apontar para o projeto/banco de produção.');
}
if (env === 'sandbox' && !/^sisweb-sandbox-|^demo-/.test(project)) {
  fail('Sandbox exige project iniciado por sisweb-sandbox- ou demo-.');
}
if (env === 'emulator' && !/^demo-/.test(project)) {
  fail('Emulador exige project demo-*.');
}
if (databaseUrl && productionHosts.test(new URL(databaseUrl).hostname)) {
  fail('Sandbox/emulator com host de produção.');
}
console.log(`[assert-firebase-env] ${env} OK (${project}).`);
