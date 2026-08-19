import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Controle de Estoque de Toras - CSS responsivo de Cards Mobile em estoque.html", () => {
    const htmlPath = path.resolve("estoque.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    assert.match(html, /@media\s*\(max-width:\s*768px\)/, "Deve conter media query mobile max-width: 768px");
    assert.match(html, /#tabelaEntrada\s*tbody\s*tr/, "Deve conter card para linhas da tabela de entrada");
    assert.match(html, /#tabelaSaidaToras\s*tbody\s*tr/, "Deve conter card para linhas da tabela de saída");
    assert.match(html, /#tabelaEstoque\s*tbody\s*tr/, "Deve conter card para linhas da tabela de consulta");
    assert.match(html, /#tabelaMovimentacoes\s*tbody\s*tr/, "Deve conter card para linhas da tabela de movimentações");
    assert.match(html, /#tabelaTorasDisponiveis\s*tbody\s*tr/, "Deve conter card para linhas do modal de toras");
    assert.match(html, /data-label\]::before/, "Deve conter pseudo-elemento ::before para exibir rótulos");
});

test("Controle de Estoque de Toras - Renderizadores em estoque.js injetam atributos data-label para cards mobile", () => {
    const jsPath = path.resolve("estoque.js");
    const js = fs.readFileSync(jsPath, "utf8");

    assert.match(js, /function renderSaidaToraTd[\s\S]*?data-label=/, "renderSaidaToraTd deve injetar data-label");
    assert.match(js, /function renderConsultaEstoqueTd[\s\S]*?data-label=/, "renderConsultaEstoqueTd deve injetar data-label");
    assert.match(js, /function renderMovimentacaoTd[\s\S]*?data-label=/, "renderMovimentacaoTd deve injetar data-label");
    assert.match(js, /function carregarTorasDisponiveis[\s\S]*?data-label="Plaqueta"/, "carregarTorasDisponiveis deve injetar data-label=\"Plaqueta\"");
    assert.match(js, /function renderizarResultadosPlaquetaSaida[\s\S]*?data-label="Plaqueta"/, "renderizarResultadosPlaquetaSaida deve injetar data-label=\"Plaqueta\"");
    assert.match(js, /function renderizarTabelaRastreabilidade[\s\S]*?data-label="Plaqueta"/, "renderizarTabelaRastreabilidade deve injetar data-label=\"Plaqueta\"");
    assert.match(js, /function renderizarTabelaEntrada[\s\S]*?data-label="Plaqueta"/, "renderizarTabelaEntrada deve injetar data-label=\"Plaqueta\"");
});
