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
