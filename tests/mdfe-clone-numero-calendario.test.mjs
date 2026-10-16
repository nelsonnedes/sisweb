import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');

function loadPagina() {
  const els = {};
  const avisos = [];
  const context = {
    window: {},
    document: {
      addEventListener() {},
      getElementById: (id) => els[id] || (els[id] = {
        value: '',
        classList: { add() {}, remove() {} },
        getAttribute: () => '',
      }),
      querySelectorAll: () => [],
    },
    notifyUser: (msg) => avisos.push(String(msg)),
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(js, context);
  return { context, els, avisos };
}

test('clonar avança para o próximo número (não reutiliza o da origem)', () => {
  const { context, els, avisos } = loadPagina();
  vm.runInNewContext(`
    mdfes.push({ id: 'm20', numero: '000000020', status: 'autorizado', veiculo: {}, condutor: {}, documentos: [] });
    numeroAtualMdfe = 5;
    clonarMdfe('m20');
  `, context);
  assert.equal(els.mdfeNumero.value, '000000021', 'recalcula: ignora contador desatualizado');
  assert.ok(avisos.some((m) => m.includes('clonado')), 'avisa que é um novo documento');
});

test('editar rascunho MANTÉM o número (é o mesmo documento)', () => {
  const { context, els, avisos } = loadPagina();
  vm.runInNewContext(`
    mdfes.push({ id: 'r19', numero: '000000019', status: 'rascunho', veiculo: {}, condutor: {}, documentos: [] });
    numeroAtualMdfe = 21;
    editarMdfe('r19');
  `, context);
  assert.equal(els.mdfeNumero.value, '000000019', 'rascunho conserva o próprio número');
  assert.ok(avisos.some((m) => m.includes('edição')), 'avisa que carregou para edição');
});

test('calendário de emissão: blur ao escolher (fecha o picker)', () => {
  assert.match(
    js,
    /emissaoInput\.addEventListener\('change', function\(\) \{ try \{ emissaoInput\.blur\(\); \} catch \(\_\) \{\} \}\);/,
  );
});
