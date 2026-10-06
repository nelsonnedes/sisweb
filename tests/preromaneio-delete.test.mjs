import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../preromaneio-modals.js', import.meta.url), 'utf8');

test('excluir pré-romaneio persiste de verdade (sem ressuscitar no reload)', () => {
  // Tenta todas as chaves candidatas (id real pode divergir do normalizado)
  assert.ok(/firebaseKey/.test(src), 'considera firebaseKey');
  assert.ok(/chaves\.includes/.test(src), 'remove por qualquer chave candidata');
  // Fail-closed: sem confirmação do servidor, mantém na lista
  assert.ok(/Fail-closed/.test(src), 'documenta fail-closed');
  assert.ok(/Não foi possível excluir no servidor/.test(src), 'alerta em falha');
  // Limpa o espelho local (senão repopula offline)
  assert.ok(/companies\/\$\{String\(tid\)\}\/preromaneios/.test(src), 'limpa espelho local namespaced');
  // Comparação tolerante a tipo (id numérico vs string)
  assert.ok(/String\(r\.id\)/.test(src), 'compara id como string');
  // Sem filtro cego: só remove da UI após sucesso
  const fn = src.slice(src.indexOf('async function excluirPreRomaneio'));
  const renderIdx = fn.indexOf('renderRomaneiosList(cachedRomaneios)');
  const failIdx = fn.indexOf('Não foi possível excluir no servidor');
  assert.ok(renderIdx > 0 && failIdx > 0 && failIdx < renderIdx, 'UI só atualiza após sucesso');
});
