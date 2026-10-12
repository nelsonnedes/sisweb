import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// qVol é inteiro no leiaute (vol/qVol: pattern [0-9]{1,15} — nº de volumes).
// Decimal (ex. "0,010" m³, que pertence ao item qCom) nunca pode virar "0010".
const src = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', src + '; return window.NFXmlBuilder;')({ window: {} }, console);

function nfeBase(vol) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '1', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA', numero: '2', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det: [{ cProd: '1', xProd: 'PRODUTO', ncm: '44079990', cfop: '5102', uCom: 'M3', qCom: 0.01, vUnCom: 1335, vProd: 13.35,
      imposto: { icms: { cst: '00', vBC: 13.35, pICMS: 12, vICMS: 1.6 }, pis: { cST: '07' }, cofins: { cST: '07' } } }],
    transp: { modFrete: 1, vol: [vol] },
    pag: [{ tPag: '01', vPag: 13.35 }], infAdic: '', desconto: 0, frete: 0,
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  return B.buildNFeXML(nfe).xml;
}

test('qVol inteiro é emitido (<qVol>10</qVol>)', () => {
  const xml = nfeBase({ qVol: '10', esp: 'Madeira', marca: 'Serrada', pesoL: 100, pesoB: 100 });
  assert.match(xml, /<vol><qVol>10<\/qVol>/, 'qVol preservado');
});

test('qVol decimal é omitido, nunca corrompido para "0010"', () => {
  const xml = nfeBase({ qVol: '0,010', esp: 'Madeira' });
  assert.doesNotMatch(xml, /<qVol>/, 'sem tag qVol');
  assert.doesNotMatch(xml, /0010<\/qVol>/, 'sem corrupção 0010');
  assert.match(xml, /<esp>Madeira<\/esp>/, 'restante do volume intacto');
});

test('qVol vazio é omitido', () => {
  const xml = nfeBase({ qVol: '', esp: 'Madeira' });
  assert.doesNotMatch(xml, /<qVol>/, 'sem tag qVol');
});

test('service mantém veicTransp/reboque no objeto (DANFE/reedição); filtro X02-20 fica só no builder', () => {
  const svc = fs.readFileSync('nf-service.js', 'utf8');
  assert.doesNotMatch(svc, /delete transp\.veicTransp/, 'sem delete veicTransp');
  assert.doesNotMatch(svc, /delete transp\.reboque/, 'sem delete reboque');
  assert.match(src, /semVeicReboque/, 'buildTransp ainda filtra por idDest no XML');
});

test('validador recusa qVol decimal com mensagem orientadora', () => {
  const val = fs.readFileSync('nf-validator.js', 'utf8');
  assert.match(val, /quantidade em m³ vai no item/, 'mensagem orientadora presente');
  assert.doesNotMatch(val, /String\(vol\.qVol \|\| ''\)\.replace\(\\D/, 'sem strip silencioso');
});
