import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// P5 — Contingência SVC (NF-e mod 55). Padrão do repo: regex + extração vm.
// Fontes: XSD local (dhCont/xJust) > NFePHP Contingency.md + catálogo wsnfe
// (endpoints, UF→SVC) > código. MDF-e e NFC-e fora de escopo (travados aqui).
const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const nfConfig = readFileSync('nf-config.js', 'utf8');
const nfValidator = readFileSync('nf-validator.js', 'utf8');
const nfBuilder = readFileSync('nf-xml-builder.js', 'utf8');
const nfService = readFileSync('nf-service.js', 'utf8');
const mdfeBuilder = readFileSync('mdfe-xml-builder.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function extract(src, name, argsPattern) {
  const re = new RegExp(`function ${name}\\(${argsPattern}\\) \\{[\\s\\S]*?\\n(  )?\\}`);
  const match = src.match(re);
  assert.ok(match, `${name} não encontrada`);
  return match[0];
}

function load(names, src, consts = []) {
  // names: [[fnName, argsPattern], ...] — extrai na ordem (deps primeiro)
  // consts: ['SVC_POR_UF', ...] — consts de módulo referenciadas pelas funções
  const parts = [];
  for (const c of consts) {
    const m = src.match(new RegExp(`const ${c} = \\{[\\s\\S]*?\\n\\s*\\};`));
    assert.ok(m, `const ${c} não encontrada`);
    parts.push(m[0]);
  }
  const context = {};
  vm.runInNewContext(parts.join('\n') + '\n' + names.map(([n, a]) => extract(src, n, a)).join('\n') + '\n' + names.map(([n]) => `this.${n} = ${n};`).join('\n'), context);
  return context;
}

// ─── 1. Endpoints SVC exatos do catálogo ─────────────────────────────────────
test('SVC-AN: endpoints homolog/produção do catálogo wsnfe (bloco SVCAN)', () => {
  for (const url of [
    'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    'https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    'https://hom.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
    'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    'https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    'https://www.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
  ]) {
    assert.ok(nfFunctions.includes(url), `SVC-AN sem ${url}`);
  }
});

test('SVC-RS: endpoints homolog/produção do catálogo wsnfe (bloco SVCRS)', () => {
  for (const url of [
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  ]) {
    assert.ok(nfFunctions.includes(url), `SVC-RS sem ${url}`);
  }
});

// ─── 2. Mapa UF→SVC idêntico nos dois lados ──────────────────────────────────
test('SVC_POR_UF: backend e frontend concordam; 7 UFs do dossiê corretas', () => {
  const be = load([['resolverTipoSVC', 'uf, override']], nfFunctions, ['SVC_POR_UF']);
  const fe = load([['resolverTipoSVC', 'uf, override']], nfConfig, ['SVC_POR_UF']);
  const esperado = { PA: 'svc-rs', MT: 'mt', RO: 'svc-rs', AC: 'svc-rs', AM: 'am', AP: 'svc-rs', MA: 'svc-an' };
  for (const [uf, svc] of Object.entries(esperado)) {
    assert.equal(be.resolverTipoSVC(uf), svc, `backend ${uf}`);
    assert.equal(fe.resolverTipoSVC(uf), svc, `frontend ${uf}`);
  }
  assert.equal(be.resolverTipoSVC('pa'), 'SVC-AN', 'case-insensitive');
  assert.equal(be.resolverTipoSVC('PA', 'SVC-RS'), 'SVC-RS', 'override explícito vence');
  assert.equal(be.resolverTipoSVC('XX'), '', 'UF desconhecida não inventa');
  assert.equal(be.resolverTipoSVC('PA', 'EPEC'), 'SVC-AN', 'override inválido cai no mapa');
  assert.equal(ctx_fe_tp().tpEmisDeTipoSVC('SVC-AN'), '6');
  assert.equal(ctx_fe_tp().tpEmisDeTipoSVC('SVC-RS'), '7');
  assert.equal(ctx_fe_tp().tpEmisDeTipoSVC(''), '1');
});

function ctx_fe_tp() {
  return load([['tpEmisDeTipoSVC', 'tipo']], nfConfig);
}

