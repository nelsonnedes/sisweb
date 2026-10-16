import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');
const builderSrc = readFileSync('mdfe-xml-builder.js', 'utf8');

function loadDamdfe(extraWindow = {}) {
  const context = {
    window: { ...extraWindow },
    document: { addEventListener() {}, getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(readFileSync('assets/vendor/qrcode-generator.js', 'utf8'), context);
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeDamdfeInternals;
  assert.ok(internals, '__mdfeDamdfeInternals deve existir');
  return { internals, context };
}

function loadBuilder() {
  const context = { window: {} };
  vm.runInNewContext(builderSrc, context);
  return context.window.MdfeXmlBuilder;
}

function basePayload(veiculo) {
  return {
    numero: 20, serie: '1', dataEmissao: '2026-10-15T21:44',
    ufInicio: 'PA', ufFim: 'BA',
    municipioCarregamento: 'São Miguel do Guamá', municipioDescarregamento: 'Irecê',
    codigoMunicipioCarregamento: '1507607', codigoMunicipioDescarregamento: '2914604',
    veiculo, condutor: { nome: 'SERGIO NUNES DE ANDRADE', cpf: '50361724500' },
    documentos: [{ chave: '1'.repeat(44) }], valorTotal: 50923.59, pesoTotal: 19000,
    emit: {
      cnpj: '18615107000100', ie: '151234567',
      razaoSocial: 'JN Madeiras', endereco: { logradouro: 'Av X', numero: '1', bairro: 'Centro', codigoMunicipio: '1507607', municipio: 'São Miguel do Guamá', uf: 'PA' },
    },
  };
}

test('XML: UF do veículo vai à tag (fallback = UF carregamento p/ legados)', () => {
  const B = loadBuilder();
  const comUf = B.buildMdfe(basePayload({ placa: 'IBG2314', uf: 'PA', tara: 9000 }));
  assert.match(comUf.xml, /<veicTracao><placa>IBG2314<\/placa>.*<UF>PA<\/UF><\/veicTracao>/);
  const semUf = B.buildMdfe(basePayload({ placa: 'IBG2314', tara: 9000 }));
  assert.match(semUf.xml, /<UF>PA<\/UF><\/veicTracao>/, 'fallback ufInicio (byte-idêntico ao anterior)');
  const invalida = B.buildMdfe(basePayload({ placa: 'IBG2314', uf: 'XX1', tara: 9000 }));
  assert.match(invalida.xml, /<UF>PA<\/UF><\/veicTracao>/, 'UF inválida cai no fallback');
});

test('XML: RNTRC NÃO é transmitido sem XSD p/ validar a posição (<prop>)', () => {
  const B = loadBuilder();
  const r = B.buildMdfe(basePayload({ placa: 'IBG2314', uf: 'PA', rntrc: '12345678', tara: 9000 }));
  assert.doesNotMatch(r.xml, /<prop>/, 'cStat 215 supera o benefício; RNTRC fica no registro + DAMDFE');
  assert.match(builderSrc, /RNTRC \(<prop>\) NÃO emitido/);
});

test('DAMDFE: placa/UF + RNTRC quando presentes; ausentes quando não', () => {
  const { internals } = loadDamdfe();
  const com = internals.mdfeDamdfeConteudo(
    { numero: '20', veiculo: { placa: 'IBG2314', uf: 'PA', rntrc: '12345678' }, documentos: [] }, {},
  );
  assert.ok(com.includes('IBG2314'));
  assert.ok(com.includes('<td>PA</td>'));
  assert.ok(com.includes('<td>12345678</td>'));
  const sem = internals.mdfeDamdfeConteudo({ numero: '20', veiculo: { placa: 'IBG2314' }, documentos: [] }, {});
  assert.ok(sem.includes('IBG2314'));
  assert.ok(sem.includes('<td>-</td>'), 'células vazias com "-" (padrão mercado)');
});

test('DAMDFE: logo só com fonte confiável (https/data:image)', () => {
  const { internals } = loadDamdfe();
  const base = { numero: '20', veiculo: {}, documentos: [] };
  const https = internals.mdfeDamdfeConteudo(base, { name: 'E', logoSrc: 'https://x.test/logo.png' });
  assert.match(https, /<img class="damdfe-logo" src="https:\/\/x\.test\/logo\.png"/);
  const data = internals.mdfeDamdfeConteudo(base, { name: 'E', logoSrc: 'data:image/png;base64,AAA' });
  assert.match(data, /<img class="damdfe-logo" src="data:image\/png;base64,AAA"/);
  for (const evil of ['javascript:alert(1)', 'data:text/html,<script>', '', undefined]) {
    const out = internals.mdfeDamdfeConteudo(base, { name: 'E', logoSrc: evil });
    assert.doesNotMatch(out, /<img class="damdfe-logo"/, `sem img p/ logoSrc=${String(evil)}`);
  }
  const semLogo = internals.mdfeDamdfeConteudo(base, { name: 'E' });
  assert.doesNotMatch(semLogo, /damdfe-logo"/);
});

test('empresa: IE + campos de logo normalizados (paridade DANFE)', () => {
  const { internals } = loadDamdfe();
  const n = internals.normalizeCompanyForMdfeReport({
    razaoSocial: 'JN', cnpj: '18615107000100', inscricaoEstadual: '151234567',
    logoUrl: 'https://x.test/l.png', logoStoragePath: 'empresas/1/logo.png',
  });
  assert.equal(n.ie, '151234567');
  assert.equal(n.logoUrl, 'https://x.test/l.png');
  assert.equal(n.logoStoragePath, 'empresas/1/logo.png');
  const n2 = internals.normalizeCompanyForMdfeReport({ nome: 'X', logo: 'data:image/png;base64,AAA' });
  assert.equal(n2.logoDataUrl, 'data:image/png;base64,AAA');
  assert.equal(n2.ie, '');
});

test('logo: resolver usa dataURL direto; vazio sem fonte', async () => {
  const { internals } = loadDamdfe();
  assert.equal(await internals.mdfeResolverLogoEmpresa({ logoDataUrl: 'data:image/png;base64,AAA' }), 'data:image/png;base64,AAA');
  assert.equal(await internals.mdfeResolverLogoEmpresa({}), '');
  assert.equal(await internals.mdfeResolverLogoEmpresa(null), '');
});

test('logo: resolver NÃO refaz busca central (cascata vive no obterDadosEmpresaMdfe)', async () => {
  const { internals } = loadDamdfe({
    firebaseService: {
      getCompanyProfileForReport: async () => ({ success: true, data: { nome: 'C', logoUrl: 'https://x.test/c.png' } }),
    },
  });
  assert.equal(await internals.mdfeResolverLogoEmpresa({ name: 'C' }), '', 'sem logo nos campos → vazio, sem chamada extra');
});

test('wiring S4: form + coleta + prefill + remember + CSS logo', () => {
  assert.match(html, /id="veiculoUf"/);
  assert.match(html, /id="veiculoRntrc"/);
  assert.match(js, /uf: String\(document\.getElementById\('veiculoUf'\)\?\.value/);
  assert.match(js, /rntrc: String\(document\.getElementById\('veiculoRntrc'\)\?\.value/);
  assert.match(js, /ufEl\.value = veiculoEdit\.uf \|\| ''/);
  assert.match(js, /rnEl\.value = veiculoEdit\.rntrc \|\| ''/);
  assert.match(js, /uf: String\(payload\?\.veiculo\?\.uf/);
  assert.match(js, /rntrc: String\(payload\?\.veiculo\?\.rntrc/);
  assert.match(js, /fillIfEmpty\('veiculoUf'/);
  assert.match(js, /fillIfEmpty\('veiculoRntrc'/);
  assert.match(js, /empresa\.logoSrc = await mdfeResolverLogoEmpresa\(empresa\)/);
  assert.match(js, /\.damdfe-logo\{flex:0 0 auto;max-width:22mm;max-height:18mm/);
});
