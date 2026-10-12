import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Eventos RTC: catálogo + builder do <detEvento> (fonte: XSDs oficiais Eventos_RTC).
const src = fs.readFileSync('nf-fiscal-events.js', 'utf8');
const R = new Function('window', 'module', src + '; return window.NFRtcEvents;')({ window: {} }, undefined);

test('catálogo cobre os 15 eventos de negócio (e110001 é só cancelamento)', () => {
  const tps = Object.keys(R.CATALOG).sort();
  assert.equal(tps.length, 15);
  assert.ok(!tps.includes('110001'));
  assert.ok(!tps.includes('211120'), '211120 sem XSD próprio — fora do catálogo');
  assert.equal(R.CATALOG['112110'].autor, '1');
  assert.equal(R.CATALOG['211110'].autor, '1,2');
  assert.equal(R.CATALOG['412120'].autor, '5');
});

test('descEvento do catálogo é idêntico ao enumeration do XSD', () => {
  assert.equal(R.CATALOG['112130'].desc, 'Perecimento, perda, roubo ou furto durante o transporte contratado pelo fornecedor');
  assert.equal(R.CATALOG['211110'].desc, 'Solicitação de Apropriação de crédito presumido');
  assert.equal(R.CATALOG['211150'].desc, 'Solicitação de Apropriação de Crédito para bens e serviços que dependem de atividade do adquirente');
});

test('112110 (pagamento integral): detEvento escalar com indQuitacao fixo', () => {
  const xml = R.buildDetEvento('112110', { cOrgaoAutor: '15', tpAutor: '1', verAplic: 'Sisweb 1.0' });
  assert.match(xml, /<descEvento>Informação de efetivo pagamento integral/);
  assert.match(xml, /<cOrgaoAutor>15<\/cOrgaoAutor><tpAutor>1<\/tpAutor>/);
  assert.match(xml, /<indQuitacao>1<\/indQuitacao>/);
});

test('112130 (perecimento fornecedor): item com crédito a estornar', () => {
  const xml = R.buildDetEvento('112130', {
    cOrgaoAutor: '15', tpAutor: '1', verAplic: 'Sisweb 1.0',
    itens: [{ nItem: 1, vIBS: 10, vCBS: 5, qty: 2, unit: 'UN', cIBS: 3, cCBS: 1.5 }],
  });
  assert.match(xml, /<gPerecimento nItem="1"><vIBS>10\.00<\/vIBS><vCBS>5\.00<\/vCBS>/);
  assert.match(xml, /<qPerecimento>2\.0000<\/qPerecimento><uPerecimento>UN<\/uPerecimento><vIBS>3\.00<\/vIBS><vCBS>1\.50<\/vCBS>/);
});

