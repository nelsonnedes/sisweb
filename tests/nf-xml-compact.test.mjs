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
