import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
    return fs.readFileSync(path.resolve(rel), 'utf8');
}

const CARD_MODULES = [
    { name: 'romaneiotora (F1)', html: 'romaneiotora.html', js: 'romaneiotora.js', tableId: 'romaneioTable' },
    { name: 'romaneiotl (F2)', html: 'romaneiotl.html', js: 'modules/items/renderizar-tabela.js', tableId: 'romaneioTable' },
    { name: 'romaneiopct (F3)', html: 'romaneiopct.html', js: 'romaneiopct-tabela.js', tableId: 'romaneioTable' },
    { name: 'romaneiopes (F4)', html: 'romaneiopes.html', js: 'romaneiopes.html', tableId: 'romaneioTable' },
    { name: 'preromaneio (F5)', html: 'preromaneio.html', js: 'preromaneio.js', tableId: 'tabela-serrados' }
];

test('Romaneios Mobile: cada módulo converte tabela em cards no @media(max-width:768px)', () => {
    for (const m of CARD_MODULES) {
        const html = read(m.html);
        assert.match(html, /@media\s*\(max-width:\s*768px\)/, `${m.name}: deve ter media query mobile 768px`);
        assert.match(html, /#romaneioTable\s+thead|#tabela-serrados\s+thead/, `${m.name}: deve esconder o thead no card`);
        assert.match(html, /display:\s*none\s*!important/, `${m.name}: thead display:none`);
        assert.match(html, /tbody\s*\{\s*display:\s*flex\s*!important/, `${m.name}: tbody vira flex column`);
        assert.match(html, /tr\s*\{\s*display:\s*block\s*!important/, `${m.name}: tr vira block card`);
    }
});

test('Romaneios Mobile: antídoto td[data-label]::before com position:static em todos os módulos', () => {
    for (const m of CARD_MODULES) {
        const html = read(m.html);
        const beforeBlock = html.match(/td\[data-label\]::before[\s\S]*?\}/);
        assert.ok(beforeBlock, `${m.name}: deve existir regra td[data-label]::before`);
        assert.match(beforeBlock[0], /position:\s*static\s*!important/, `${m.name}: position static (neutraliza ui-components.css)`);
        assert.match(beforeBlock[0], /width:\s*auto\s*!important/, `${m.name}: width auto`);
        assert.match(beforeBlock[0], /transform:\s*none\s*!important/, `${m.name}: transform none`);
        assert.match(beforeBlock[0], /padding-right:\s*0\s*!important/, `${m.name}: padding-right 0`);
    }
});

test('Romaneios Mobile: renderizadores injetam data-label nas células', () => {
    const tora = read('romaneiotora.js');
    assert.match(tora, /data-label="Plaqueta"/, 'romaneiotora.js injeta data-label Plaqueta');
    assert.match(tora, /data-label="Ações"/, 'romaneiotora.js injeta data-label Ações');

    const tl = read('modules/items/renderizar-tabela.js');
    assert.match(tl, /data-label="Espécie"/, 'renderizar-tabela.js injeta data-label Espécie');
    assert.match(tl, /data-label="Ações"/, 'renderizar-tabela.js injeta data-label Ações');

    const pct = read('romaneiopct-tabela.js');
    assert.match(pct, /data-label="Espécie"/, 'romaneiopct-tabela.js injeta data-label Espécie');
    assert.match(pct, /data-label="Ações"/, 'romaneiopct-tabela.js injeta data-label Ações');

    const pes = read('romaneiopes.html');
    assert.match(pes, /data-label=/, 'romaneiopes.html injeta data-label inline');

    const pre = read('preromaneio.js');
    assert.match(pre, /data-label=/, 'preromaneio.js injeta data-label');
});

test('Romaneios Mobile: desktop >=769px reverte para tabela normal (anti-regressão)', () => {
    for (const m of CARD_MODULES) {
        const html = read(m.html);
        assert.match(html, /@media\s*\(min-width:\s*769px\)[\s\S]*?(display:\s*table-row|table-header-group|table-row-group|table-cell)/,
            `${m.name}: deve reverter para table no desktop`);
    }
});

test('Romaneios Mobile: impressão (@media print) reverte cards para tabela', () => {
    for (const m of CARD_MODULES) {
        const html = read(m.html);
        assert.match(html, /@media\s*print[\s\S]*?display:\s*revert/, `${m.name}: deve reverter no print`);
    }
});

test('Romaneios Mobile: ajudabitolas (F6) usa scroll horizontal (tabelas estáticas CONAMA, não cards)', () => {
    const html = read('ajudabitolas.html');
    assert.match(html, /@media\s*\(max-width:\s*768px\)/, 'ajudabitolas deve ter media query mobile');
    assert.match(html, /table\s*\{[^}]*overflow-x:\s*auto/, 'ajudabitolas: tabela com scroll horizontal no mobile');
});
