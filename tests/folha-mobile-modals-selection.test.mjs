import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync('folha_pagamento/folha.css', 'utf8');
const funcionarios = readFileSync('folha_pagamento/folha-funcionarios.js', 'utf8');
const bancoHoras = readFileSync('folha_pagamento/banco-horas-ui.js', 'utf8');

test('modais de listas da Folha mantêm cards e rolagem interna no mobile', () => {
  assert.match(css, /#funcionariosListModal \.table-container[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#cargosListModal \.table-container[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#folhasFechadasModal \.table-container[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#funcionariosListModal \.table-container[\s\S]*flex:\s*1 1 auto\s*!important/);
  assert.match(css, /#funcionariosListModal \.paginacao-navegacao \.btn-paginacao[\s\S]*min-width:\s*36px\s*!important/);
  assert.match(css, /#funcionariosListModal \.modal-paginacao[\s\S]*display:\s*grid\s*!important/);
  assert.match(css, /#funcionariosListModal \.modal-paginacao[\s\S]*flex:\s*0 0 auto\s*!important/);
  assert.match(css, /#funcionariosListModal \.paginacao-navegacao[\s\S]*flex-wrap:\s*nowrap\s*!important/);
  assert.match(css, /#funcionariosListModal \.table-container[\s\S]*min-height:\s*80px\s*!important/);
  assert.match(css, /#cargosListModal \.table-container[\s\S]*min-height:\s*80px\s*!important/);
  assert.match(css, /#folhasFechadasModal \.table-container[\s\S]*min-height:\s*80px\s*!important/);
  assert.match(css, /#funcionariosListModal \.funcionarios-list-table tbody tr[\s\S]*display:\s*block\s*!important/);
  assert.match(css, /#funcionariosListModal \.funcionarios-list-table tbody tr[\s\S]*height:\s*auto\s*!important/);
  assert.match(css, /#funcionariosListModal \.funcionarios-list-table tbody td[\s\S]*height:\s*auto\s*!important/);
  assert.match(css, /td\[data-label="Status"\] \.badge-status[\s\S]*width:\s*fit-content\s*!important/);
});

test('modais longos da Folha respeitam a altura da viewport mobile', () => {
  assert.match(css, /#relatorioModal \.modal-content[\s\S]*height:\s*calc\(100dvh - 16px\)\s*!important/);
  assert.match(css, /#resumoFolhaModal \.modal-content[\s\S]*height:\s*calc\(100dvh - 16px\)\s*!important/);
  assert.match(css, /#bh-modalGerenciar \.modal-body[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#relatorioModal \.modal-footer[\s\S]*flex:\s*0 0 auto\s*!important/);
});

test('gerenciamento do Banco de Horas usa data-label no padrão tabela para cards', () => {
  for (const label of ['Data', 'Horas', 'Vence', 'Observação', 'Ações']) {
    assert.match(bancoHoras, new RegExp(`data-label="${label}"`), `Banco de Horas deve rotular ${label}`);
  }
  assert.match(css, /#bh-modalGerenciar \.table-responsive\.mobile-cards tbody td::before[\s\S]*position:\s*static\s*!important/);
  assert.match(css, /#bh-modalGerenciar \.table-responsive\.mobile-cards tbody td\.actions-cell[\s\S]*min-width:\s*36px\s*!important/);
  assert.match(css, /#bh-modalGerenciar #bh-formGerenciar[\s\S]*display:\s*flex\s*!important/);
});

test('seleção de funcionário preserva o campo-alvo também quando o modal está sobre outro modal', () => {
  assert.match(funcionarios, /if \(this\.targetField\)[\s\S]*const campoTarget = document\.getElementById\(this\.targetField\)/);
  assert.match(funcionarios, /campoAtivo\.value = funcionario\.nome/);
  assert.match(funcionarios, /campoAtivo\.dataset\.funcionarioId = funcionario\.id/);
  assert.match(funcionarios, /this\.closeFuncionariosListModal\(\)/);
  assert.match(funcionarios, /'resumoFuncionario'/);
});
