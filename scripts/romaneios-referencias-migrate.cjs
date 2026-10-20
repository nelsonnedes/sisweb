'use strict';

/*
 * Backfill display-only de referências a romaneios em produtos, pedidos,
 * estoque, rastreabilidade e financeiro.
 *
 * Uso:
 *   node scripts/romaneios-referencias-migrate.cjs --tenant <id>
 *   node scripts/romaneios-referencias-migrate.cjs --tenant <id> --apply --backup tmp/backup.json
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
const ROOTS = [
  'produtos', 'pedidosVenda', 'vendas', 'pedidosCompra', 'compras',
  'estoque', 'estoqueProdutos', 'estoqueTorasAtual',
  'movimentacoesProdutos', 'movimentacoesToras', 'rastreabilidade',
  'financas', 'contasReceber',
];
const REF_FIELDS = new Set(['romaneioNumero', 'numeroRomaneio', 'origemNumero']);
const TECH_RE = /(?:TL_|PCT_|PES_|TORA-)[A-Za-z0-9_-]+/g;
const TECH_PAREN_RE = /\(\s*(?:N[º°]\s*)?((?:TL_|PCT_|PES_|TORA-)[A-Za-z0-9_-]+)\s*\)/gi;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
function has(name) { return process.argv.includes(name); }
function pad(n) { return String(n).padStart(6, '0'); }
function readNode(company, nodePath) {
  return nodePath.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), company);
}
function entriesOf(node) {
  if (!node || typeof node !== 'object') return [];
  return Array.isArray(node) ? node.map((v, i) => [String(i), v]) : Object.entries(node);
}
function officialNumber(record) {
  const formatted = String(record && record.numeroFormatado || '').trim();
  if (/^\d{6}$/.test(formatted)) return formatted;
  const seq = Number(record && record.numeroSequencial);
  return Number.isSafeInteger(seq) && seq > 0 ? pad(seq) : '';
}
function cleanRef(value) {
  return String(value == null ? '' : value).trim().replace(/^N[º°]\s*/i, '');
}
function mapReferenceValue(value, map) {
  const direct = map.get(cleanRef(value));
  if (direct) return direct;
  const parts = String(value || '').split(/\s*,\s*/).filter(Boolean);
  if (parts.length < 2) return '';
  const mapped = parts.map(part => map.get(cleanRef(part)));
  return mapped.every(Boolean) ? mapped.join(', ') : '';
}
function ensureDir(file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
}
function writeJson(file, value) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}
function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function envGuard() {
  const url = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
  const env = String(process.env.SISWEB_ENV || '').trim().toLowerCase();
  if (!url) throw new Error('FIREBASE_DATABASE_URL não definido.');
  if (env !== 'production' && /sisweb-7ce82/.test(url)) {
    throw new Error('Ambiente não-production aponta para banco de produção. Abortado.');
  }
  return url;
}

function buildNumberMap(company) {
  const map = new Map();
  for (const paths of Object.values(OFFICIAL)) {
    for (const nodePath of paths) {
      for (const [key, record] of entriesOf(readNode(company, nodePath))) {
        if (!record || typeof record !== 'object') continue;
        const number = officialNumber(record);
        if (!number) continue;
        for (const ref of [record.id, record.firebaseKey, record.numero, record.legacyId, key]) {
          const clean = cleanRef(ref);
          if (clean) map.set(clean, number);
        }
      }
    }
  }
  return map;
}

