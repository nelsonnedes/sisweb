import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// SEFAZ rejeita "caracteres de edição" entre tags (cStat 588).
const src = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', src + '; return window.NFXmlBuilder;')({ window: {} }, console);

test('XML da NF-e é compacto (sem whitespace entre tags — cStat 588)', () => {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '1', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA', numero: '2', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det: [{ cProd: '1', xProd: 'PRODUTO', ncm: '94036000', cfop: '5102', uCom: 'UN', qCom: 1, vUnCom: 100, vProd: 100,
      imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '07' }, cofins: { cST: '07' } } }],
    transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }], infAdic: '', desconto: 0, frete: 0,
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  const { xml } = B.buildNFeXML(nfe);
  assert.doesNotMatch(xml, />\s+</, 'não pode haver whitespace entre tags');
  assert.doesNotMatch(xml, /^\s|\s$/, 'sem whitespace no início/fim');
});

function nfeBase(transp, idDest) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '1', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA', numero: '2', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55, idDest },
    det: [{ cProd: '1', xProd: 'PRODUTO', ncm: '94036000', cfop: '5102', uCom: 'UN', qCom: 1, vUnCom: 100, vProd: 100,
      imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '07' }, cofins: { cST: '07' } } }],
    transp,
    pag: [{ tPag: '01', vPag: 100 }], infAdic: '', desconto: 0, frete: 0,
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  return B.buildNFeXML(nfe).xml;
}

const transpCheio = (mf) => ({
  modFrete: mf,
  transporta: { CNPJ: '11222333000181', xNome: 'TRANSP' },
  veicTransp: { placa: 'ABC1234', UF: 'SP' },
  reboque: [{ placa: 'XYZ9876', UF: 'SP' }],
});

test('modFrete 9 omite transporta/veicTransp/reboque (X03-30)', () => {
  const xml = nfeBase({ modFrete: 9,
    transporta: { CNPJ: '11222333000181', xNome: 'TRANSP' },
    veicTransp: { placa: 'ABC1234', UF: 'SP' },
    reboque: [{ placa: 'XYZ9876', UF: 'SP' }] });
  assert.match(xml, /<transp><modFrete>9<\/modFrete>/, 'só modFrete');
  assert.doesNotMatch(xml, /<transporta>/, 'sem transporta');
  assert.doesNotMatch(xml, /<veicTransp>/, 'sem veicTransp');
  assert.doesNotMatch(xml, /<reboque>/, 'sem reboque');
});

test('idDest 2 omite veicTransp/reboque mas mantém transporta (X02-20/868)', () => {
  const t = {
    modFrete: 1,
    transporta: { CNPJ: '11222333000181', xNome: 'TRANSP' },
    veicTransp: { placa: 'ABC1234', UF: 'SP' },
    reboque: [{ placa: 'XYZ9876', UF: 'SP' }],
  };
  const xml = nfeBase(t, 2);
  assert.match(xml, /<transporta>/, 'com transporta');
  assert.doesNotMatch(xml, /<veicTransp>/, 'sem veicTransp');
  assert.doesNotMatch(xml, /<reboque>/, 'sem reboque');
});

test('idDest 1 mantém transporta/veicTransp/reboque', () => {
  const t = {
    modFrete: 1,
    transporta: { CNPJ: '11222333000181', xNome: 'TRANSP' },
    veicTransp: { placa: 'ABC1234', UF: 'SP' },
    reboque: [{ placa: 'XYZ9876', UF: 'SP' }],
  };
  const xml = nfeBase(t, 1);
  assert.match(xml, /<transporta>/, 'com transporta');
  assert.match(xml, /<veicTransp>/, 'com veicTransp');
  assert.match(xml, /<reboque>/, 'com reboque');
});
