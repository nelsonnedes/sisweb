import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import zlib from 'node:zlib';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const mdfeFunctions = readFileSync('functions/mdfe-functions.js', 'utf8');
const builder = readFileSync('mdfe-xml-builder.js', 'utf8');

function loadStripXmlDecl() {
  const match = nfFunctions.match(/function stripXmlDecl\(xml\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'stripXmlDecl não encontrada em functions/nf-functions.js');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.stripXmlDecl = stripXmlDecl;`, context);
  return context.stripXmlDecl;
}

test('MDF-e síncrono: mdfeDadosMsg = base64(gzip(XML sem declaração)), sem wrapper enviMDFe', () => {
  assert.match(
    mdfeFunctions,
    /const payload = require\('zlib'\)\.gzipSync\(Buffer\.from\(stripXmlDecl\(signedXml\), 'utf8'\)\)\.toString\('base64'\);/,
    'payload síncrono deve ser o XML (sem <?xml?>) comprimido e codificado',
  );
  assert.doesNotMatch(
    mdfeFunctions,
    /<enviMDFe/,
    'serviço síncrono não usa o wrapper enviMDFe (ref. NFePHP sefazEnviaLote indSinc=1)',
  );
  assert.match(nfFunctions, /exports\.__mdfeInternals = \{[\s\S]*stripXmlDecl,/);
  assert.match(mdfeFunctions, /^\s*stripXmlDecl,$/m);
});

test('UI: Tipo de Emitente e UFs do Percurso expostos e repassados à emissão', () => {
  const html = readFileSync('mdf-e.html', 'utf8');
  const js = readFileSync('mdf-e.js', 'utf8');
  assert.match(html, /id="mdfeTpEmit"/);
  assert.match(html, /2 — Transportador de Carga Própria/);
  assert.match(js, /tpEmit: parseInt\(document\.getElementById\('mdfeTpEmit'\)\?\.value \|\| '2', 10\)/);
  assert.match(html, /id="mdfePercursoUfs"/);
  assert.match(js, /percursoUfs: String\(document\.getElementById\('mdfePercursoUfs'\)/);
});

test('precedente NF-e permanece: enviNFe também usa stripXmlDecl', () => {
  assert.match(nfFunctions, /<enviNFe[^`]*<indSinc>1<\/indSinc>\$\{stripXmlDecl\(xmlAssinado\)\}<\/enviNFe>/);
});

test('stripXmlDecl remove declaração com espaços, é case-insensitive e idempotente', () => {
  const stripXmlDecl = loadStripXmlDecl();
  const doc = '<?xml version="1.0" encoding="UTF-8"?><MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"></MDFe>';
  assert.equal(stripXmlDecl(`  \n  ${doc}`), '<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"></MDFe>');
  assert.equal(stripXmlDecl('<?XML version="1.0"?><x/>'), '<x/>');
  assert.equal(stripXmlDecl('<x/>'), '<x/>');
  assert.equal(stripXmlDecl(stripXmlDecl(doc)), '<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"></MDFe>');
  assert.equal(stripXmlDecl(null), '');
  assert.doesNotMatch(stripXmlDecl(doc), /<\?xml/i);
});

