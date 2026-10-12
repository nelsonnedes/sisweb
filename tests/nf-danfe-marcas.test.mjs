import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Marca d'água do DANFE: cancelada → "CANCELADA"; não autorizadas → sem valor fiscal.
const danfe = fs.readFileSync('nf-danfe.js', 'utf8');

test('NF-e cancelada usa marca CANCELADA (nunca "não autorizada")', () => {
  assert.match(danfe, /const cancelada = status === 'cancelada'/, 'status cancelada detectado');
  assert.match(danfe, /'CANCELADA' : 'SEM VALOR FISCAL'/, 'marca principal condicional');
  assert.match(danfe, /NF-e CANCELADA NA SEFAZ/, 'linha complementar de cancelamento');
  assert.match(danfe, /if \(cancelada \|\| naoAutorizada\)/, 'cancelada entra no ramo da marca');
});

test('não autorizadas mantêm SEM VALOR FISCAL / NÃO AUTORIZADA', () => {
  assert.match(danfe, /const naoAutorizada = !\(status === 'autorizada' && nProt\)/, 'regra mantida');
  assert.match(danfe, /'NÃO AUTORIZADA PELA SEFAZ'/, 'texto mantido');
});
