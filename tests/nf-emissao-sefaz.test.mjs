import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Travas da auditoria técnica (2026-10-11): emissão fiscal, assinatura,
// numeração atômica, mapeamento CST/CSOSN e ICMS interestadual.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const svc  = read('nf-service.js');
const sto  = read('nf-storage.js');
const xml  = read('nf-xml-builder.js');
const cfg  = read('nf-config.js');
const nfFn = read('functions/nf-functions.js');
const idx  = read('functions/index.js');

test('C1: emissão transmite à SEFAZ (nf_enviarSEFAZ)', () => {
  assert.match(svc, /callFunction\('nf_enviarSEFAZ'/);
  assert.match(svc, /nfId: saved\.id/);
  assert.match(svc, /modelo: 55/);
  assert.match(svc, /xmlAssinado/);
});

test('A1: falha de assinatura bloqueia emissão (fail-closed)', () => {
  assert.match(svc, /Emissão bloqueada/);
  assert.match(svc, /Senha do certificado A1 é obrigatória/);
  assert.doesNotMatch(svc, /Assinatura falhou, continuando em modo local/);
});

test('C2: buildNFeProc (forja de protocolo) removido', () => {
  assert.doesNotMatch(xml, /buildNFeProc/);
  assert.doesNotMatch(xml, /Autorizado o uso da NF-e/);
  assert.doesNotMatch(xml, /<cStat>100<\/cStat>/);
});

test('A3/A4: CST e CSOSN mapeados corretamente no XML', () => {
  assert.match(xml, /ICMS20>[^]*?pRedBC/);
  assert.match(xml, /ICMSSN201/);
  assert.match(xml, /ICMSSN202/);
  assert.match(xml, /ICMSSN500/);
  assert.match(xml, /ICMSSN900/);
  assert.match(xml, /case '70'/);
  assert.match(xml, /case '60'/);
});

test('M2: vTotTrib calculado (não 0.00 fixo)', () => {
  assert.match(xml, /vTotTrib: vICMS \+ vIPI \+ vPIS \+ vCOFINS/);
  assert.doesNotMatch(xml, /<vTotTrib>0\.00<\/vTotTrib>/);
});

test('A2: alíquota interestadual consciente de origem (4/7/12)', () => {
  assert.match(cfg, /function aliquotaInterestadual/);
  assert.match(cfg, /importado === true\) return 4/);
  assert.match(cfg, /return 7/);
  assert.match(cfg, /return 12/);
  assert.match(cfg, /aliquotaInterestadual,/);
});

test('C3: numeração atômica via backend (nf_reservarNumero)', () => {
  assert.match(sto, /callFunction\('nf_reservarNumero'/);
  assert.match(nfFn, /exports\.nf_reservarNumero = onFiscalCall/);
  assert.match(nfFn, /\.transaction\(/);
  assert.match(idx, /exports\.nf_reservarNumero\s*=/);
});

test('atualizarStatus não substitui o nó (merge preservando campos)', () => {
  assert.doesNotMatch(sto, /substitui completamente/);
  assert.match(sto, /const atual = await carregarNF/);
});
