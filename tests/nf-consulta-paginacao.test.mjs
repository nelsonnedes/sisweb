import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Paginação da aba Consulta (notas-fiscais.html): opções 10/25/50/100,
// preferência em localStorage por tenant+usuário, reset de página ao
// filtrar — mesmo padrão do estoque (estoque.js renderizarPaginacaoPadrao).
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

test('container de paginação existe após a tabela', () => {
  assert.match(html, /<tbody id="notasTable">/, 'tbody mantido');
  assert.match(html, /<div id="paginacaoConsultaNF" class="nf-pagination-bar"><\/div>/, 'container após a tabela');
});

test('opções 10/25/50/100 com default 25 e preferência por tenant+usuário', () => {
  assert.match(html, /NF_CONSULTA_PAGE_SIZE_OPTIONS = \[10, 25, 50, 100\]/, 'mesmas opções do estoque');
  assert.match(html, /NF_CONSULTA_PAGE_SIZE_DEFAULT = 25/, 'default 25');
  assert.match(html, /nf_consulta_\$\{tid\}_\$\{u\}_items_per_page/, 'chave por tenant+usuário');
});

test('filtros/paginação resetam para a página 1; troca de página preserva filtros', () => {
  assert.match(html, /async function consultarNotas\(resetPage = true\)/, 'filtros resetam (default)');
  assert.match(html, /if \(resetPage\) __nfConsultaPagina = 1;/, 'reset explícito');
  assert.match(html, /function nfConsultaMudarPagina\(page\)/, 'navegação só fatia o cache');
  assert.match(html, /__nfConsultaNotasCache\.slice\(inicio, inicio \+ size\)/, 'fatia local, sem refetch');
});

test('seletor Itens por página + botões <<< < 1..N > >>> + contador', () => {
  assert.match(html, /Itens por página:/, 'rótulo igual ao estoque');
  assert.match(html, /onchange="nfConsultaSetPageSize\(this\.value\)"/, 'troca re-renderiza pág. 1');
  assert.match(html, /addBtn\('<<<', 1, paginaAtual === 1\)/, 'primeira página');
  assert.match(html, /addBtn\('>>>', totalPaginas, paginaAtual === totalPaginas\)/, 'última página');
  assert.match(html, /Pág\. \$\{paginaAtual\}\/\$\{totalPaginas\} · \$\{totalItems\} nota\(s\)/, 'contador');
});

test('CSS usa tokens claro/escuro e não quebra o padrão 38px dos filtros', () => {
  assert.match(html, /\.nf-pagination-bar \{/, 'barra dedicada');
  assert.match(html, /background: var\(--sw-surface\)/, 'fundo por token');
  assert.match(html, /color: var\(--sw-text-1\)/, 'texto por token');
  assert.match(html, /background: var\(--sw-brand\)/, 'página ativa na cor da marca');
  assert.match(html, /#consulta \.form-group input,/, 'escopo 38px dos filtros intacto');
});

test('lista vazia mantém a barra coerente (sem crash)', () => {
  assert.match(html, /renderizarPaginacaoConsultaNF\(__nfConsultaNotasCache\.length, __nfConsultaPagina, nfConsultaPageSize\(\)\)/, 'vazio re-renderiza a barra');
  assert.match(html, /if \(!totalItems\) return;/, 'vazio limpa sem botões');
});
