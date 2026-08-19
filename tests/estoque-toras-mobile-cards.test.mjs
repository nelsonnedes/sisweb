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
    assert.match(html, /#tabelaProdutos\s*tbody\s*tr/, "Deve conter card para linhas da tabela de produtos/almoxarifado");
    assert.match(html, /data-label\]::before/, "Deve conter pseudo-elemento ::before para exibir rótulos");
});

test("Controle de Estoque de Toras - labels de cards mobile neutralizam position/width absolutos herdados de .mobile-cards", () => {
    const htmlPath = path.resolve("estoque.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    const beforeBlock = html.match(/td\[data-label\]::before[\s\S]*?\}/);
    assert.ok(beforeBlock, "Deve existir regra para td[data-label]::before no mobile");
    assert.match(beforeBlock[0], /position:\s*static\s*!important/, "Label deve ter position static para nao sobrepor o valor");
    assert.match(beforeBlock[0], /width:\s*auto\s*!important/, "Label deve ter width auto para fluir com flex e empurrar o valor para a direita");
    assert.match(beforeBlock[0], /top:\s*auto\s*!important/, "Label nao deve herdar top da regra .mobile-cards");
    assert.match(beforeBlock[0], /left:\s*auto\s*!important/, "Label nao deve herdar left da regra .mobile-cards");
    assert.match(beforeBlock[0], /transform:\s*none\s*!important/, "Label nao deve herdar transform de .mobile-cards");
    assert.match(beforeBlock[0], /padding-right:\s*0\s*!important/, "Label nao deve herdar padding-right de .mobile-cards");
});

test("Controle de Estoque de Toras - formularios de registro manual colapsados no mobile com opcao de expandir", () => {
    const htmlPath = path.resolve("estoque.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    const jsPath = path.resolve("estoque.js");
    const js = fs.readFileSync(jsPath, "utf8");

    assert.match(html, /class="mobile-collapse-header"/, "Deve existir header de colapso");
    assert.match(html, /class="mobile-collapse-body"/, "Deve existir body de colapso");
    assert.match(html, /id="entradaDadosToraBody"/, "Form 'Dados da Tora' deve ser colapsavel");
    assert.match(html, /id="baixaProdutoInlineBody"/, "Form 'Baixa de Produto' deve ser colapsavel");
    assert.match(html, /id="entradaProdutoBody"/, "Form 'Registrar Entrada de Produto' deve ser colapsavel");
    assert.match(html, /id="saidaToraManualBody"/, "Bloco 'Adicionar Tora Manual' da Saida deve ser colapsavel");
    assert.match(html, /\.mobile-collapse-body\s*\{\s*display:\s*none;\s*\}/s, "No mobile o body deve vir recolhido por padrao");
    assert.match(html, /\.mobile-collapse-body\.open\s*\{\s*display:\s*block;\s*\}/s, "No mobile .open deve expandir");
    assert.match(html, /@media\s*\(min-width:\s*769px\)[\s\S]*?\.mobile-collapse-body\s*\{\s*display:\s*block\s*!important;\s*\}/s, "No desktop o body deve ficar sempre expandido");
    assert.match(js, /function inicializarMobileCollapses/, "estoque.js deve ter inicializacao do colapso");
    assert.match(js, /function expandirFormSection/, "estoque.js deve ter funcao para expandir seccao");
    assert.match(js, /inicializarMobileCollapses\(\)/, "inicializarMobileCollapses deve ser chamado na inicializacao");
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

test("Controle de Estoque - Almoxarifado renderiza data-label em estoque_produtos.js", () => {
    const prodJsPath = path.resolve("estoque_produtos.js");
    const prodJs = fs.readFileSync(prodJsPath, "utf8");

    assert.match(prodJs, /function renderProdutoTd[\s\S]*?data-label=/, "renderProdutoTd deve injetar data-label");
    assert.match(prodJs, /data-label="Selecionar"/, "renderizarTabelaProdutos deve ter data-label Selecionar");
    assert.match(prodJs, /data-label="Ações"/, "renderizarTabelaProdutos deve ter data-label Ações");
});