test('XML real do builder: payload síncrono (base64+gzip) decodifica sem declaração', () => {
  const stripXmlDecl = loadStripXmlDecl();
  const context = { window: {} };
  vm.runInNewContext(builder, context);
  const result = context.window.MdfeXmlBuilder.buildMdfe({
    numero: 1,
    serie: '1',
    dataEmissao: '2026-08-27T10:00',
    ufInicio: 'SP',
    ufFim: 'RJ',
    municipioCarregamento: 'São Paulo',
    municipioDescarregamento: 'Rio de Janeiro',
    codigoMunicipioCarregamento: '3550308',
    codigoMunicipioDescarregamento: '3304557',
    veiculo: { placa: 'ABC1234', tara: 1000 },
    condutor: { nome: 'Motorista Teste', cpf: '11122233344' },
    documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 100,
    pesoTotal: 10,
    emit: {
      cnpj: '12345678000195',
      ie: '123456789',
      razaoSocial: 'Empresa Teste',
      endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '3550308', municipio: 'São Paulo', uf: 'SP' },
    },
  });
  assert.match(result.xml, /^<\?xml version="1\.0" encoding="UTF-8"\?><MDFe\b/);
  assert.match(result.xml, /<serie>1<\/serie>/, 'TSerie sem zero à esquerda (cStat 215)');
  assert.doesNotMatch(result.xml, /<serie>00?1<\/serie>/);
  assert.match(result.xml, /<nMDF>1<\/nMDF>/, 'TNF sem zero à esquerda (cStat 215)');
  assert.doesNotMatch(result.xml, /<nMDF>0+1<\/nMDF>/);
  assert.match(result.xml, /<tpEmit>2<\/tpEmit>/, 'default carga própria evita cStat 698 (seguro obrigatório de prestador)');
  const comPrestador = context.window.MdfeXmlBuilder.buildMdfe({
    numero: 2,
    serie: '1',
    dataEmissao: '2026-08-27T10:00',
    tpEmit: 1,
    ufInicio: 'SP',
    ufFim: 'RJ',
    municipioCarregamento: 'São Paulo',
    municipioDescarregamento: 'Rio de Janeiro',
    codigoMunicipioCarregamento: '3550308',
    codigoMunicipioDescarregamento: '3304557',
    veiculo: { placa: 'ABC1234', tara: 1000 },
    condutor: { nome: 'Motorista Teste', cpf: '11122233344' },
    documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 100,
    pesoTotal: 10,
    emit: {
      cnpj: '12345678000195',
      ie: '123456789',
      razaoSocial: 'Empresa Teste',
      endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '3550308', municipio: 'São Paulo', uf: 'SP' },
    },
  });
  assert.match(comPrestador.xml, /<tpEmit>1<\/tpEmit>/);
  // infPercurso (cStat 663): obrigatório p/ UFFim não limítrofe; dedupe e
  // filtro de UFIni/UFFim/vazios aplicados pelo builder.
  const comPercurso = context.window.MdfeXmlBuilder.buildMdfe({
    numero: 3,
    serie: '1',
    dataEmissao: '2026-08-27T10:00',
    ufInicio: 'PA',
    ufFim: 'BA',
    percursoUfs: ['TO', 'to', 'PA', 'BA', '', 'XX'],
    municipioCarregamento: 'São Miguel do Guamá',
    municipioDescarregamento: 'Irecê',
    codigoMunicipioCarregamento: '1507607',
    codigoMunicipioDescarregamento: '2914604',
    veiculo: { placa: 'ABC1234', tara: 1000 },
    condutor: { nome: 'Motorista Teste', cpf: '11122233344' },
    documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 100,
    pesoTotal: 10,
    emit: {
      cnpj: '12345678000195',
      ie: '123456789',
      razaoSocial: 'Empresa Teste',
      endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '1507607', municipio: 'São Miguel do Guamá', uf: 'PA' },
    },
  });
  assert.match(comPercurso.xml, /<infPercurso><UFPer>TO<\/UFPer><\/infPercurso>/);
  assert.equal((comPercurso.xml.match(/<UFPer>/g) || []).length, 1, 'dedupe + filtro UFIni/UFFim/inválidas');
  assert.doesNotMatch(comPercurso.xml, /<UFPer>TO<\/UFPer><UFPer>/, 'UFPer nunca repetido no mesmo grupo (cStat 215)');
  // Grupo REPETE por UF: 2 UFs → 2 grupos <infPercurso>, um <UFPer> em cada
  const multiPercurso = context.window.MdfeXmlBuilder.buildMdfe({
    numero: 4,
    serie: '1',
    dataEmissao: '2026-08-27T10:00',
    ufInicio: 'PA',
    ufFim: 'BA',
    percursoUfs: ['MA', 'PI', 'CE', 'PE'],
    municipioCarregamento: 'São Miguel do Guamá',
    municipioDescarregamento: 'Irecê',
    codigoMunicipioCarregamento: '1507607',
    codigoMunicipioDescarregamento: '2914604',
    veiculo: { placa: 'ABC1234', tara: 1000 },
    condutor: { nome: 'Motorista Teste', cpf: '11122233344' },
    documentos: [{ chave: '1'.repeat(44) }],
    valorTotal: 100,
    pesoTotal: 10,
    emit: {
      cnpj: '12345678000195',
      ie: '123456789',
      razaoSocial: 'Empresa Teste',
      endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', codigoMunicipio: '1507607', municipio: 'São Miguel do Guamá', uf: 'PA' },
    },
  });
  assert.match(
    multiPercurso.xml,
    /<infPercurso><UFPer>MA<\/UFPer><\/infPercurso><infPercurso><UFPer>PI<\/UFPer><\/infPercurso><infPercurso><UFPer>CE<\/UFPer><\/infPercurso><infPercurso><UFPer>PE<\/UFPer><\/infPercurso>/,
  );
  assert.equal((multiPercurso.xml.match(/<infPercurso>/g) || []).length, 4);
  const posMun = comPercurso.xml.indexOf('</infMunCarrega>');
  const posPer = comPercurso.xml.indexOf('<infPercurso>');
  const posFimIde = comPercurso.xml.indexOf('</ide>');
  assert.ok(posMun < posPer && posPer < posFimIde, 'infPercurso após infMunCarrega e dentro de ide');
  assert.doesNotMatch(result.xml, /<infPercurso>/, 'sem UFs informadas não emite o grupo');
  // QR Code obrigatório (cStat 480) — formato do schema oficial (NT 2025.001).
  // No documento o separador é &amp;; o texto resolve para & (regex do schema).
  assert.match(
    result.xml,
    /<infMDFeSupl><qrCodMDFe>https:\/\/dfe-portal\.svrs\.rs\.gov\.br\/mdfe\/qrCode\?chMDFe=\d{44}&amp;tpAmb=2<\/qrCodMDFe><\/infMDFeSupl>/,
  );
  assert.doesNotMatch(result.xml, /chMDFe=\d{44}&tpAmb/, '& cru quebra a boa-formação (cStat 244)');
  assert.match(
    result.xml.match(/<qrCodMDFe>([^<]+)<\/qrCodMDFe>/)[1],
    /^https?:\/\/.+\?chMDFe=[0-9]{6}[A-Z0-9]{12}[0-9]{26}&amp;tpAmb=[1-2]$/,
    'formato exigido pelo schema do qrCodMDFe',
  );
  assert.ok(
    result.xml.indexOf('</infMDFe>') < result.xml.indexOf('<infMDFeSupl>')
      && result.xml.indexOf('<infMDFeSupl>') < result.xml.indexOf('</MDFe>'),
    'infMDFeSupl é irmão de infMDFe dentro de MDFe (PL_MDFe_300b)',
  );
  assert.doesNotMatch(
    result.xml,
    /<CEP>/,
    'enderEmit do MDF-e 3.00 não possui CEP (evidência: cStat 215 da SEFAZ — filhos esperados: fone, email)',
  );
  const stripped = stripXmlDecl(result.xml);
  assert.match(stripped, /^<MDFe\b/);
  const payload = zlib.gzipSync(Buffer.from(stripped, 'utf8')).toString('base64');
  assert.match(payload, /^[A-Za-z0-9+/=]+$/);
  const decoded = zlib.gunzipSync(Buffer.from(payload, 'base64')).toString('utf8');
  assert.equal(decoded, stripped);
  assert.match(decoded, /^<MDFe\b/);
  assert.doesNotMatch(decoded, /<\?xml/i);
});
