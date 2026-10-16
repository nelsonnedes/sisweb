import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');
const builderSrc = readFileSync('mdfe-xml-builder.js', 'utf8');

function loadImport() {
  const context = {
    window: {},
    document: { addEventListener() {}, getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeImportInternals;
  assert.ok(internals, '__mdfeImportInternals deve existir');
  return internals;
}

function loadDamdfe() {
  const context = {
    window: {},
    document: { addEventListener() {}, getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(readFileSync('assets/vendor/qrcode-generator.js', 'utf8'), context);
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeDamdfeInternals;
  assert.ok(internals, '__mdfeDamdfeInternals deve existir');
  return internals;
}

function loadBuilder() {
  const context = { window: {} };
  vm.runInNewContext(builderSrc, context);
  return context.window.MdfeXmlBuilder;
}

function notaFiscal(over = {}) {
  return {
    id: 'n1', numero: '1724', serie: '1', dataEmissao: '2026-10-15T10:00',
    chave: '1'.repeat(44), destinatario: 'DEST', municipio: 'Irecê', uf: 'BA',
    origemMunicipio: 'São Miguel do Guamá', origemUf: 'PA', status: 'autorizada',
    transp: {
      veicTransp: { placa: 'IBG-2314', UF: 'CE', RNTC: '12345678' },
      reboque: [{ placa: 'XYZ-9999', UF: 'PA' }],
      transporta: { xNome: '', CPF: '' },
    },
    emit: { endereco: { municipio: 'São Miguel do Guamá' } },
    valorTotal: 100, total: { vNF: 100 },
    ...over,
  };
}

test('encerramento: UF + cidade IBGE (nunca município de UF errada)', () => {
  assert.match(html, /<select id="ufEncerramento"/);
  assert.match(html, /<select id="municipioEncerramento" required>/);
  assert.match(html, /onchange="mdfeSincronizarEncerramento\(this\.value\)"/);
  assert.match(js, /function mdfeSincronizarEncerramento\(mdfeId\)/);
  assert.match(js, /popularCidades\('municipioEncerramento', uf, mdfe\.municipioDescarregamento \|\| ''\)/);
  assert.match(js, /const ufEncerramento = String\(document\.getElementById\('ufEncerramento'\)\?\.value/);
  assert.match(js, /resolverCodigoMunicipio\(ufEncerramento, municipioEncerramento\)/);
  assert.match(js, /window\.mdfeSincronizarEncerramento = mdfeSincronizarEncerramento;/);
});

test('emissão: municípios são selects IBGE por UF', () => {
  assert.match(html, /<select id="percursoMunicipioCarregamento" required>/);
  assert.match(html, /<select id="percursoMunicipioDescarregamento" required>/);
  assert.match(js, /popularCidades\('percursoMunicipioCarregamento', mdfe\.ufInicio \|\| '', mdfe\.municipioCarregamento \|\| ''\)/);
  assert.match(js, /popularCidades\('percursoMunicipioDescarregamento', mdfe\.ufFim \|\| '', mdfe\.municipioDescarregamento \|\| ''\)/);
});

test('import: RNTC + UF placa + reboque da NF-e (veicTransp/reboque)', () => {
  const { mdfeNormalizarNFeImportacao, mdfeResumoImportacao } = loadImport();
  const [n] = mdfeNormalizarNFeImportacao({ a: notaFiscal() });
  assert.equal(n.rntc, '12345678', 'RNTC do veicTransp');
  assert.equal(n.ufPlaca, 'CE');
  assert.equal(n.reboque && n.reboque.placa, 'XYZ9999');
  assert.equal(n.reboque && n.reboque.uf, 'PA');
  const r = mdfeResumoImportacao([n]);
  assert.equal(r.rntrc, '12345678');
  assert.equal(r.ufPlaca, 'CE');
  assert.equal(r.reboque && r.reboque.placa, 'XYZ9999');
  assert.equal(r.reboque && r.reboque.uf, 'PA');
  assert.equal(r.rntcsDivergentes, false);
  const n2 = { ...n, rntc: '999', reboque: { placa: 'AAA0000', uf: 'SP' } };
  const r2 = mdfeResumoImportacao([n, n2]);
  assert.equal(r2.rntcsDivergentes, true);
  assert.equal(r2.reboquesDivergentes, true);
});

test('import: preenche RNTRC/UF/reboque no form + cidades via IBGE', () => {
  assert.match(js, /ufPlacaEl\.value = resumo\.ufPlaca/);
  assert.match(js, /rntrcEl\.value = resumo\.rntrc/);
  assert.match(js, /rebPlacaEl\.value = resumo\.reboque\.placa/);
  assert.match(js, /rebUfEl\.value = resumo\.reboque\.uf/);
  assert.match(js, /popularCidades\('percursoMunicipioCarregamento', resumo\.origem\.uf/);
  assert.match(js, /rntc: mdfeDigits\(nota\?\.transp\?\.veicTransp\?\.RNTC/);
});

test('reboque: form + coleta + prefill + remember', () => {
  assert.match(html, /id="reboquePlaca"/);
  assert.match(html, /id="reboqueUf"/);
  assert.match(js, /placa: String\(document\.getElementById\('reboquePlaca'\)\?\.value/);
  assert.match(js, /rpEl\.value = reb\.placa \|\| ''/);
  assert.match(js, /ruEl\.value = reb\.uf \|\| ''/);
  assert.match(js, /placa: String\(payload\?\.reboque\?\.placa/);
  assert.match(js, /fillIfEmpty\('reboquePlaca'/);
  assert.match(js, /fillIfEmpty\('reboqueUf'/);
});

test('XML: reboque NÃO transmitido sem XSD (mesma regra do <prop>)', () => {
  const B = loadBuilder();
  const xml = B.buildMdfe({
    numero: 1, serie: '1', dataEmissao: '2026-10-15T10:00', ufInicio: 'PA', ufFim: 'BA',
    municipioCarregamento: 'X', municipioDescarregamento: 'Y',
    codigoMunicipioCarregamento: '1507607', codigoMunicipioDescarregamento: '2914604',
    veiculo: { placa: 'A', tara: 1 }, reboque: { placa: 'B', uf: 'PA' },
    condutor: { nome: 'N', cpf: '11122233344' }, documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 1, pesoTotal: 1,
    emit: { cnpj: '12345678000195', ie: '1', razaoSocial: 'E', endereco: { logradouro: 'R', numero: '1', bairro: 'C', codigoMunicipio: '1507607', municipio: 'X', uf: 'PA' } },
  }).xml;
  assert.doesNotMatch(xml, /veicReboque/, 'vai ao registro + DAMDFE, não ao XML');
});

test('DAMDFE: rota do percurso + UF nos municípios + reboque', () => {
  const { mdfeDamdfeConteudo } = loadDamdfe();
  const out = mdfeDamdfeConteudo({
    numero: '20', ufInicio: 'PA', ufFim: 'BA', percursoUfs: ['TO', 'GO'],
    municipioCarregamento: 'São Miguel do Guamá', municipioDescarregamento: 'Irecê',
    veiculo: { placa: 'A' }, reboque: { placa: 'XYZ9999', uf: 'PA' },
    documentos: [],
  }, {});
  assert.ok(out.includes('Rota: <strong>PA → TO → GO → BA</strong>'));
  assert.ok(out.includes('São Miguel do Guamá/PA'));
  assert.ok(out.includes('Irecê/BA'));
  assert.ok(out.includes('XYZ9999') && out.includes('(REBOQUE)'));
  const sem = mdfeDamdfeConteudo({ numero: '1', veiculo: {}, documentos: [] }, {});
  assert.doesNotMatch(sem, /REBOQUE/);
  assert.ok(sem.includes('Rota: <strong>-</strong>') || sem.includes('Rota:'));
});
