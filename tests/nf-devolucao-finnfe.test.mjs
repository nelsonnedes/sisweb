import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const naturezas = readFileSync('nf-naturezas.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

test('devoluções: seeds com finNFe 4 (CFOP 1202/5202 sem finNFe de devolução → cStat 328)', () => {
  assert.match(
    naturezas,
    /id: 'nat_devol_compra'[^}]*cfopPadrao: '5202'[^}]*finNFe: '4'/,
  );
  assert.match(
    naturezas,
    /id: 'nat_devol_venda'[^}]*cfopPadrao: '1202'[^}]*finNFe: '4'/,
  );
});

test('nfAplicarNatOp: aplica finNFe da natureza (e reseta p/ 1 sem finNFe) + revela grupo NFref', () => {
  assert.match(
    html,
    /const finEl = document\.getElementById\('nfFinNFe'\);\s*\n\s*if \(finEl\) \{\s*\n\s*const finNat = String\(nat\.finNFe \|\| '1'\);\s*\n\s*if \(finNat !== finEl\.value\) \{\s*\n\s*finEl\.value = finNat;\s*\n\s*finEl\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\);/,
  );
  assert.match(html, /id="nfNFrefGroup" hidden/);
  assert.match(html, /NFref: \(document\.getElementById\('nfNFref'\)\?\.value \|\| ''\)\.replace\(\/\\D\/g, ''\)/);
});

test('impostoDevol: pDevol com 2 decimais e vIPIDevol dentro de IPI (leiauteNFe_v4.00.xsd)', () => {
  const builder = readFileSync('nf-xml-builder.js', 'utf8');
  assert.match(builder, /<impostoDevol><pDevol>\$\{num\(pDevol, 2\)\}<\/pDevol><IPI><vIPIDevol>\$\{num\(vIPIDevol\)\}<\/vIPIDevol><\/IPI><\/impostoDevol>/);
  assert.doesNotMatch(builder, /<pDevol>\$\{num\(pDevol, 4\)\}<\/pDevol>/);
});

test('nfAplicarNatOp (devolução): tPag 90 automático (cStat 871)', () => {
  assert.match(
    html,
    /if \(String\(nat\.finNFe \|\| ''\) === '4'\) \{\s*\n\s*const pagEl = document\.getElementById\('nfFormaPag'\);\s*\n\s*if \(pagEl && pagEl\.value !== '90'\) \{\s*\n\s*pagEl\.value = '90';\s*\n\s*pagEl\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\);/,
  );
});

test('nf-service: ponte formData.NFref → ide.NFref (array de 44 dígitos)', () => {
  const service = readFileSync('nf-service.js', 'utf8');
  assert.match(service, /NFref:      \(\(\) => \{/);
  assert.match(service, /const ref = String\(formData\.NFref \|\| ''\)\.replace\(\/\\D\/g, ''\);/);
  assert.match(service, /return ref\.length === 44 \? \[ref\] : \[\];/);
});