test('112120/112140/211124/211130/211140: grupos e campos por evento', () => {
  const mk = (qty, unit) => ({ nItem: 2, vIBS: 1, vCBS: 1, qty, unit });
  assert.match(R.buildDetEvento('112120', { cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S', itens: [mk(1, 'KG')] }), /<gConsumo nItem="2">.*<qtde>1\.0000<\/qtde><unidade>KG<\/unidade>/);
  assert.match(R.buildDetEvento('112140', { cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S', itens: [mk(1, 'L')] }), /<gItemNaoFornecido nItem="2">.*<qNaoFornecida>1\.0000<\/qNaoFornecida><uNaoFornecida>L<\/uNaoFornecida>/);
  assert.match(R.buildDetEvento('211130', { cOrgaoAutor: '15', tpAutor: '2', verAplic: 'S', itens: [mk(1, 'PC')] }), /<gImobilizacao nItem="2">.*<qImobilizado>1\.0000<\/qImobilizado>/);
  assert.match(R.buildDetEvento('211140', { cOrgaoAutor: '15', tpAutor: '2', verAplic: 'S', itens: [mk(1, 'L')] }), /<gConsumoComb nItem="2">.*<qComb>1\.0000<\/qComb><uComb>L<\/uComb>/);
});

test('211150 (gCredito): sem controle de estoque', () => {
  const xml = R.buildDetEvento('211150', {
    cOrgaoAutor: '15', tpAutor: '2', verAplic: 'Sisweb 1.0',
    itens: [{ nItem: 3, vCredIBS: 7.5, vCredCBS: 2.5 }],
  });
  assert.match(xml, /<gCredito nItem="3"><vCredIBS>7\.50<\/vCredIBS><vCredCBS>2\.50<\/vCredCBS><\/gCredito>/);
  assert.doesNotMatch(xml, /gControleEstoque/);
});

test('211110 (crédito presumido): cCredPres 2 dígitos + lados opcionais', () => {
  const xml = R.buildDetEvento('211110', {
    cOrgaoAutor: '35', tpAutor: '2', verAplic: 'Sisweb 1.0',
    itens: [{ nItem: 1, vBCCredPres: 100, cCredPres: '01', gIBSCredPres: { pCredPres: 5, vCredPres: 5 } }],
  });
  assert.match(xml, /<gCredPresOper nItem="1"><vBCCredPres>100\.00<\/vBCCredPres><cCredPres>01<\/cCredPres>/);
  assert.match(xml, /<gIBSCredPres><pCredPres>5<\/pCredPres><vCredPres>5\.00<\/vCredPres><\/gIBSCredPres>/);
  assert.doesNotMatch(xml, /gCBSCredPres/);
  assert.throws(() => R.buildDetEvento('211110', {
    cOrgaoAutor: '35', tpAutor: '2', verAplic: 'S', itens: [{ nItem: 1, vBCCredPres: 100, cCredPres: '1' }],
  }), /cCredPres deve ter 2 dígitos/);
});

test('escalares: 112150 data, 211128/212110/212120 aceite, 412120 fisco', () => {
  assert.match(R.buildDetEvento('112150', { cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S', scalar: { dPrevEntrega: '2026-11-01' } }), /<dPrevEntrega>2026-11-01<\/dPrevEntrega>/);
  assert.throws(() => R.buildDetEvento('112150', { cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S', scalar: { dPrevEntrega: '01/11/2026' } }), /AAAA-MM-DD/);
  assert.match(R.buildDetEvento('211128', { cOrgaoAutor: '15', tpAutor: '2', verAplic: 'S', scalar: { indAceitacao: '1' } }), /<indAceitacao>1<\/indAceitacao>/);
  assert.throws(() => R.buildDetEvento('212110', { cOrgaoAutor: '15', tpAutor: '8', verAplic: 'S', scalar: { indAceitacao: '2' } }), /deve ser 0 ou 1/);
  const fisco = R.buildDetEvento('412120', { cOrgaoAutor: '15', tpAutor: '5', verAplic: 'S', scalar: { indDeferimento: '0', cMotivo: '2', xMotivo: 'Análise pendente' } });
  assert.match(fisco, /<indDeferimento>0<\/indDeferimento><cMotivo>2<\/cMotivo><xMotivo>Análise pendente<\/xMotivo>/);
});

test('travas: tpAutor fora do permitido, nItem duplicado/fora da faixa, unidade, verAplic', () => {
  const base = { cOrgaoAutor: '15', verAplic: 'Sisweb 1.0', itens: [{ nItem: 1, vIBS: 1, vCBS: 1, qty: 1, unit: 'UN', cIBS: 1, cCBS: 1 }] };
  assert.throws(() => R.buildDetEvento('112130', { ...base, tpAutor: '2' }), /tpAutor deve ser 1/);
  assert.throws(() => R.buildDetEvento('112130', { ...base, tpAutor: '1', itens: [...base.itens, { ...base.itens[0] }] }), /duplicado/);
  assert.throws(() => R.buildDetEvento('112130', { ...base, tpAutor: '1', itens: [{ ...base.itens[0], nItem: 991 }] }), /entre 1 e 990/);
  assert.throws(() => R.buildDetEvento('112130', { ...base, tpAutor: '1', itens: [{ ...base.itens[0], unit: 'UNIDADE1' }] }), /1–6 caracteres/);
  assert.throws(() => R.buildDetEvento('112110', { cOrgaoAutor: '1', tpAutor: '1', verAplic: 'S' }), /cOrgaoAutor.*2 dígitos/);
  assert.throws(() => R.buildDetEvento('999999', base), /não suportado/);
});

test('formatos decimais seguem os patterns dos XSDs (TDec_1302/TDec_1104)', () => {
  assert.throws(() => R.buildDetEvento('112130', {
    cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S',
    itens: [{ nItem: 1, vIBS: '10.001', vCBS: 1, qty: 1, unit: 'UN', cIBS: 1, cCBS: 1 }],
  }), /13\+2/);
  assert.throws(() => R.buildDetEvento('112130', {
    cOrgaoAutor: '15', tpAutor: '1', verAplic: 'S',
    itens: [{ nItem: 1, vIBS: 1, vCBS: 1, qty: '1.00001', unit: 'UN', cIBS: 1, cCBS: 1 }],
  }), /11\+4/);
});
