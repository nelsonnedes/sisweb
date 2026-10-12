import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// YA03-30 (cStat 904, NT 2017.002 / MOC Anexo I):
// tPag 90 (Sem pagamento) ou 91 com vPag<>0 →
// "Rejeicao: Informado indevidamente campo valor de pagamento".
const src = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', src + '; return window.NFXmlBuilder;')({ window: {} }, console);

function nfeBase(pag) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '1', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA', numero: '2', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det: [{ cProd: '1', xProd: 'PRODUTO', ncm: '94036000', cfop: '5102', uCom: 'UN', qCom: 1, vUnCom: 100, vProd: 100,
      imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '07' }, cofins: { cST: '07' } } }],
    transp: { modFrete: 9 },
    pag, infAdic: '', desconto: 0, frete: 0,
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  return B.buildNFeXML(nfe).xml;
}

test('tPag 90 com vPag>0 é zerado (cStat 904)', () => {
  const xml = nfeBase([{ tPag: '90', vPag: 100 }]);
  assert.match(xml, /<detPag><tPag>90<\/tPag><vPag>0\.00<\/vPag><\/detPag>/, 'vPag zerado');
  assert.doesNotMatch(xml, /<tPag>90<\/tPag><vPag>(?!0\.00)/, 'nenhum vPag<>0 com 90');
});

test('tPag 91 com vPag>0 é zerado (cStat 904)', () => {
  const xml = nfeBase([{ tPag: '91', vPag: 50 }]);
  assert.match(xml, /<detPag><tPag>91<\/tPag><vPag>0\.00<\/vPag><\/detPag>/, 'vPag zerado');
});

test('tPag com cobrança mantém vPag (01/03/04/17/99)', () => {
  for (const tPag of ['01', '02', '03', '04', '17', '99']) {
    const xml = nfeBase([{ tPag, vPag: 100 }]);
    assert.match(xml, new RegExp(`<detPag><tPag>${tPag}<\\/tPag><vPag>100\\.00<\\/vPag><\\/detPag>`), `tPag ${tPag}: vPag mantido`);
  }
});

test('pag ausente mantém fallback 01/0.00', () => {
  const xml = nfeBase(undefined);
  assert.match(xml, /<detPag><tPag>01<\/tPag><vPag>0\.00<\/vPag><\/detPag>/, 'fallback intacto');
});
