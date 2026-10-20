'use strict';

/*
 * Backfill de numeração de negócio para romaneios.
 * NÃO rekeya id/firebaseKey/numero técnico.
 * Uso:
 *   node scripts/romaneios-numeracao-migrate.cjs --tenant <id> [--tipos tl,pct,pes,tora,pre_tl]
 *   node scripts/romaneios-numeracao-migrate.cjs --tenant <id> --apply --backup tmp/backup.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const OFFICIAL = {
  tl: ['romaneios/tl', 'romaneiosTl'],
  pct: ['romaneios/pct', 'romaneiosPct'],
  pes: ['romaneios/pes', 'romaneiosPes'],
  tora: ['romaneios/tora', 'romaneiosTora'],
};
const PRE_TYPES = { TL: 'pre_tl', PCT: 'pre_pct', PES: 'pre_pes', TORA: 'pre_tora' };
const ALL_TYPES = ['tl', 'pct', 'pes', 'tora', 'pre_tl', 'pre_pct', 'pre_pes', 'pre_tora'];
const MAX_NUMERO = 999999;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
function has(name) { return process.argv.includes(name); }
function num(v) {
  const n = typeof v === 'number' ? v : parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function pad(n) { return String(n).padStart(6, '0'); }
function dateMs(r) {
  const candidates = [r && r.dataEmissao, r && r.data, r && r.dataHora, r && r.timestamp,
    r && r.criadoEm, r && r.created, r && r.createdAt, r && r.updatedAt, r && r.atualizadoEm];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    const parsed = Date.parse(c);
    if (!Number.isNaN(parsed)) return parsed;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
function stableId(record, key) {
  return String(record.id || record.firebaseKey || record.key || record.numero || key || '');
}
function readNode(company, nodePath) {
  return nodePath.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), company);
}
function entriesOf(node) {
  if (!node || typeof node !== 'object') return [];
  return Array.isArray(node) ? node.map((v, i) => [String(i), v]) : Object.entries(node);
}
function collect(company, tenant, type, paths) {
  const byId = new Map();
  const warnings = [];
  for (const nodePath of paths) {
    const node = readNode(company, nodePath);
    const entries = entriesOf(node);
    for (const [key, record] of entries) {
      if (!record || typeof record !== 'object') continue;
      if (type.startsWith('pre_')) {
        const family = String(record.tipo || '').trim().toUpperCase();
        if (PRE_TYPES[family] !== type) continue;
      }
      const id = stableId(record, key);
      if (!id) {
        warnings.push({ type, path: `${nodePath}/${key}`, reason: 'sem id' });
        continue;
      }
      const fullPath = `companies/${tenant}/${nodePath}/${key}`;
      const previous = byId.get(id);
      if (previous) {
        previous.aliases.push(fullPath);
        warnings.push({ type, path: fullPath, reason: 'espelho/duplicado de id', duplicateOf: previous.path });
        continue;
      }
      byId.set(id, { key, id, record, path: fullPath, nodePath, aliases: [] });
    }
  }
  return { records: Array.from(byId.values()), warnings };
}
function planType(records, type) {
  const ordered = records.slice().sort((a, b) => {
    const da = dateMs(a.record), db = dateMs(b.record);
    return (da - db) || a.id.localeCompare(b.id);
  });
  const used = new Set();
  let max = 0;
  for (const item of ordered) {
    const existing = num(item.record.numeroSequencial) || num(item.record.numeroExibicao);
    if (existing > max) max = existing;
  }
  let next = max + 1;
  const changes = [];
  const unchanged = [];
  const duplicates = [];
  for (const item of ordered) {
    const record = item.record;
    let number = num(record.numeroSequencial) || num(record.numeroExibicao);
    let preserved = true;
    if (!number || used.has(number)) {
      if (number) duplicates.push({ id: item.id, number });
      number = next++;
      preserved = false;
    }
    if (number > MAX_NUMERO) throw new Error(`Numeração excedeu ${MAX_NUMERO} em ${type}.`);
    used.add(number);
    const bases = [item.path].concat(item.aliases || []);
    const legacyNumber = num(record.numeroExibicao);
    const patch = {};
    for (const base of bases) {
      patch[`${base}/legacyId`] = record.legacyId || item.key;
      patch[`${base}/numeroSequencial`] = number;
      patch[`${base}/numeroFormatado`] = pad(number);
      patch[`${base}/numeroExibicao`] = number;
      if (legacyNumber && legacyNumber !== number) patch[`${base}/numeroExibicaoLegado`] = legacyNumber;
    }
    changes.push({ type, id: item.id, path: item.path, numero: number, numeroFormatado: pad(number), preserved, legacyId: record.legacyId || item.key, patch });
    if (preserved && record.numeroSequencial && record.numeroFormatado === pad(number)) unchanged.push(item.id);
  }
  return { max: Math.max(max, next - 1), changes, duplicates, unchanged };
}
function envGuard() {
  const url = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
  const env = String(process.env.SISWEB_ENV || '').trim().toLowerCase();
  if (!url) throw new Error('FIREBASE_DATABASE_URL não definido.');
  if (env !== 'production' && /sisweb-7ce82/.test(url)) {
    throw new Error('Ambiente não-production aponta para banco de produção. Abortado.');
  }
  if (env === 'sandbox' && !/(sandbox|demo|localhost|127\.0\.0\.1)/.test(url)) {
    throw new Error('SISWEB_ENV=sandbox com URL não-sandbox. Abortado.');
  }
  return url;
}
function ensureDir(file) {
  const dir = path.dirname(path.resolve(file));
  fs.mkdirSync(dir, { recursive: true });
}
function writeJson(file, value) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}
function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function main() {
  const tenant = String(arg('--tenant', '') || '').trim();
  if (!tenant) throw new Error('Informe --tenant.');
  const selected = String(arg('--tipos', ALL_TYPES.join(','))).split(',').map(s => s.trim()).filter(Boolean);
  const invalid = selected.filter(t => !ALL_TYPES.includes(t));
  if (invalid.length) throw new Error(`Tipos inválidos: ${invalid.join(', ')}`);
  const apply = has('--apply');
  const backupFile = arg('--backup', '');
  const reportFile = arg('--report', `tmp/romaneios-${tenant}-${apply ? 'apply' : 'dry-run'}.json`);
  if (apply && !backupFile) throw new Error('--apply exige --backup <arquivo>.');

  envGuard();
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS (sem service-account hardcoded).');
  }
  admin.initializeApp({ databaseURL: process.env.FIREBASE_DATABASE_URL });
  const db = admin.database();
  const companySnap = await db.ref(`companies/${tenant}`).once('value');
  const company = companySnap.val();
  if (!company || typeof company !== 'object') throw new Error('Tenant não encontrado.');

  const plan = { tenant, applied: apply, createdAt: new Date().toISOString(), types: {}, updates: {}, warnings: [] };
  const sequenceSeeds = {};
  for (const type of selected) {
    const paths = type.startsWith('pre_') ? ['preromaneios'] : OFFICIAL[type];
    if (!paths) continue;
    const collected = collect(company, tenant, type, paths);
    plan.warnings.push(...collected.warnings);
    if (collected.records.length === 0) continue;
    const result = planType(collected.records, type);
    plan.types[type] = {
      total: collected.records.length,
      unchanged: result.unchanged.length,
      changes: result.changes.length,
      duplicates: result.duplicates,
      max: result.max,
    };
    for (const change of result.changes) Object.assign(plan.updates, change.patch);
    sequenceSeeds[type] = result.max;
  }

  writeJson(reportFile, plan);
  console.log(`--- ${apply ? 'APLICAÇÃO' : 'DRY-RUN'} ---`);
  for (const [type, summary] of Object.entries(plan.types)) {
    console.log(`${type}: total=${summary.total} alterações=${summary.changes} duplicados=${summary.duplicates.length} max=${summary.max}`);
  }
  if (plan.warnings.length) console.log(`Avisos: ${plan.warnings.length} (ver relatório)`);
  console.log(`Relatório: ${reportFile}`);
  if (!apply) {
    console.log('Nada foi gravado. Use --apply --backup <arquivo> para aplicar.');
    return;
  }

  const backup = { tenant, createdAt: new Date().toISOString(), checksum: checksum(company), data: company };
  writeJson(backupFile, backup);
  console.log(`Backup: ${backupFile} (sha256=${backup.checksum})`);

  const updates = Object.entries(plan.updates);
  for (let i = 0; i < updates.length; i += 100) {
    const batch = Object.fromEntries(updates.slice(i, i + 100));
    await db.ref().update(batch);
    console.log(`Gravados ${Math.min(i + 100, updates.length)}/${updates.length} campos.`);
  }
  for (const [type, max] of Object.entries(sequenceSeeds)) {
    if (!(max > 0)) continue;
    const ref = db.ref(`companies/${tenant}/sequences/romaneios/${type}`);
    await ref.transaction((current) => {
      const currentNumber = current && Number(current.current) || 0;
      if (currentNumber >= max) return current;
      return {
        ...(current && typeof current === 'object' ? current : {}),
        current: max,
        last: pad(max),
        updatedAt: new Date().toISOString(),
      };
    });
  }
  console.log('Numeração e contadores aplicados. Vínculos técnicos não foram alterados.');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error('ERRO:', error && error.message ? error.message : error);
    process.exit(1);
  });
}

module.exports = { planType, collect, dateMs, num, pad };