import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// NFDashboard: agregação pura testada por execução; DOM só dentro das funções.
const src = fs.readFileSync('nf-dashboard.js', 'utf8');
const D = new Function('window', 'document', 'Chart', 'notifyUser', src + '; return window.NFDashboard;')({ window: {} }, undefined, undefined, undefined);

const notas = [
  { numero: 1, dataEmissao: '2026-10-10', status: 'autorizada', dest: { nome: 'A', cnpj: '11111111111111' }, total: { vNF: 100 }, chave: 'C1',
    det: [{ imposto: { icms: { vICMS: 12 }, ipi: { vIPI: 5 }, pis: { vPIS: 1 }, cofins: { vCOFINS: 2 } } }] },
  { numero: 2, dataEmissao: '2026-10-11', status: 'autorizada', dest: { nome: 'B', cnpj: '22222222222222' }, total: { vNF: 200 }, chave: 'C2', det: [] },
  { numero: 3, dataEmissao: '2026-10-11', status: 'rejeitada', dest: { nome: 'A' }, total: { vNF: 50 }, chave: 'C3', det: [] },
  { numero: 4, dataEmissao: '2026-09-01', status: 'rascunho', dest: { nome: 'C' }, total: { vNF: 10 }, chave: '', det: [] },
];

test('filtrarNotas por status e período', () => {
  assert.equal(D.filtrarNotas(notas, { status: 'autorizada' }).length, 2);
  assert.equal(D.filtrarNotas(notas, { ini: '2026-10-11', fim: '2026-10-11' }).length, 2);
  assert.equal(D.filtrarNotas(notas, {}).length, 4);
});

test('agregarNotas: contagens, totais, ticket, dia, top, impostos', () => {
  const ag = D.agregarNotas(notas);
  assert.equal(ag.qtd, 4);
  assert.equal(ag.porStatus.autorizada, 2);
  assert.equal(ag.qtdAutorizadas, 2);
  assert.equal(ag.vAutorizado, 300);
  assert.equal(ag.ticketMedio, 150);
  assert.deepEqual(ag.porDia, [{ dia: '2026-10-10', v: 100 }, { dia: '2026-10-11', v: 200 }]);
  assert.equal(ag.topDest[0].nome, 'B');
  assert.equal(ag.topDest[0].v, 200);
  assert.deepEqual(ag.impostos, { icms: 12, ipi: 5, pis: 1, cofins: 2 });
});

test('gerarCSV com BOM, header e escape de aspas', () => {
  const csv = D.gerarCSV([{ numero: 7, dataEmissao: '2026-10-12', status: 'autorizada',
    dest: { nome: 'X "Y" Ltda', cnpj: '1' }, total: { vNF: 13.35 }, chave: 'K' }]);
  assert.ok(csv.startsWith('﻿'), 'BOM presente');
  assert.match(csv, /"Número";"Data";"Destinatário"/, 'header pt-BR com ;');
  assert.match(csv, /"000000007";"2026-10-12";"X ""Y"" Ltda"/, 'escape de aspas + zero-pad');
  assert.match(csv, /"13,35"/, 'decimal com vírgula');
});

test('DANFE: chave em linha única (sem largura que quebrava)', () => {
  const danfe = fs.readFileSync('nf-danfe.js', 'utf8');
  const chamada = danfe.match(/doc\.text\(chaveFormatada \|\| 'Chave ainda não gerada'[^;]*;/)[0];
  assert.doesNotMatch(chamada, /maxWidth/, 'chamada da chave sem maxWidth');
  assert.match(danfe, /let chaveSize = 5\.5/, 'fonte calculada para caber');
});

test('abrirDANFENota tem loader, await e trata pop-up bloqueado', () => {
  const html = fs.readFileSync('notas-fiscais.html', 'utf8');
  const fn = html.split('async function abrirDANFENota')[1].split('Baixar XML autorizado')[0];
  assert.match(fn, /fa-spinner fa-spin/, 'spinner no botão');
  assert.match(fn, /await window\.NFDanfe\.abrirDANFE\(nf\)/, 'await (erros não escapam)');
  assert.match(fn, /bloqueou a nova aba/, 'orienta sobre pop-up');
  assert.match(fn, /finally/, 'botão sempre restaurado');
});
