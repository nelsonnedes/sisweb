import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('folha restaura Mes/Ano persistido sem validar contra dados carregados', () => {
  const folhaFiltros = read('folha_pagamento/folha-filtros.js');

  const restoreBlock = folhaFiltros.slice(
    folhaFiltros.indexOf('restorePersistedFilters()'),
    folhaFiltros.indexOf('/**\n     * 🎯 CONFIGURAR EVENT LISTENERS')
  );

  assert.match(folhaFiltros, /function readPersistedLocalValue\(storageKey, fallback = null\)/);
  assert.match(restoreBlock, /const savedRaw = readPersistedLocalValue\('folha_filtros_ativos', '\{\}'\)/);
  assert.match(restoreBlock, /const savedMesAno = saved && saved\.mesAno \? normalizeMes\(saved\.mesAno\) : ''/);
  assert.match(restoreBlock, /const mesAnoInicial = \/\^\\d\{4\}-\\d\{2\}\$\/\.test\(savedMesAno\) \? savedMesAno : yyyyMm/);
  assert.doesNotMatch(restoreBlock, /existeMesSaved/);
  assert.doesNotMatch(restoreBlock, /folhas\.some\(f => f && normalizeMes\(f\.mesAno\) === normalizeMes\(saved\.mesAno\)\)/);
});

test('folha nao apaga Mes/Ano quando o filtro retorna zero linhas', () => {
  const folhaMain = read('folha_pagamento/folha-main.js');
  const aplicarFiltros = folhaMain.slice(
    folhaMain.indexOf('async aplicarFiltrosComDadosFrescos()'),
    folhaMain.indexOf('/**\n     * 📋 Atualizar tabela de folhas')
  );

  assert.doesNotMatch(aplicarFiltros, /delete window\.folhaFiltros\.filtrosAtivos\.mesAno/);
  assert.doesNotMatch(aplicarFiltros, /mesInput\.value = ''/);
  assert.match(aplicarFiltros, /Mantendo seleção persistida/);
});

