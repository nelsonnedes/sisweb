import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const columns = fs.readFileSync('modules/core/romaneio-list-columns.js', 'utf8');
const css = fs.readFileSync('romaneio-comum.css', 'utf8');

test('romaneios: larguras normalizadas para a largura real do container', () => {
  assert.match(columns, /function fitWidthsToContainer\(table, clean\)/);
  assert.match(columns, /var target = Math\.round\(Math\.max\(minTotal, available\)\)/);
  assert.match(columns, /MIN_ACTIONS_WIDTH = 180/);
  assert.match(columns, /__rlcFitRetry/);
  assert.match(columns, /table\.__rlcFitTries/);
  assert.match(columns, /ensureHostObserver/);
  assert.match(columns, /\(max-width: 768px\)'\)\.matches\) return;/, 'mobile não aplica larguras inline');
});

test('romaneios: contrato PES alinhado às 6 colunas reais (sem deslocar Ações)', () => {
  assert.match(
    columns,
    /pes: \['Data', 'Cliente', 'Espécies', 'Volume \(m³\)', 'Valor Total', 'Ações'\]/,
  );
});

test('Configurar Impressão: cores por token (claro/escuro), sem slate fixo', () => {
  assert.match(css, /\.romaneio-print-config-trigger[\s\S]*?color: var\(--sw-text-1\) !important;/);
  assert.match(css, /\.romaneio-print-config-trigger:hover[\s\S]*?color: var\(--sw-brand\) !important;/);
  assert.doesNotMatch(css, /\.romaneio-print-config-trigger[\s\S]{0,300}#334155/);
});
