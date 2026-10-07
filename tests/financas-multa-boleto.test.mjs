import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('boleto com juros: multaTaxa aceita na criacao e edicao (server)', () => {
  const srv = read('functions/finance-functions.js');
  assert.ok(/'multaTaxa'/.test(srv), 'multaTaxa nas allowlists');
  const creatIdx = srv.indexOf('CREATABLE_MANUAL_ACCOUNT_FIELDS');
  const creatBlock = srv.slice(creatIdx, srv.indexOf(']);', creatIdx));
  assert.ok(/'multaTaxa'/.test(creatBlock), 'multaTaxa na criacao');
  const editIdx = srv.indexOf('EDITABLE_ACCOUNT_FIELDS');
  const editBlock = srv.slice(editIdx, srv.indexOf(']);', editIdx));
  assert.ok(/'multaTaxa'/.test(editBlock), 'multaTaxa na edicao');
  assert.ok(/multaTaxa: parseInterestRate\(source\.multaTaxa\)/.test(srv), 'multaTaxa normalizada na conta canonica');
});

test('save receber/pagar: trava anti-duplo + overlay + botao', () => {
  const js = read('financas.js');
  assert.ok(/window\.__financeSaving = true/.test(js), 'trava setada');
  assert.ok(/mostrarLoading\(true, 'Salvando conta\.\.\.'\)/.test(js), 'overlay ao salvar');
  assert.ok(/mostrarLoading\(false\)/.test(js), 'overlay escondido');
  assert.ok(/setSubmitButtonLoading\(rsBtn, true, 'Salvando\.\.\.'\)/.test(js) || /setSubmitButtonLoading\(rsOk, false\)/.test(js), 'botao receber com loading');
  assert.ok(/Salvamento j\u00e1 em andamento/.test(js), 'aviso em duplo-clique');
});