function scan(node, nodePath, map, patches, unmatched) {
  if (!node || typeof node !== 'object' || nodePath.split('/').length > 12) return;
  if (Array.isArray(node)) {
    node.forEach((value, index) => scan(value, `${nodePath}/${index}`, map, patches, unmatched));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const childPath = `${nodePath}/${key}`;
    if (typeof value === 'string') {
      if (REF_FIELDS.has(key)) {
        const number = mapReferenceValue(value, map);
        if (number) patches[childPath] = number;
        else if (TECH_RE.test(cleanRef(value))) { TECH_RE.lastIndex = 0; unmatched.push({ path: childPath, value }); }
        TECH_RE.lastIndex = 0;
        continue;
      }
      if (key === 'numero' && /\/romaneiosOrigem\//.test(nodePath)) {
        const number = mapReferenceValue(value, map);
        if (number) patches[childPath] = number;
        else if (TECH_RE.test(cleanRef(value))) { TECH_RE.lastIndex = 0; unmatched.push({ path: childPath, value }); }
        TECH_RE.lastIndex = 0;
        continue;
      }
      if (key === 'descricao') {
        const replaced = value.replace(TECH_PAREN_RE, (full, ref) => {
          const number = map.get(cleanRef(ref));
          return number ? `(Nº ${number})` : full;
        });
        if (replaced !== value) patches[childPath] = replaced;
        continue;
      }
    }
    if (value && typeof value === 'object') scan(value, childPath, map, patches, unmatched);
  }
  if (node.origemId && /^romaneio_/.test(String(node.origem || ''))) {
    const number = map.get(cleanRef(node.origemId));
    if (number && node.romaneioNumero !== number) patches[`${nodePath}/romaneioNumero`] = number;
  }
}

async function main() {
  const tenant = String(arg('--tenant', '') || '').trim();
  if (!tenant) throw new Error('Informe --tenant.');
  const apply = has('--apply');
  const orphanMode = String(arg('--orphan', '') || '').trim().toLowerCase();
  const backupFile = arg('--backup', '');
  const reportFile = arg('--report', `tmp/romaneios-referencias-${tenant}-${apply ? 'apply' : 'dry-run'}.json`);
  if (apply && !backupFile) throw new Error('--apply exige --backup <arquivo>.');

  envGuard();
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS.');
  }
  admin.initializeApp({ databaseURL: process.env.FIREBASE_DATABASE_URL });
  const db = admin.database();
  const company = (await db.ref(`companies/${tenant}`).once('value')).val();
  if (!company || typeof company !== 'object') throw new Error('Tenant não encontrado.');

  const map = buildNumberMap(company);
  const patches = {};
  const unmatched = [];
  const roots = {};
  for (const root of ROOTS) {
    if (company[root] === undefined) continue;
    const before = Object.keys(patches).length;
    scan(company[root], `companies/${tenant}/${root}`, map, patches, unmatched);
    roots[root] = Object.keys(patches).length - before;
  }

  let orphanPatches = 0;
  if (orphanMode === 's/n') {
    const seen = new Set();
    for (const item of unmatched) {
      if (!item || !item.path || seen.has(item.path)) continue;
      seen.add(item.path);
      patches[item.path] = 's/n';
      patches[`${item.path}Legado`] = item.value;
      orphanPatches++;
    }
  }

  const report = { tenant, applied: apply, createdAt: new Date().toISOString(), mapSize: map.size, roots, totalPatches: Object.keys(patches).length, orphanPatches, unmatched };
  writeJson(reportFile, report);
  console.log(`--- ${apply ? 'APLICAÇÃO' : 'DRY-RUN'} ---`);
  console.log(`Mapa de referências: ${map.size}`);
  for (const [root, count] of Object.entries(roots)) if (count) console.log(`${root}: ${count} campo(s)`);
  console.log(`Total: ${report.totalPatches} campo(s); não resolvidos: ${unmatched.length}`);
  console.log(`Relatório: ${reportFile}`);
  if (!apply) {
    console.log('Nada foi gravado. Use --apply --backup <arquivo> para aplicar.');
    process.exit(0);
  }

  const backup = { tenant, createdAt: new Date().toISOString(), checksum: checksum(company), data: company };
  writeJson(backupFile, backup);
  console.log(`Backup: ${backupFile} (sha256=${backup.checksum})`);

  const entries = Object.entries(patches);
  for (let i = 0; i < entries.length; i += 100) {
    await db.ref().update(Object.fromEntries(entries.slice(i, i + 100)));
    console.log(`Gravados ${Math.min(i + 100, entries.length)}/${entries.length} campos.`);
  }
  console.log('Referências de exibição atualizadas. IDs técnicos preservados.');
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
