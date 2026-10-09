import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// E6: auditoria de pareamento show/hide (folha/species/client/fornecedor).
// Todas as áreas estão pareadas (hide em finally) — nenhuma mudança de
// comportamento. Este teste trava o pareamento contra regressão futura.
const pares = [
  ['js/species.js', /showLoading\(true\)/g, /showLoading\(false\)/g],
  ['js/client.js', /showLoading\(true\)/g, /showLoading\(false\)/g],
  ['js/fornecedor.js', /showLoading\(true\)/g, /showLoading\(false\)/g],
  ['folha_pagamento/folha-funcionarios.js', /showLoading\(\)/g, /hideLoading\(\)/g],
];

for (const [arquivo, reShow, reHide] of pares) {
  test(`E6: ${arquivo} tem hide para cada show`, () => {
    const src = readFileSync(arquivo, 'utf8');
    const shows = (src.match(reShow) || []).length;
    const hides = (src.match(reHide) || []).length;
    assert.ok(shows > 0, `${arquivo}: nenhum show encontrado`);
    assert.ok(hides >= shows, `${arquivo}: shows=${shows} hides=${hides}`);
    assert.match(src, /finally/, `${arquivo}: sem bloco finally`);
  });
}
