import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const estoqueJs = readFileSync(new URL('../estoque.js', import.meta.url), 'utf8');

test('estoque.js: encontrarToraPorPlaqueta ignora a própria tora em edição por id, key ou firebaseKey', () => {
    assert.ok(estoqueJs.includes('if (toraEmEdicao)'), 'Deve considerar toraEmEdicao');
    assert.ok(estoqueJs.includes('idsParaIgnorar'), 'Deve usar idsParaIgnorar flexível');
    assert.ok(estoqueJs.includes('toraEstaAtivaNoEstoque'), 'Deve filtrar por status ativo no estoque');
});

test('estoque.js: atualizarToraEditada atualiza a tora no estoqueAtual e persiste no Firebase', () => {
    assert.ok(estoqueJs.includes('async function atualizarToraEditada'), 'Função atualizarToraEditada deve existir');
    assert.ok(estoqueJs.includes('estoqueTorasAtual/${finalId}'), 'Deve atualizar o path correto no Firebase');
});

test('estoque.js: registrarEntrada redireciona para atualizarToraEditada quando toraEmEdicao está ativo', () => {
    const fnStart = estoqueJs.indexOf('async function registrarEntrada(event)');
    assert.ok(fnStart >= 0, 'registrarEntrada deve existir');
    const fnSnippet = estoqueJs.slice(fnStart, fnStart + 300);
    assert.ok(fnSnippet.includes('if (toraEmEdicao)'), 'Deve verificar toraEmEdicao no início');
    assert.ok(fnSnippet.includes('atualizarToraEditada'), 'Deve chamar atualizarToraEditada');
});

test('estoque.js: lógica de encontrarToraPorPlaqueta ignorando toras baixadas/inativas e em edição', () => {
    const normalizarChavePlaqueta = (val) => String(val || '').trim().toLowerCase();
    
    function toraEstaAtivaNoEstoque(tora) {
        if (!tora || typeof tora !== 'object') return false;
        if (tora.manualForaEstoque) return false;
        const status = String(tora.status || 'disponivel').trim().toLowerCase();
        return status === 'disponivel' || status === 'ativo' || status === 'em_estoque' || status === 'pendente';
    }

    let estoqueAtual = [
        { id: '-Nxyz123', firebaseKey: '-Nxyz123', plaqueta: '1DS10203', especie: 'Ipê', status: 'disponivel' },
        { id: '-Nabc456', firebaseKey: '-Nabc456', plaqueta: '1DS10204', especie: 'Jatobá', status: 'disponivel' },
        { id: '-Nold789', firebaseKey: '-Nold789', plaqueta: '1DS10205_BAIXADA', especie: 'Cedro', status: 'baixado' }
    ];
    let toraEmEdicao = null;

    function encontrarToraPorPlaqueta(plaqueta, ignorarId = '') {
        const chave = normalizarChavePlaqueta(plaqueta);
        if (!chave) return null;
        const idsParaIgnorar = new Set();
        if (ignorarId !== undefined && ignorarId !== null && String(ignorarId).trim() !== '') {
            idsParaIgnorar.add(String(ignorarId).trim());
        }
        if (toraEmEdicao) {
            if (toraEmEdicao.id) idsParaIgnorar.add(String(toraEmEdicao.id).trim());
            if (toraEmEdicao.key) idsParaIgnorar.add(String(toraEmEdicao.key).trim());
            if (toraEmEdicao.firebaseKey) idsParaIgnorar.add(String(toraEmEdicao.firebaseKey).trim());
        }
        return (estoqueAtual || []).find((tora) => {
            if (!tora) return false;
            if (!toraEstaAtivaNoEstoque(tora)) return false;
            if (toraEmEdicao && (tora === toraEmEdicao || (tora.id && toraEmEdicao.id && String(tora.id) === String(toraEmEdicao.id)))) return false;
            const tId = String(tora.id || '').trim();
            const tKey = String(tora.key || '').trim();
            const tFbKey = String(tora.firebaseKey || '').trim();
            if (tId && idsParaIgnorar.has(tId)) return false;
            if (tKey && idsParaIgnorar.has(tKey)) return false;
            if (tFbKey && idsParaIgnorar.has(tFbKey)) return false;
            return normalizarChavePlaqueta(tora.plaqueta) === chave;
        }) || null;
    }

    // Caso 1: Plaqueta de tora já baixada (1DS10205_BAIXADA) -> NÃO deve acusar duplicidade de estoque ativo
    assert.equal(encontrarToraPorPlaqueta('1DS10205_BAIXADA'), null);

    // Caso 2: Em edição da tora 1DS10203, mantendo a mesma plaqueta -> NÃO acusa duplicidade
    toraEmEdicao = estoqueAtual[0];
    assert.equal(encontrarToraPorPlaqueta('1DS10203', toraEmEdicao.id), null);

    // Caso 3: Em edição da tora 1DS10203, mudando para 1DS10204 (que pertence a outra tora ATIVA) -> DEVE acusar duplicidade
    assert.ok(encontrarToraPorPlaqueta('1DS10204', toraEmEdicao.id) !== null);

    // Caso 4: Em edição da tora 1DS10203, mudando para plaqueta inédita -> NÃO acusa duplicidade
    assert.equal(encontrarToraPorPlaqueta('1DS10999', toraEmEdicao.id), null);
});
