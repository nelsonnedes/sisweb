// Backfill de numeroExibicao ("Nº 1, 2, ...") em romaneios TL/PCT/PES/Tora.
// DISPLAY ONLY: nunca altera id/numero/chaves; nunca renumera quem já tem número.
// Uso: node scripts/migrar-numero-exibicao-romaneios.cjs [--apply]
// Sem --apply: dry-run (só relata).
const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const TIPOS = [
  { tipo: 'tl', paths: ['romaneios/tl', 'romaneiosTl'] },
  { tipo: 'pct', paths: ['romaneios/pct', 'romaneiosPct'] },
  { tipo: 'pes', paths: ['romaneios/pes', 'romaneiosPes'] },
  { tipo: 'tora', paths: ['romaneios/tora', 'romaneiosTora'] }
];

function numValido(v) {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function tsOf(r) {
  if (!r || typeof r !== 'object') return 0;
  const cands = [r.timestamp, r.dataEmissao, r.data, r.dataHora, r.criadoEm, r.created, r.updatedAt];
  for (const c of cands) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    const p = Date.parse(c);
    if (!Number.isNaN(p)) return p;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const m = String(r.id || '').match(/(\d{10,})/);
  return m ? Number(m[1]) || 0 : 0;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = admin.database();
  const snap = await db.ref('companies').once('value');
  const companies = snap.val() || {};
  const updates = {};
  const relatorio = [];

  for (const [companyId, companyData] of Object.entries(companies)) {
    if (!companyData) continue;
    for (const { tipo, paths } of TIPOS) {
      for (const p of paths) {
        const node = companyData && companyData[p.split('/')[0]]
          ? p.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), companyData)
          : undefined;
        if (!node || typeof node !== 'object') continue;
        const isArray = Array.isArray(node);
        const entries = isArray ? node.map((v, i) => [String(i), v]) : Object.entries(node);
        const validos = entries.filter(([, v]) => v && typeof v === 'object');
        if (validos.length === 0) continue;
        let max = 0;
        validos.forEach(([, v]) => { const n = numValido(v.numeroExibicao); if (n > max) max = n; });
        const semNumero = validos
          .filter(([, v]) => !(numValido(v.numeroExibicao) > 0))
          .sort((a, b) => tsOf(a[1]) - tsOf(b[1]));
        if (semNumero.length === 0) continue;
        let prox = max + 1;
        semNumero.forEach(([k, v]) => {
          const base = `companies/${companyId}/${p}/${k}`;
          updates[`${base}/numeroExibicao`] = prox;
          prox++;
        });
        relatorio.push(`${companyId} ${p}: ${semNumero.length} numerados (de ${max + 1} a ${prox - 1}), total ${validos.length}`);
      }
    }
  }

  console.log(`--- ${apply ? 'APLICANDO' : 'DRY-RUN'} ---`);
  relatorio.forEach(l => console.log(' ' + l));
  const n = Object.keys(updates).length;
  console.log(`Total de campos: ${n}`);
  if (n === 0) { console.log('Nada a fazer.'); process.exit(0); }
  if (!apply) { console.log('Rode com --apply para gravar.'); process.exit(0); }
  await db.ref().update(updates);
  console.log('Backfill aplicado com sucesso.');
  process.exit(0);
}

main().catch(e => { console.error('ERRO:', e && e.message); process.exit(1); });
