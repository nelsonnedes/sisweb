import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// saveData canônico tem 2 args (key, data). Chamadas com 3 args descartam o
// payload silenciosamente. saveToFirebase(path, key, data) tem 3 args em todas
// as implementações e é a via granular correta.
test('nenhum saveData 3-args contra singletons de 2 args', () => {
  const buggy = [
    ['preromaneio-modals.js', 'svc.saveData(basePath, String(id), payload)'],
    ['romaneios-client-save-fix.js', 'saveData(pathBase, String(client.id), payload)'],
    ['romaneios-client-save-fix.js', 'saveData(path, String(c.id), payload)'],
    ['js/client.js', "saveData('clients', String(finalId), dataToSave)"],
    ['js/fornecedor.js', "saveData('fornecedores', String(finalId), dataToSave)"],
    ['fornecedor-modals.js', 'saveData(basePath, String(id), fornecedorData)'],
    ['fornecedor-modals.js', 'saveData(basePath, String(newId), fornecedorData)'],
    ['fornecedor-modals.js', 'saveData(basePath, String(fornecedorId), null)'],
    ['romaneio-manager.js', 'saveData(this.collectionKey, String(id), record)']
  ];
  for (const [file, snippet] of buggy) {
    assert.ok(!read(file).includes(snippet), `${file} ainda contém chamada 3-args: ${snippet}`);
  }
});

test('vias corretas presentes (saveToFirebase 3-arg ou saveData caminho completo)', () => {
  const expected = [
    ['preromaneio-modals.js', 'svc.saveToFirebase(basePath, String(id), payload)'],
    ['js/client.js', 'saveToFirebase(\'clients\', String(finalId), dataToSave)'],
    ['js/fornecedor.js', 'saveToFirebase(\'fornecedores\', String(finalId), dataToSave)'],
    ['fornecedor-modals.js', 'saveToFirebase(basePath, String(id), fornecedorData)'],
    ['romaneio-manager.js', 'saveToFirebase(this.collectionKey, String(id), record']
  ];
  for (const [file, snippet] of expected) {
    assert.ok(read(file).includes(snippet), `${file} deve usar a via granular: ${snippet}`);
  }
});

test('fornecedor tem checagem de duplicata por nome', () => {
  assert.ok(
    read('fornecedor-modals.js').includes('fetchFornecedores({ force: true })'),
    'fornecedor-modals.js deve checar duplicata contra lista fresca'
  );
  assert.ok(
    read('js/fornecedor.js').includes('Fornecedor já cadastrado'),
    'js/fornecedor.js deve bloquear duplicata com aviso'
  );
});
