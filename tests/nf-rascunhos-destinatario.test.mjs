import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Destinatário + rascunhos NF-e (relatos 2026-10-11):
// botoes 38px, editar com cliente de rascunho, sem duplicar,
// excluir rascunho, natureza restaurada, carregar robusto.

const nf = fs.readFileSync('notas-fiscais.html', 'utf8');

test('destinatário: botoes e editar funcionam', async (t) => {  await t.test('botoes Novo/Editar 38px no desktop', () => {
    assert.ok(nf.includes('nf-cust-btn'), 'classe de padronização');
    assert.ok(nf.includes('height: 38px !important;'), 'altura 38px');
  });

  await t.test('editar resolve cliente de rascunho (opção temporária)', () => {
    assert.ok(nf.includes('opção temporária de rascunho'), 'fallback documentado');
    assert.ok(nf.includes('opt.dataset.cnpj'), 'usa dados da opção');
  });
});

test('rascunhos: sem duplicar, com excluir, natureza restaurada', async (t) => {
  await t.test('id do rascunho rastreado e preservado no save', () => {
    assert.ok(nf.includes('let _rascunhoEditandoId = null;'), 'estado declarado');
    assert.ok(nf.includes('_rascunhoEditandoId = nfId;'), 'fixado na edição');
    assert.ok(nf.includes('if (_rascunhoEditandoId) nfeData.id = _rascunhoEditandoId;'),
      'save atualiza em vez de duplicar');
  });

  await t.test('botão excluir rascunho com confirm danger', () => {
    assert.ok(nf.includes("onclick=\"excluirRascunhoNF('${n.id}')\""), 'botão na lista');
    assert.ok(nf.includes('window.excluirRascunhoNF'), 'exposição global');
    assert.ok(nf.includes("title: 'Excluir rascunho'"), 'confirm padronizado');
    assert.ok(nf.includes('removerNF(tid, 55, nfId)'), 'remove via storage');
  });

  await t.test('natureza visível sincronizada na edição', () => {
    assert.ok(nf.includes("getElementById('nfNatOpSelect')"), 'select sincronizado');
    assert.ok(nf.includes('nfAplicarNatOp(natSel)'), 'dependentes aplicados');
  });

  await t.test('carregar tenta 65 e distingue permissão', () => {
    assert.ok(nf.includes('carregarNF(tid, 65, nfId)'), 'fallback NFC-e');
    assert.ok(nf.includes('Sem permissão para ler rascunhos'), 'mensagem de permissão');
  });
});

test('certificado espelhado na config do validador', async (t) => {
  await t.test('upload sincroniza fiscal/config', () => {
    assert.ok(nf.includes('sincronizarCertificadoNaConfig(tid,'), 'upload sincroniza');
    assert.ok(nf.includes("saveConfigSection(tid, 'certificado'"), 'via seção segura');
    assert.ok(nf.includes('recarregarConfig'), 'config recarregada');
  });

  await t.test('boot reconcilia instalações antigas e remover limpa', () => {
    assert.ok(nf.includes('reconciliarCertificadoConfig(tid)'), 'reconciliação no init');
    assert.ok(nf.includes("tipo: null, titular: ''"), 'remoção limpa espelho');
  });
});
