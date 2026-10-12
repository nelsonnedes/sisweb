import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// SEFAZ (cStat 225): campos TString só aceitam Latin-1 (padrão [!-ÿ]).
const src = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', src + '; return window.NFXmlBuilder;')({ window: {} }, console);

test('Textos são sanitizados para Latin-1 (sem caracteres Unicode — cStat 225)', () => {
  const nfe = {
    emit: { cnpj: '18615107000100', razaoSocial: 'EMPRESA — TESTE', ie: '154190837', crt: 3,
      endereco: { uf: 'PA', codigoMunicipio: '1506807', logradouro: 'RUA “A”', numero: '1', bairro: 'CENTRO', municipio: 'SAO MIGUEL', cep: '68660000' } },
    dest: { nome: 'JOSE RIBAMAR MANICOBA CAVALCANTE — 10.709.881/0001-78', cnpj: '10709881000178', indIEDest: 9,
      endereco: { uf: 'BA', codigoMunicipio: '2910701', logradouro: 'AVENIDA', numero: '355', bairro: 'CENTRO', municipio: 'IRECE', cep: '44904000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 1, cMunFG: '1506807', mod: 55 },
    det: [{ cProd: '1', xProd: 'MADEIRA “SERRADA”', ncm: '44079990', cfop: '5102', uCom: 'M3', qCom: 1, vUnCom: 13.35, vProd: 13.35,
      imposto: { icms: { cst: '00', vBC: 13.35, pICMS: 12, vICMS: 1.6 }, pis: { cST: '07' }, cofins: { cST: '07' } } }],
    transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 13.35 }], infAdic: '', desconto: 0, frete: 0,
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  const { xml } = B.buildNFeXML(nfe);
  assert.doesNotMatch(xml, /[\u0100-\uFFFF]/, 'não pode haver caracteres fora do Latin-1');
  assert.match(xml, /JOSE RIBAMAR MANICOBA CAVALCANTE - 10\.709\.881\/0001-78/, 'em dash normalizado para hífen');
});
