import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Onda 1 (auditoria A2/A6/A19/A18/A20/A8/A1): bloqueantes de baixo acoplamento.
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', tablesSrc + '\n' + validatorSrc + '; return window.NFValidator;')({ window: {} }, console);
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

function destBase(over = {}) {
  return {
    nome: 'CLIENTE TESTE', cnpj: '11222333000181',
    endereco: { logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', uf: 'SP', cep: '01001000', codigoMunicipio: '3550308' },
    ...over,
  };
}

test('A2: nome do destinatário sem sufixo de documento (dataset/cadastro)', () => {
  assert.ok(html.includes('nfNomeDestinatarioLimpo'), 'helper de limpeza existe');
  assert.ok(html.includes('opt.dataset.nome'), 'option carrega nome puro');
  assert.ok(!/nome:\s+opt\.text,/.test(html), 'montarDestFromForm não usa opt.text puro');
});

test('A6: placeholders fictícios barrados (N/A, S/N, CEP zerado)', () => {
  const r1 = V.validarDestinatario(destBase({ endereco: { ...destBase().endereco, logradouro: 'N/A' } }));
  assert.equal(r1.valid, false);
  assert.match(r1.errors.join('|'), /preencha o cadastro/);
  const r2 = V.validarDestinatario(destBase({ endereco: { ...destBase().endereco, cep: '00000000' } }));
  assert.match(r2.errors.join('|'), /fictício/);
  const r3 = V.validarDestinatario(destBase({ nome: '  ' }));
  assert.match(r3.errors.join('|'), /preencha o cadastro|obrigatório/);
  assert.equal(V.validarDestinatario(destBase()).valid, true);
});

test('A19: filtro da Consulta lista erro_envio', () => {
  assert.match(html, /<option value="erro_envio">Erro de envio<\/option>/);
});

test('A18: texto IBPT não promete <vTotTrib>', () => {
  assert.ok(!html.includes('aparecem em "Dados Adicionais" e no <vTotTrib>'), 'texto antigo removido');
  assert.match(html, /anti-cStat-685/);
});

test('A20: documento de transportadora inválido barra na etapa', () => {
  assert.match(html, /Documento do transportador inválido.*CNPJ \(14 dígitos\) ou CPF \(11 dígitos\)/);
});

test('A8: natureza entrada/saída concilia tpNF (com confirmação)', () => {
  assert.match(html, /Tipo de operação divergente/);
  assert.match(html, /confirmDialog/);
});

test('A1: edição de CSOSN avisa quando a natureza prevalece', () => {
  assert.match(html, /CSOSN\/CST ajustado para.*natureza da operação prevalece/);
});
