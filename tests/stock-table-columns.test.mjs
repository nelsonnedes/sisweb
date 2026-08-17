import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Módulo de Colunas do Estoque (stock-table-columns.js)', () => {
    const code = fs.readFileSync('modules/core/stock-table-columns.js', 'utf8');

    test('declara a API global StockTableColumns', () => {
        assert.match(code, /window\.StockTableColumns\s*=\s*\{/);
        assert.match(code, /init:/);
        assert.match(code, /initTable:/);
        assert.match(code, /resetWidths:/);
    });

    test('suporta as 6 tabelas principais de estoque', () => {
        assert.match(code, /tabelaEntrada/);
        assert.match(code, /tabelaSaidaToras/);
        assert.match(code, /tabelaEstoque/);
        assert.match(code, /tabelaMovimentacoes/);
        assert.match(code, /tabelaProdutos/);
        assert.match(code, /tabelaTorasDisponiveis/);
    });

    test('injeta estilos de redimensionamento e botões de ação', () => {
        assert.match(code, /stock-resizer/);
        assert.match(code, /stock-btn-action/);
        assert.match(code, /stock-summary-grid/);
    });
});