// ─── 3. Validação de contingência ────────────────────────────────────────────
test('validarContingencia: desligada passa; ativa exige motivo 15–255', () => {
  const ctx = load([['validarContingencia', 'cont']], nfConfig);
  assert.equal(ctx.validarContingencia(null).valid, true);
  assert.equal(ctx.validarContingencia({ ativa: false }).valid, true);
  assert.equal(ctx.validarContingencia({ ativa: true, tipo: 'SVC-AN', motivo: 'curto' }).valid, false);
  assert.equal(ctx.validarContingencia({ ativa: true, tipo: 'EPEC', motivo: 'SEFAZ de origem fora do ar (falha técnica)' }).valid, false);
  assert.equal(ctx.validarContingencia({ ativa: true, tipo: '', motivo: 'SEFAZ de origem fora do ar (falha técnica)' }).valid, true);
});

// ─── 4. tpEmis/dhCont/xJust ──────────────────────────────────────────────────
test('validarTpEmis: 1/6/7; resto rejeitado; 6/7 só mod 55', () => {
  const ctx = load([['validarTpEmis', 'tpEmis, mod']], nfValidator);
  assert.equal(ctx.validarTpEmis(undefined, 55).tpEmis, '1');
  assert.equal(ctx.validarTpEmis('', 55).valid, true);
  assert.equal(ctx.validarTpEmis('6', 55).valid, true);
  assert.equal(ctx.validarTpEmis('7', 55).valid, true);
  for (const t of ['2', '4', '5', '8', '9', '0', 'x']) {
    assert.equal(ctx.validarTpEmis(t, 55).valid, false, `tpEmis ${t} rejeitado`);
  }
  assert.equal(ctx.validarTpEmis('6', 65).valid, false, 'SVC fora do mod 55');
  assert.equal(ctx.validarTpEmis('7', 65).valid, false, 'SVC fora do mod 55');
});

test('validarDhContXJust: só exige quando tpEmis ≠ 1', () => {
  const ctx = load([['validarDhContXJust', 'tpEmis, dhCont, xJust']], nfValidator);
  assert.equal(ctx.validarDhContXJust('1').valid, true);
  assert.equal(ctx.validarDhContXJust('1', '', '').valid, true);
  assert.equal(ctx.validarDhContXJust('6', '', '').valid, false);
  assert.equal(ctx.validarDhContXJust('6', '2026-10-15T10:00:00-03:00', 'curta').valid, false);
  assert.equal(ctx.validarDhContXJust('6', '15/10/2026', 'SEFAZ de origem fora do ar (falha técnica)').valid, false);
  assert.equal(
    ctx.validarDhContXJust('7', '2026-10-15T10:00:00-04:00', 'SEFAZ de origem fora do ar (falha técnica)').valid,
    true,
  );
});

// ─── 5. Chave e ide ─────────────────────────────────────────────────────────
test('gerarChave: dígito tpEmis na posição 34; DV válido; fora de escopo lança', () => {
  const ctx = load(
    [['getCUF', 'uf'], ['calcDV', 'chave43'], ['toBrasiliaDateTime', 'value'], ['gerarChave', 'emit, ide']],
    nfBuilder,
  );
  const emit = { cnpj: '11222333000181', endereco: { uf: 'PA' } };
  const base = { dhEmi: '2026-10-15T10:00:00-03:00', mod: 55, serie: 1, nNF: 123 };
  for (const [tpEmis, esperado] of [[undefined, '1'], ['1', '1'], ['6', '6'], ['7', '7']]) {
    const r = ctx.gerarChave(emit, { ...base, tpEmis });
    assert.equal(r.chave.length, 44, 'chave 44 dígitos');
    assert.equal(r.chave[34], esperado, `dígito tpEmis ${esperado}`);
    assert.equal(String(ctx.calcDV(r.chave.slice(0, 43))), String(r.chave[43]), 'DV confere');
  }
  assert.throws(() => ctx.gerarChave(emit, { ...base, tpEmis: '5' }), /fora de escopo/);
  assert.throws(() => ctx.gerarChave(emit, { ...base, mod: 65, tpEmis: '6' }), /modelo 55/);
});

