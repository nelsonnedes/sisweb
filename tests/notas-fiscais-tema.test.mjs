import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Notas fiscais alinhadas aos temas claro/escuro (prints 2026-10-10):
// cards, paineis, modais e alertas usam tokens --sw-* ou tints, nunca
// fundos claros fixos. Excecoes: headers intencionais em slate escuro,
// botoes cinza funcionais e variaveis de paleta (:root).

const nf = fs.readFileSync('notas-fiscais.html', 'utf8');
const nat = fs.readFileSync('nf-naturezas.js', 'utf8');

test('superficies usam tokens (sem fundo claro fixo)', async (t) => {
  const proibidos = ['#fbfcfd', '#f0f4f8', '#f7f9fc', '#f8fafc', '#fffbf0', '#f0f7ff',
    '#fff3cd', '#f8d7da', '#d4edda', '#d0d8e4', '#dbe4ef', '#b3d7ff',
    '#f5c6cb', '#c3e6cb', '#ffc107', '#eef2f9', '#e8f0fe', '#c9d9f8',
    '#dbeafe', '#d1fae5', '#fef3c7', '#e9ecef', '#e0e0e0', '#f0f2f4', '#eee'];
  for (const cor of proibidos) {
    await t.test(`sem ${cor} em notas-fiscais.html`, () => {
      assert.ok(!nf.includes(cor), `cor fixa ${cor} fora dos tokens`);
    });
  }

  await t.test('sem fundo claro fixo no modal natureza', () => {
    assert.ok(!nat.includes('background:#fff;'), 'modal natureza sem fundo fixo');
    assert.ok(!nat.includes('color:#2c3e50'), 'labels via token');
    assert.ok(!nat.includes('border:1px solid #ddd'), 'bordas via token');
  });
});

test('textos usam tokens (contraste nos dois temas)', async (t) => {
  for (const cor of ['#2d3748', '#4a6fa5', '#718096', '#495057', '#5d6d7e', '#155724', '#1a73e8']) {
    await t.test(`sem texto ${cor}`, () => {
      assert.ok(!nf.includes(cor), `texto fixo ${cor} fora dos tokens`);
    });
  }

  await t.test('botoes cinza usam classe do sistema', () => {
    assert.ok(!nf.includes('background:#6c757d'), 'sem cinza inline');
    assert.ok(nf.includes('btn-secondary'), 'usa btn-secondary');
  });

  await t.test('cabecalhos de modal escuros intencionais', () => {
    assert.ok(nf.includes('background:#2c3e50'), 'header modal slate mantido');
    assert.ok(nat.includes('#2c3e50'), 'header natureza slate mantido');
  });
});

test('pills de status via tokens', async (t) => {  await t.test('statusMap usa tokens de severidade', () => {
    assert.ok(nf.includes("['🟡 Rascunho', 'warning']"), 'rascunho via token');
    assert.ok(nf.includes('var(--sw-${tok})'), 'pill interpolado por token');
    assert.ok(!nf.includes("'#856404','#fff3cd'"), 'sem par pastel fixo');
  });

  await t.test('msg fiscal usa tokens', () => {
    assert.ok(nf.includes("const [tok, cls] = cores[tipo]"), 'cores via token');
  });
});

test('botoes: sistema global 36 + campo 38, cores via tokens', async (t) => {
  await t.test('sem override local de altura (vale o sistema)', () => {
    assert.ok(!nf.includes('#nfForm .btn {'), 'sem dialeto local de altura');
    assert.ok(nf.includes('#nfForm .btn.btn-small.nf-cust-btn'), 'excecao campo 38');
  });

  await t.test('botoes de campo marcados', () => {
    const n = (nf.match(/nf-cust-btn/g) || []).length;
    assert.ok(n >= 4, `2 cliente + 1 natureza + CSS (achado ${n})`);
  });

  await t.test('small uniforme 30px em todas as cores + icones quadrados', () => {
    assert.ok(nf.includes('#nfForm .btn.btn-small {'), 'small uniforme escopado');
    assert.ok(nf.includes('height: 30px !important;'), 'altura 30 do sistema');
    assert.ok(nf.includes('#nfForm .nf-actions-cell .btn {'), 'acoes quadradas');
  });

  await t.test('cinzas funcionais via classe do sistema', () => {
    assert.ok(!nf.includes("style=\"background:#6c757d"), 'sem cinza inline');
    assert.ok(nf.includes('btn-secondary'), 'usa btn-secondary');
  });

  await t.test('perigo MFA e info assinatura via tokens', () => {
    const up = fs.readFileSync('user-profile.html', 'utf8');
    assert.ok(!up.includes('#fef2f2'), 'sem tint fixa no perfil');
    const sub = fs.readFileSync('subscription.html', 'utf8');
    assert.ok(!sub.includes('background:#2563eb'), 'assinatura via token');
  });
});
