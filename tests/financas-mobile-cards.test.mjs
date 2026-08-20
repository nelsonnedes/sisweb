import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Sistema Financeiro - CSS responsivo de Cards Mobile em financas.html", () => {
    const htmlPath = path.resolve("financas.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    assert.match(html, /@media\s*\(max-width:\s*768px\)/, "Deve conter media query mobile max-width: 768px");
    assert.match(html, /#receberTable\s*>\s*tr/, "Deve conter card para linhas de Contas a Receber");
    assert.match(html, /#pagarTable\s*>\s*tr/, "Deve conter card para linhas de Contas a Pagar");
    assert.match(html, /#fluxoTable\s*>\s*tr/, "Deve conter card para linhas do Fluxo de Caixa");
    assert.match(html, /data-label\]::before/, "Deve conter pseudo-elemento ::before para exibir rótulos");
});

test("Sistema Financeiro - labels de cards mobile neutralizam position/width absolutos herdados de .mobile-cards", () => {
    const htmlPath = path.resolve("financas.html");
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

test("Sistema Financeiro - formularios de cadastro colapsados no mobile com opcao de expandir", () => {
    const htmlPath = path.resolve("financas.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    const jsPath = path.resolve("financas.js");
    const js = fs.readFileSync(jsPath, "utf8");

    assert.match(html, /class="mobile-collapse-header"/, "Deve existir header de colapso");
    assert.match(html, /class="mobile-collapse-body"/, "Deve existir body de colapso");
    assert.match(html, /id="finReceberBody"/, "Form 'Nova Conta a Receber' deve ser colapsavel");
    assert.match(html, /id="finPagarBody"/, "Form 'Nova Conta a Pagar' deve ser colapsavel");
    assert.match(html, /aria-controls="finReceberBody"/, "Header Receber deve apontar para finReceberBody");
    assert.match(html, /aria-controls="finPagarBody"/, "Header Pagar deve apontar para finPagarBody");
    assert.match(html, /\.mobile-collapse-body\s*\{\s*display:\s*none;\s*\}/s, "No mobile o body deve vir recolhido por padrao");
    assert.match(html, /\.mobile-collapse-body\.open\s*\{\s*display:\s*block;\s*\}/s, "No mobile .open deve expandir");
    assert.match(html, /@media\s*\(min-width:\s*769px\)[\s\S]*?\.mobile-collapse-body\s*\{\s*display:\s*block\s*!important;\s*\}/s, "No desktop o body deve ficar sempre expandido");
    assert.match(js, /function inicializarMobileCollapses/, "financas.js deve ter inicializacao do colapso");
    assert.match(js, /function expandirFormSection/, "financas.js deve ter funcao para expandir seccao");
    assert.match(js, /function toggleOffcanvas/, "financas.js deve ter funcao para abrir/fechar offcanvas");
    assert.match(js, /inicializarMobileCollapses\(\)/, "inicializarMobileCollapses deve ser chamado na inicializacao");
});

test("Sistema Financeiro - filtros de Receber e Pagar ficam em offcanvas no mobile", () => {
    const htmlPath = path.resolve("financas.html");
    const html = fs.readFileSync(htmlPath, "utf8");

    assert.match(html, /id="finFiltrosReceberDrawer"\s*class="offcanvas-drawer"/, "Deve existir drawer de filtros para Receber");
    assert.match(html, /id="finFiltrosPagarDrawer"\s*class="offcanvas-drawer"/, "Deve existir drawer de filtros para Pagar");
    assert.match(html, /onclick="toggleOffcanvas\('finFiltrosReceberDrawer'\)"/, "Botao Filtros de Receber deve chamar toggleOffcanvas");
    assert.match(html, /onclick="toggleOffcanvas\('finFiltrosPagarDrawer'\)"/, "Botao Filtros de Pagar deve chamar toggleOffcanvas");
    assert.match(html, /class="btn btn-info filtros-toggle-btn"/, "Botao Filtros deve ter classe filtros-toggle-btn");
    assert.match(html, /@media\s*\(min-width:\s*769px\)[\s\S]*?\.filtros-toggle-btn\s*\{\s*display:\s*none\s*!important;\s*\}/s, "Botao Filtros deve ficar oculto no desktop");
});

test("Sistema Financeiro - Renderizadores em financas.js injetam atributos data-label para cards mobile", () => {
    const jsPath = path.resolve("financas.js");
    const js = fs.readFileSync(jsPath, "utf8");

    assert.match(js, /function carregarTabelaReceber[\s\S]*?data-label=/, "carregarTabelaReceber deve injetar data-label");
    assert.match(js, /function carregarTabelaPagar[\s\S]*?data-label=/, "carregarTabelaPagar deve injetar data-label");
    assert.match(js, /function gerarTabelaFluxo[\s\S]*?data-label="Data"/, "gerarTabelaFluxo deve injetar data-label=\"Data\"");
    assert.match(js, /data-label="Selecionar"/, "deve ter data-label Selecionar (checkbox)");
    assert.match(js, /data-label="Ações"/, "deve ter data-label Ações (coluna de acoes)");
    assert.match(js, /labelMap\[colKey\]\s*\|\|\s*colKey/, "data-label deve derivar do labelMap");
});

test("Sistema Financeiro - auto-expand do formulario em modo edicao e ao limpar", () => {
    const jsPath = path.resolve("financas.js");
    const js = fs.readFileSync(jsPath, "utf8");

    assert.match(js, /function editarConta[\s\S]*?expandirFormSection/, "editarConta deve expandir a secao do form");
    assert.match(js, /function limparFormulario[\s\S]*?expandirFormSection/, "limparFormulario deve expandir a secao do form");
});

test("Sistema Financeiro - service worker com nova APP_VERSION para invalidar cache", () => {
    const swPath = path.resolve("sw.js");
    const sw = fs.readFileSync(swPath, "utf8");

    assert.match(sw, /const APP_VERSION = '2026-08-19-financas-mobile-v1'/, "APP_VERSION deve refletir a entrega mobile");
});