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

test('estado fiscal do objeto prevalece sobre o XML (cancelada não vira autorizada)', () => {
  // O nfeProc persistido sempre tem protNFe de AUTORIZAÇÃO; sem a trava, o merge
  // marcava status='autorizada' e o carimbo sumia (bug reportado).
  assert.match(danfe, /status: original\.status \|\| parsed\.status \|\| 'rascunho'/, 'merge preserva status do objeto');
});