test('buildIde: tpEmis do ide; dhCont/xJust só em contingência, após verProc', () => {
  const ctx = load(
    [
      ['esc', 'v'], ['getCUF', 'uf'], ['requireCodigoMunicipio', 'value, label'],
      ['toBrasiliaDateTime', 'value'], ['buildCompraGov', 'cg'], ['buildIde', 'ide, chaveInfo'],
    ],
    nfBuilder,
  );
  const ideBase = {
    ufEmit: 'PA', natOp: 'Venda', mod: 55, serie: 1, nNF: 1, dhEmi: '2026-10-15T10:00:00-03:00',
    tpNF: 1, idDest: 1, cMunFG: '1501402', tpImp: 1, tpAmb: 2, finNFe: 1, indFinal: 0, indPres: 0,
  };
  const chaveInfo = { cNF: '00000001', cDV: '0' };
  const normal = ctx.buildIde({ ...ideBase }, chaveInfo);
  assert.match(normal, /<tpEmis>1<\/tpEmis>/);
  assert.doesNotMatch(normal, /dhCont|xJust/, 'normal sem dhCont/xJust');
  const cont = ctx.buildIde({ ...ideBase, tpEmis: '6', dhCont: '2026-10-15T09:00:00-03:00', xJust: 'SEFAZ de origem fora do ar (falha técnica)' }, chaveInfo);
  assert.match(cont, /<tpEmis>6<\/tpEmis>/);
  assert.match(cont, /<dhCont>2026-10-15T09:00:00-03:00<\/dhCont><xJust>SEFAZ de origem fora do ar \(falha técnica\)<\/xJust>/);
  assert.ok(cont.indexOf('<verProc>') < cont.indexOf('<dhCont>'), 'dhCont após verProc (ordem XSD)');
  assert.ok(cont.indexOf('</xJust>') < cont.indexOf('</ide>'), 'xJust dentro do ide');
});

// ─── 6. Roteamento backend ───────────────────────────────────────────────────
test('getEndpoint roteia por tpEmis; 6 call sites passam tpEmis', () => {
  assert.match(nfFunctions, /function getEndpoint\(servico, ambiente, uf, tpEmis\)/);
  assert.match(nfFunctions, /resolverAmbienteSVC\(tpEmis\)/);
  for (const snippet of [
    "getEndpoint('NfeAutorizacao4', env, ufEmit, tpEmisEnvio)",
    "getEndpoint('NfeConsultaProtocolo4', env, undefined, tpEmisCons)",
    "getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisCanc)",
    "getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisCce)",
    "getEndpoint('NFeInutilizacao4', env, undefined, tpEmisInut)",
    "getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisRtc)",
  ]) {
    assert.ok(nfFunctions.includes(snippet), `roteado: ${snippet.slice(0, 50)}`);
  }
  assert.match(nfFunctions, /tpEmis:\s+tpEmisEnvio,\n\s+ambienteSefaz:/, 'patch persiste tpEmis/ambienteSefaz');
});

// ─── 7. Emissão e UI ─────────────────────────────────────────────────────────
test('emitirNFe injeta contingência da config antes de validar (nada muda desligado)', () => {
  assert.match(nfService, /const cont = _config && _config\.contingencia && _config\.contingencia\.ativa \? _config\.contingencia : null;/);
  assert.match(nfService, /nfeData\.ide\.tpEmis = tipo === 'SVC-RS' \? '7' : '6';/);
  assert.match(nfService, /nfeData\.ide\.dhCont = cont\.ativadaEm/);
  assert.match(nfService, /nfeData\.contingenciaSVC = \{ tipo, motivo/);
  assert.match(nfValidator, /const tpe = validarTpEmis\(ide\.tpEmis, ide\.mod\);/);
});

test('UI: painel config + persistência + confirm por emissão + tpEmis nos eventos', () => {
  for (const id of ['cfgContAtiva', 'cfgContTipo', 'cfgContMotivo', 'cfgContAtivadaEm', 'badgeContingencia']) {
    assert.ok(html.includes(`id="${id}"`), `config tem ${id}`);
  }
  assert.match(html, /Emitir em contingência/);
  assert.match(html, /tpEmis: nf\?\.ide\?\.tpEmis \|\| nf\?\.tpEmis/);
  assert.match(html, /tpEmis: tpEmisInut,/);
});

// ─── 8. Fora de escopo travado ───────────────────────────────────────────────
test('MDF-e e NFC-e fora da contingência SVC (sem mudança silenciosa)', () => {
  assert.match(mdfeBuilder, /<tpEmis>1<\/tpEmis>/, 'MDF-e segue tpEmis fixo');
  assert.doesNotMatch(mdfeBuilder, /SVC-AN|SVC-RS|dhCont/, 'MDF-e sem código SVC');
});
