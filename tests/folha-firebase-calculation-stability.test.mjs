import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = 'folha_pagamento';
const activeScripts = [
  'folha-firebase-manager.js',
  'folha-firebase-optimized.js',
  'folha-main.js',
  'folha-filtros.js',
  'folha-relatorios.js',
  'folha-funcionarios.js',
  'folha-cargos.js',
  'folha-utils.js',
  'folha-lancamentos.js',
  'banco-horas-firebase.js',
];

const read = (name) => readFileSync(`${folder}/${name}`, 'utf8');

test('Folha usa apenas o SDK Firebase local nos módulos ativos', () => {
  for (const name of activeScripts) {
    const source = read(name);
    assert.doesNotMatch(
      source,
      /https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js/,
      `${name} não deve misturar o SDK gstatic com firebase-init.js`,
    );
    if (source.includes('firebase-database.js')) {
      assert.match(source, /\.\.\/firebase\/sdk\/firebase-database\.js/);
    }
  }
});

test('Folha bloqueia cálculo durante hidratação e preserva salarioBase no payload', () => {
  const source = read('folha-lancamentos.js');
  assert.match(source, /this\._isHydratingForm\s*=\s*false/);
  assert.match(source, /this\._isHydratingForm\s*=\s*true;[\s\S]*?this\.clearFolhaForm\(\);[\s\S]*?this\.fillFolhaForm\(lancamento\)[\s\S]*?this\._isHydratingForm\s*=\s*false;/);
  assert.match(source, /calcularFolhaRealTime\(\)\s*\{\s*if \(this\._isHydratingForm\) return;/);
  assert.match(source, /const data = \{[\s\S]*?salarioBase,/);
  assert.match(source, /!data\.removerCalculosAutomaticos && data\.salarioBase > 0/);
});

test('Folha sincroniza relatorios no caminho interno sem duplicar o prefixo', () => {
  const source = read('folha-firebase-optimized.js');
  assert.match(source, /['"]relatorios['"]\s*:\s*['"]folha\/relatorios['"]/);
  assert.match(source, /const fallbackKey = String\(mappedKey\)\.startsWith\(['"]folha\/['"]\)/);
  assert.match(source, /manager\.loadData\(fallbackKey/);
  assert.doesNotMatch(source, /manager\.loadData\(`folha\/\$\{mappedKey\}`/);
});
