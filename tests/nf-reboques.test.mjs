import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Composição veicular NF-e (tração + reboques: carreta 1, bitrem 2, rodotrem até 5).
// Tração = nfVeiculo* (→ veicTransp); reboques = lista (→ transp.reboque[], max 5 SEFAZ).

const nf = fs.readFileSync('notas-fiscais.html', 'utf8');

test('UI: campos de reboque espelham o padrão de volumes', async (t) => {
  await t.test('inputs, botão e lista existem', () => {
    assert.ok(nf.includes('id="nfReboquePlaca"'), 'input placa reboque');
    assert.ok(nf.includes('id="nfReboqueUF"'), 'input UF reboque');
    assert.ok(nf.includes('onclick="adicionarReboqueNF()"'), 'botão adicionar');
    assert.ok(nf.includes('id="nfReboquesLista"'), 'lista de reboques');
    assert.ok(nf.includes('onclick="removerReboqueNF('), 'remover por índice');
  });

  await t.test('tração rotulada e hint de composição', () => {
    assert.ok(nf.includes('Placa (tração):'), 'tração identificada');
    assert.ok(nf.includes('bitrem'), 'hint cita composições');
  });
});

test('estado e validação: placa BR, UF, teto 5', async (t) => {
  await t.test('validarPlacaNF aceita AAA0000 e ABC1D23', () => {
    const m = nf.match(/function validarPlacaNF\(placa\) \{[\s\S]*?\n    \}/);
    assert.ok(m, 'validador extraível');
    const validar = new Function(`${m[0]}; return validarPlacaNF;`)();
    assert.strictEqual(validar('ABC1D23'), true);
    assert.strictEqual(validar('AAA0000'), true);
    assert.strictEqual(validar('AB12'), false);
    assert.strictEqual(validar('ABCDEFGH'), false);
    assert.strictEqual(validar(''), false);
  });

  await t.test('teto de 5 reboques (leiaute SEFAZ)', () => {
    assert.ok(nf.includes('_reboquesNF.length >= 5'), 'teto aplicado');
    assert.ok(nf.includes('Limite de 5 reboques'), 'mensagem de teto');
  });

  await t.test('UF com 2 letras', () => {
    assert.ok(nf.includes("/^[A-Z]{2}$/.test(UF)"), 'UF validada');
  });
});

test('XML: build e restore incluem reboque[]', async (t) => {
  await t.test('montagem filtra e anexa reboques válidos', () => {
    assert.ok(nf.includes('if (rbs.length) transp.reboque = rbs;'), 'build anexa');
    assert.ok(nf.includes('validarPlacaNF(rb.placa)'), 'build filtra inválidos');
  });

  await t.test('restore preenche lista (retrocompat: vazio quando ausente)', () => {
    assert.ok(nf.includes('_reboquesNF = Array.isArray(t.reboque)'), 'restore lê reboque[]');
    assert.ok(nf.includes('renderizarReboquesNF();'), 'restore renderiza');
  });

  await t.test('resets e desabilitados cobrem reboques', () => {
    assert.ok(nf.includes('_reboquesNF = [];'), 'limpeza zera lista');
    assert.ok(nf.includes("'nfReboquePlaca','nfReboqueUF','btnAddReboqueNF'") ||
      nf.includes("'nfReboquePlaca', 'nfReboqueUF'"), 'frete 9 desabilita');
    assert.ok(nf.includes('window.adicionarReboqueNF'), 'exposição global');
    assert.ok(nf.includes('window.removerReboqueNF'), 'remoção global');
  });

  await t.test('revisão valida reboques', () => {
    assert.ok(nf.includes('Reboque ${idx + 1}: placa sem UF.'), 'reboque sem UF');
    assert.ok(nf.includes('Reboque informado sem placa de tração.'), 'reboque sem tração');
  });

  await t.test('nf-service mapeia reboque[] (contrato preservado)', () => {
    const svc = fs.readFileSync('nf-service.js', 'utf8');
    assert.ok(svc.includes('if (reboque.length) transp.reboque = reboque;'), 'mapeamento intacto');
  });
});
