import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const columns = fs.readFileSync('modules/core/romaneio-list-columns.js', 'utf8');
const css = fs.readFileSync('romaneio-comum.css', 'utf8');

test('romaneios: larguras normalizadas para a largura real do container', () => {
  assert.match(columns, /function fitWidthsToContainer\(table, clean\)/);
  assert.match(columns, /var target = Math\.max\(minTotal, Math\.min\(total, available - 2\)\)/);
  assert.match(columns, /__rlcFitRetry/);
  assert.match(columns, /table\.__rlcFitTries/);
  assert.match(columns, /rectW - 20/);
  assert.match(columns, /ensureHostObserver/);
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
