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

test('M2: vTotTrib calculado internamente (omitido do XML — opcional, evita 685)', () => {
  assert.match(xml, /vTotTrib: vICMS \+ vIPI \+ vPIS \+ vCOFINS \+ vIBS \+ vCBS \+ vIS/);
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

test('idDest automático (1 interna / 2 interestadual / 3 exterior)', () => {
  assert.match(svc, /idDestAuto/);
  assert.match(svc, /ufDest !== ufEmit \? 2 : 1/);
});

test('atualizarStatus não substitui o nó (merge preservando campos)', () => {
  assert.doesNotMatch(sto, /substitui completamente/);
  assert.match(sto, /const atual = await carregarNF/);
});

test('A7: nfeProc/XML autorizado persistido no backend (protNFe real)', () => {
  assert.match(nfFn, /nfeProc versao="4\.00"/);
  assert.match(nfFn, /xmlProcStoragePath/);
  assert.match(nfFn, /<protNFe/);
  assert.doesNotMatch(nfFn, /<cStat>100<\/cStat>\s*<xMotivo>Autorizado/);
});

test('M4: superadmin por claim exige allowlist de UID', () => {
  assert.match(nfFn, /function isSuperAdminUidAllowed/);
  assert.match(nfFn, /token\.superadmin === true && isSuperAdminUidAllowed\(uid\)/);
});

test('M1: <indPag> removido de <ide> (validado no schema oficial PL_010f)', () => {
  assert.doesNotMatch(xml, /<indPag>/);
  assert.match(xml, /M1 \(validado/);
});

test('Reforma Tributária: grupos IBSCBS/IS e totais implementados (schema PL_010f)', () => {
  assert.match(xml, /function buildIBSCBS/);
  assert.match(xml, /function buildIS/);
  assert.match(xml, /<IBSCBS><CST>/);
  assert.match(xml, /cClassTrib/);
  assert.match(xml, /<gIBSCBS>/);
  assert.match(xml, /<ISTot>/);
  assert.match(xml, /<IBSCBSTot>/);
  assert.match(cfg, /ibscbs: \{/);
  assert.match(cfg, /cstIS/);
});

test('Reforma Tributária avançada: gRed/gDif/gCredPresOper', () => {
  assert.match(xml, /<gRed><pRedAliq>/);
  assert.match(xml, /<gDif><pDif>/);
  assert.match(xml, /<gCredPresOper>/);
  assert.match(cfg, /pRedAliq/);
  assert.match(cfg, /credPresOper/);
});

