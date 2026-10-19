import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('js/produtos-fiscais.js', 'utf8');
const html = fs.readFileSync('produtos-fiscais.html', 'utf8');
const romCss = fs.readFileSync('romaneio-comum.css', 'utf8');

test('produtos fiscais: paginação no padrão da Consulta de NF-e', () => {
  assert.match(src, /PF_PAGE_SIZE_OPTIONS = \[10, 25, 50, 100\]/);
  assert.match(src, /PF_PAGE_SIZE_DEFAULT = 25/);
  assert.match(src, /pf_produtos_.*_items_per_page/, 'preferência por tenant+usuário');
  assert.match(src, /<<</);
  assert.match(src, />>>/);
  assert.match(html, /id="pfPagination" class="nf-pagination-bar"/);
  assert.match(html, /\.nf-pagination-bar \.pagination-size-control/);
});

test('produtos fiscais: busca cobre código e campos aninhados/fiscal e preço', () => {
  assert.match(src, /p\.codigo, p\.cod, p\.code, p\.codigoProduto/);
  assert.match(src, /p\.ncm, f\.ncm/);
  assert.match(src, /p\.cfopPadrao, p\.cfop, f\.cfop/);
  assert.match(src, /p\.unidade, f\.unidade/);
  assert.match(src, /preco, money\(preco\)/);
  assert.match(src, /codeMatches\(a, qn\)/, 'código exato priorizado');
});

test('produtos fiscais: código automático ao salvar (sequencial e sem colisão)', () => {
  assert.match(src, /function nextCodigo\(\)/);
  assert.match(src, /setVal\('pfCodigo', item \? \(item\.codigo \|\| ''\) : nextCodigo\(\)\)/);
  assert.match(src, /if \(!codigo\) codigo = nextCodigo\(\)/);
  assert.match(html, /Código \(automático\)/);
});

test('modal Lista de Romaneios: largura estável durante o carregamento', () => {
  assert.match(romCss, /#listaModal \.modal-content,[\s\S]*?min-width: min\(95vw, 1200px\) !important/);
  assert.match(romCss, /:not\(\.rlc-fixed\)/);
  assert.match(romCss, /min-width: 100% !important/);
});
