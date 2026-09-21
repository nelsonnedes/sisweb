import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
    return fs.readFileSync(path.resolve(rel), 'utf8');
}

test('Mobile print: motor compartilhado tem Voltar sem prender em about:blank', () => {
    const helper = read('commerce-pdf-share.js');
    // Contrato preservado (PWA/desktop): janela pré-aberta + fallback iframe
    assert.match(helper, /options\.targetWindow && options\.targetWindow\.closed !== true/);
    assert.match(helper, /const target = suppliedTarget \|\| window\.open/);
    // Barra Voltar visível na tela e oculta no print, sem ser engolida pelo button{display:none}
    assert.match(helper, /sisweb-print-back/);
    assert.match(helper, /button:not\(\.sisweb-print-back-btn\)/);
    assert.match(helper, /@media print[\s\S]*?\.sisweb-print-back[\s\S]*?display:\s*none/);
    assert.match(helper, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(helper, /window\.close\(\).*history\.back|history\.back.*window\.close/s);
    // Trigger robusto além do onload único
    assert.match(helper, /fonts\.ready/);
});

test('Mobile print: TL/Tora canônico valida alvo parcial e injeta Voltar', () => {
    const js = read('modules/reports/imprimir-romaneio.js');
    assert.match(js, /function abrirJanelaImpressao\(html, romaneioId/);
    assert.match(js, /janelaImpressao\.closed === true/);
    assert.match(js, /ensureRomaneioPrintAux/);
    assert.match(js, /meta[\s\S]*?viewport/);
    assert.match(js, /sisweb-print-back/);
    assert.match(js, /fonts\.ready/);
    // Não fecha a janela imediatamente após print (mata share-sheet mobile)
    assert.doesNotMatch(js, /target\.print\(\);\s*\n?\s*target\.close\(\)/);
    // Config de colunas preservada (anti-regressão)
    assert.match(js, /RomaneioPrintConfig\.applyToPrintDocument\(janelaImpressao\.document/);
});

test('Mobile print: PCT abre janela DEPOIS dos dados (sem blank antecipado)', () => {
    const js = read('modules/romaneiopct/imprimir-romaneio-pct.js');
    const openIdx = js.indexOf("window.open('', '_blank')");
    const contentIdx = js.indexOf('gerarConteudoImpressao(romaneio, company, tipo)');
    assert.ok(openIdx > 0 && contentIdx > 0, 'ambos os marcos devem existir');
    assert.ok(openIdx > contentIdx, 'window.open deve ocorrer após gerarConteudoImpressao');
    assert.match(js, /ensurePctPrintAux/);
    assert.match(js, /sisweb-print-back/);
    assert.match(js, /fonts\.ready/);
    assert.match(js, /RomaneioPrintConfig\.applyToPrintDocument\(printWindow\.document, 'PCT'\)/);
});

test('Mobile print: fallback do manager tem HTML completo com Voltar', () => {
    const js = read('romaneio-manager.js');
    assert.match(js, /<!doctype html>/i);
    assert.match(js, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(js, /sisweb-print-back/);
    assert.match(js, /history\.back/);
    assert.match(js, /fonts\.ready/);
    assert.match(js, /window\.ImprimirRomaneio\.imprimirRomaneioTora/);
});

test('Mobile print fase 2: PES abre janela depois do conteúdo com Voltar', () => {
    const html = read('romaneiopes.html');
    assert.doesNotMatch(html, /const printWindow = window\.open\('', '_blank'\);\n            const printContent = `/);
    const openIdx = html.indexOf('window.open');
    const contentIdx = html.indexOf('const printContent = `');
    assert.ok(openIdx > 0 && contentIdx > 0, 'ambos os marcos devem existir');
    assert.ok(openIdx > contentIdx, 'PES: window.open deve ocorrer após printContent');
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(html, /history\.back/);
    assert.match(html, /fonts\.ready/);
    assert.match(html, /RomaneioPrintConfig\.applyToPrintDocument\(printWindow\.document, 'PES'\)/);
    assert.match(html, /printWindow\.onload = function/);
    assert.match(html, /&#8592; Voltar/);
    const pesVoltarIdx = html.indexOf('&#8592; Voltar');
    const pesImprimirIdx = html.indexOf('onclick="window.print()">Imprimir');
    assert.ok(pesVoltarIdx > 0 && pesImprimirIdx > 0 && pesVoltarIdx < pesImprimirIdx, 'PES: Voltar vem antes de Imprimir, igual aos demais romaneios');
    assert.match(html, /\.print-actions\s*\{[^}]*justify-content:\s*space-between/, 'PES: barra com Voltar à esquerda e Imprimir à direita, igual aos demais');
});

test('Mobile print fase 2: company usa helper canônico com fallback completo', () => {
    const html = read('company.html');
    assert.match(html, /window\.SiswebCommercePdf/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(html, /sisweb-print-back/);
    assert.match(html, /history\.back/);
    assert.match(html, /fonts\.ready/);
});

test('Mobile print fase 2: MDF-e valida janela e tem Voltar sem mudar conteúdo', () => {
    const js = read('mdf-e.js');
    assert.match(js, /novaJanela\.closed === true/);
    assert.match(js, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(js, /sisweb-print-back/);
    assert.match(js, /history\.back/);
    assert.match(js, /escapeHtmlMdfe\(relatorio\)/);
    assert.doesNotMatch(js, /<button onclick="window\.print\(\)">Imprimir<\/button>/);
});

test('Mobile print fase 3: folha injeta viewport + Voltar sem quebrar contratos', () => {
    const js = read('folha_pagamento/folha-relatorios.js');
    // Contratos preservados
    assert.match(js, /window\.open\('', '_blank'\)/);
    assert.doesNotMatch(js, /popup=yes/);
    assert.match(js, /this\.imprimirRelatorio\(relatorioHTML, titulo, tipoRelatorio, printOptions\)/);
    // Novas implementações
    assert.match(js, /folha-print-back/);
    assert.match(js, /name="viewport" content="width=device-width, initial-scale=1\.0"/);
    assert.match(js, /history\.back/);
    assert.match(js, /@media print\{\.folha-print-back\{display:none !important;\}\}/);
});
