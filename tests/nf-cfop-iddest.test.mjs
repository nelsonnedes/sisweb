import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// CFOP acompanha o idDest (cStat 733): 5xxx/1xxx = interna, 6xxx/2xxx = interestadual.
globalThis.window = globalThis.window || {};
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
const src = fs.readFileSync('nf-config.js', 'utf8');
new Function('window', 'localStorage', 'structuredClone', src)(globalThis.window, globalThis.localStorage, structuredClone);
const svc = globalThis.window.NFConfigService;

test('ajustarCFOP troca o 1º dígito conforme idDest', () => {
  assert.equal(svc.ajustarCFOP(2, '5102'), '6102');
  assert.equal(svc.ajustarCFOP(1, '6102'), '5102');
  assert.equal(svc.ajustarCFOP(2, '1102'), '2102');
  assert.equal(svc.ajustarCFOP(1, '2102'), '1102');
  assert.equal(svc.ajustarCFOP(1, '5102'), '5102');
  assert.equal(svc.ajustarCFOP(2, '6102'), '6102');
  assert.equal(svc.ajustarCFOP(1, '5927'), '5927');
  assert.equal(svc.ajustarCFOP(9, '5102'), '5102');
});

test('buildNFeFromForm usa idDest automático por UF', () => {
  const svcSrc = fs.readFileSync('nf-service.js', 'utf8');
  assert.match(svcSrc, /idDestAuto/);
  // Sem regra da natureza: CFOP acompanha o idDest (733). Com regra
  // explícita (Fase B): usa o CFOP da regra (já prevê o destino).
  assert.match(svcSrc, /regraAplicada\?\.cfop/);
  assert.match(svcSrc, /ajustarCFOP\?\.\(idDestFinal, item\.cfop\)/);
});
