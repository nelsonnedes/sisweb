import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Onda 3 (auditoria A13/A14/A16/A7/A9/A11/A17): completude.
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const builderSrc = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', tablesSrc + '\n' + validatorSrc + '; return window.NFValidator;')({ window: {} }, console);
const cfgSrc = fs.readFileSync('nf-config.js', 'utf8');
const cfgWin = {};
new Function('window', 'console', 'localStorage', 'structuredClone', cfgSrc)(cfgWin, console, { getItem: () => null, setItem: () => {} }, structuredClone);
const C = cfgWin.NFConfigService;
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

function itemBase(icms = { csosn: '102' }) {
  return {
    cProd: '1', xProd: 'PROD', ncm: '94036000', cfop: '5102', uCom: 'UN',
    qCom: 1, vUnCom: 100, vProd: 100,
    imposto: {
      icms, pis: { cST: '07' }, cofins: { cST: '07' },
      ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0, pIBSMun: 0, pCBS: 0 },
    },
  };
}
function nfeBase(det, crt = 1, extra = {}) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }],
    ...extra,
  };
  nfe.total = B.calcularTotais(det, 0, 0);
  return nfe;
}

test('A13: FCP opcional nos ramos + totais reais', () => {
  const it = itemBase({ cst: '00' });
  it.imposto.icms = { cst: '00', vBC: 100, pICMS: 18, vICMS: 18, vBCFCP: 100, pFCP: 2, vFCP: 2 };
  const n = nfeBase([it], 3);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<vBCFCP>100\.00<\/vBCFCP><pFCP>2\.0000<\/pFCP><vFCP>2\.00<\/vFCP><\/ICMS00>/);
  assert.match(xml, /<vFCP>2\.00<\/vFCP>\s*<vBCST>/, 'total vFCP real (não mais 0.00 fixo)');
  assert.equal(n.total.vFCP, 2);
});

test('A14: config morta difal removida', () => {
  assert.ok(!/^\s*difal:\s*\{/m.test(cfgSrc), 'sem default difal');
  assert.match(cfgSrc, /Onda 3b/);
});

test('A16: cobr/dup no XML + parcelas na UI', () => {
  const n = nfeBase([itemBase()], 1, { cobr: { dup: [{ nDup: '001', dVenc: '2026-11-10', vDup: 50 }, { nDup: '002', dVenc: '2026-12-10', vDup: 50 }] } });
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<cobr><dup><nDup>001<\/nDup><dVenc>2026-11-10<\/dVenc><vDup>50\.00<\/vDup><\/dup><dup><nDup>002<\/nDup>/);
  assert.ok(html.includes('id="nfParcelasLista"'), 'lista de parcelas existe');
  assert.ok(html.includes('nfAdicionarParcela'), 'adicionar parcela existe');
  const n2 = nfeBase([itemBase()], 1);
  assert.doesNotMatch(B.buildNFeXML(n2).xml, /<cobr>/, 'sem parcelas = sem cobr');
});

test('A7: indIEDest explícito (1 exige IE; 2 alcançável)', () => {
  const base = {
    nome: 'CLIENTE TESTE', cnpj: '11222333000181',
    endereco: { logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', uf: 'SP', cep: '01001000', codigoMunicipio: '3550308' },
  };
  const ok1 = { ...base, indIEDest: '1', ie: '123456789' };
  assert.equal(V.validarDestinatario(ok1).valid, true, JSON.stringify(V.validarDestinatario(ok1).errors));
  const semIE = { ...ok1, ie: '' };
  assert.match(V.validarDestinatario(semIE).errors.join('|'), /exige Inscrição Estadual/);
  const isento = { ...ok1, indIEDest: '2', ie: '' };
  assert.equal(V.validarDestinatario(isento).valid, true, JSON.stringify(V.validarDestinatario(isento).errors));
  assert.ok(html.includes('id="nfIndIEDest"'), 'select indIEDest existe');
});

test('A9: revisão exibe códigos fiscais por item', () => {
  assert.match(html, /Fiscal por item \(A9\)/);
  assert.ok(html.includes('IBS/CBS ${im.ibscbs.cst}'), 'linha IBS por item');
  assert.ok(html.includes('PIS/COFINS ${im.pis'), 'linha PIS/COFINS por item');
});

test('A11: importado → 4% interestadual (opts retrocompatível)', () => {
  const a = C.calcularICMS({ empresa: { regime: 'lucroReal' }, impostos: { icms: {} } }, 'SP', 'BA', 100);
  assert.equal(a.pICMS, 7);
  const b = C.calcularICMS({ empresa: { regime: 'lucroReal' }, impostos: { icms: {} } }, 'SP', 'BA', 100, { importado: true });
  assert.equal(b.pICMS, 4);
  const c = C.calcularICMS({ empresa: { regime: 'lucroReal' }, impostos: { icms: {} } }, 'SP', 'BA', 100);
  assert.equal(c.pICMS, 7, 'sem opts mantém comportamento');
  assert.ok(html.includes('id="itemImportado"'), 'checkbox importado manual');
  assert.ok(html.includes('id="itemImportadoCad"'), 'checkbox importado cadastrado');
});

test('A17: card no detPag + aviso sem cAut', () => {
  const n = nfeBase([itemBase()], 1);
  n.pag = [{ tPag: '03', vPag: 100, card: { tpIntegra: '2', CNPJ: '11222333000181', tBand: 'VISA', cAut: '123456' } }];
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<detPag><tPag>03<\/tPag><vPag>100\.00<\/vPag><card><tpIntegra>2<\/tpIntegra><CNPJ>11222333000181<\/CNPJ><tBand>VISA<\/tBand><cAut>123456<\/cAut><\/card><\/detPag>/);
  assert.ok(html.includes('id="nfCardGroup"'), 'bloco cartão existe');
  assert.match(html, /sem código de autorização \(cAut\)/, 'aviso sem cAut');
});
