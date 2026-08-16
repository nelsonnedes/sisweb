import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

test('Padronização de Rodapés e Botões de Modais em todas as páginas de Romaneios', async (t) => {
  const files = ['preromaneio.html', 'romaneiotl.html', 'romaneiopct.html', 'romaneiopes.html', 'romaneiotora.html'];
  const css = fs.readFileSync('romaneio-comum.css', 'utf8');

  await t.test('1. romaneio-comum.css define botões de cancelar/voltar com cinza neutro #64748b e salvar com #16a34a', () => {
    assert.ok(css.includes('#64748b'), 'Deve conter cinza neutro para botões de voltar/cancelar');
    assert.ok(css.includes('#16a34a'), 'Deve conter verde sucesso canônico para botões de salvar');
    // Garantir que back-button não tem #ef4444
    assert.ok(!css.includes('#clientModal .back-button.close-modal-btn {\n    background: #ef4444'), 'Não deve usar vermelho para botão de cancelar em clientModal');
  });

  await t.test('2. Modais de criação possuem botões de Cancelar e Salvar padronizados', () => {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Verificar se não há inline justify-content:flex-end nos modais de cadastro
      if (content.includes('id="fornecedorModal"')) {
        const modalChunk = content.substring(content.indexOf('id="fornecedorModal"'), content.indexOf('id="fornecedorModal"') + 3500);
        assert.ok(!modalChunk.includes('justify-content:flex-end'), `fornecedorModal em ${file} não deve ter override inline justify-content:flex-end`);
      }
      if (content.includes('id="clientModal"')) {
        const modalChunk = content.substring(content.indexOf('id="clientModal"'), content.indexOf('id="clientModal"') + 3500);
        assert.ok(!modalChunk.includes('justify-content:flex-end'), `clientModal em ${file} não deve ter override inline justify-content:flex-end`);
      }
    }
  });

  await t.test('3. Botão Limpar Pré-Romaneio em TL usa classe btn-warning ou btn-limpar-pre (não btn-danger)', () => {
    const tlContent = fs.readFileSync('romaneiotl.html', 'utf8');
    const btnLimpar = tlContent.match(/id="btnLimparPreRomaneio"[^>]*>/);
    assert.ok(btnLimpar, 'Botão btnLimparPreRomaneio deve existir em TL');
    assert.ok(!btnLimpar[0].includes('btn-danger'), 'Botão de limpar pré-romaneio não deve ter classe btn-danger');
    assert.ok(btnLimpar[0].includes('btn-warning') || btnLimpar[0].includes('btn-limpar-pre'), 'Deve ter classe btn-warning ou btn-limpar-pre');
  });

  await t.test('4. Botão Novo Fornecedor em Tora usa btn-adicionar (não btn-save)', () => {
    const toraContent = fs.readFileSync('romaneiotora.html', 'utf8');
    const match = toraContent.match(/<button[^>]*onclick="openNewFornecedorModal\(\)"[^>]*>/);
    assert.ok(match, 'Botão openNewFornecedorModal deve existir em Tora');
    assert.ok(match[0].includes('btn-adicionar'), 'Botão de novo fornecedor deve ter classe btn-adicionar');
    assert.ok(!match[0].includes('btn-save'), 'Botão de novo fornecedor não deve ter classe btn-save');
  });
});
