import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');

function loadInternals() {
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

test('alerta persistente: markup + funções + wiring nos fluxos principais', () => {
  assert.match(html, /id="emissaoAlertaMdfe" hidden/);
  assert.match(html, /#emissaoAlertaMdfe \.sw-msg-close/);
  assert.match(js, /function mdfeMostrarAlerta\(msg, tipo = 'erro'\)/);
  assert.match(js, /function mdfeOcultarAlertaMdfe\(\)/);
  // Emissão: progresso, rejeição e sucesso usam o banner (não só toast)
  assert.match(js, /mdfeMostrarAlerta\('⏳ Emitindo MDF-e — aguardando retorno da SEFAZ\.\.\.', 'warn'\)/);
  assert.match(js, /mdfeMostrarAlerta\(`MDF-e Nº \$\{payload\.numero\} — \$\{String\(payload\.status\)\.toUpperCase\(\)\} \(cStat \$\{payload\.cStat \|\| '\?'\}\): \$\{payload\.xMotivo \|\| 'retorno sem autorização'\}`, 'erro'\)/);
  assert.match(js, /mdfeMostrarAlerta\(`MDF-e Nº \$\{payload\.numero\} AUTORIZADO — Protocolo: \$\{payload\.protocolo \|\| 'não informado'\}`, 'ok'\)/);
  // Encerramento (form e rápido) e consulta usam o banner
  assert.match(js, /mdfeMostrarAlerta\('MDF-e encerrado com sucesso! Protocolo: ' \+ \(mdfe\.protocoloEncerramento \|\| 'não informado'\), 'ok'\)/);
  assert.match(js, /mdfeMostrarAlerta\('MDF-e encerrado com sucesso!', 'ok'\)/);
  assert.match(js, /mdfeMostrarAlerta\('⏳ Consultando o MDF-e na SEFAZ — aguardando retorno\.\.\.', 'warn'\)/);
  assert.match(js, /Situação real: \$\{situacaoTxt\}/);
});

test('detalhes do status: modal + pill clicável (paridade com NF-e)', () => {
  assert.match(js, /function mdfeInfoDetalheModal\(titulo, linhas, acoes = \[\]\)/);
  assert.match(js, /function mdfeMostrarDetalheStatus\(id\)/);
  assert.match(js, /onclick="mdfeMostrarDetalheStatus\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)" title="Ver detalhes do status"/);
  for (const campo of ['cStat', 'Motivo \\(SEFAZ\\)', 'Protocolo de encerramento', 'Data de encerramento', 'Erro de comunicação', 'Chave de acesso']) {
    assert.match(js, new RegExp(`\\['${campo}'`), `campo ausente: ${campo}`);
  }
  assert.match(js, /window\.mdfeMostrarDetalheStatus = mdfeMostrarDetalheStatus;/);
  // Copiar chave e atalho de encerrar no modal
  assert.match(js, /label: '🔑 Copiar chave'/);
  assert.match(js, /label: '✅ Encerrar MDF-e'/);
});

test('paginação da Consulta MDF-e (10/25/50/100 persistido por tenant+uid)', () => {
  assert.match(js, /const MDFE_CONSULTA_PAGE_SIZE_OPTIONS = \[10, 25, 50, 100\];/);
  assert.match(js, /function mdfeConsultaPageSize\(\)/);
  assert.match(js, /function mdfeConsultaSetPageSize\(value\)/);
  assert.match(js, /function mdfeConsultaMudarPagina\(page\)/);
  assert.match(js, /function renderizarTabelaMdfesPaginada\(\)/);
  assert.match(js, /function renderizarPaginacaoConsultaMdfe\(totalItems, paginaAtual, pageSize\)/);
  assert.match(js, /__mdfeConsultaFiltrados\.slice\(inicio, inicio \+ size\)/);
  assert.match(js, /Pág\. \$\{paginaAtual\}\/\$\{totalPaginas\} · \$\{totalItems\} MDF-e\(s\)/);
  assert.match(js, /window\.mdfeConsultaSetPageSize = mdfeConsultaSetPageSize;/);
  assert.match(js, /window\.mdfeConsultaMudarPagina = mdfeConsultaMudarPagina;/);
  assert.match(html, /id="paginacaoConsultaMdfe" class="nf-pagination-bar"/);
  assert.match(html, /\.nf-pagination-bar \.pagination-page-buttons button\.active/);
});

test('import: transportador PF vira condutor e últimos dados completam o resto', () => {
  assert.match(js, /transportaNome: String\(nota\?\.transp\?\.transporta\?\.xNome \|\| nota\?\.transp\?\.transporta\?\.nome \|\| ''\)/);
  assert.match(js, /transportaCpf: mdfeDigits\(nota\?\.transp\?\.transporta\?\.CPF \|\| nota\?\.transp\?\.transporta\?\.cpf\)/);
  assert.match(js, /condutor: \{ nome: '', cpf: '' \}/);
  assert.match(js, /if \(!resumo\.condutor\.cpf && nota\.transportaCpf && nota\.transportaCpf\.length === 11 && nota\.transportaNome\)/);
  assert.match(js, /condutorCpfEl\.value = formatarCPF\(resumo\.condutor\.cpf\)/);
  assert.match(js, /function mdfeSalvarUltimoVeiculoCondutor\(payload\)/);
  assert.match(js, /function mdfePreencherUltimoVeiculoCondutor\(\)/);
  assert.match(js, /mdfeSalvarUltimoVeiculoCondutor\(payload\);/, 'save hook no emitirMdfe');
  const usosFill = js.match(/mdfePreencherUltimoVeiculoCondutor\(\);/g) || [];
  assert.ok(usosFill.length >= 2, `fill na carga da página + pós-import (achei ${usosFill.length})`);
});

test('funcional: nota com transporta PF → condutor no resumo (CNPJ não vira condutor)', () => {
  const { mdfeNormalizarNFeImportacao, mdfeResumoImportacao } = loadInternals();
  const base = {
    status: 'autorizada', numero: '000000200', chave: '9'.repeat(44),
    total: { vNF: 100 },
    dest: { nome: 'CLIENTE', endereco: { municipio: 'Belém', uf: 'PA' } },
    emit: { endereco: { municipio: 'São Miguel do Guamá', uf: 'PA' } },
  };
  const pf = mdfeNormalizarNFeImportacao({
    a: { ...base, transp: { transporta: { xNome: 'Motorista Jose', CPF: '111.444.777-35' }, veicTransp: { placa: 'ABC1D23', UF: 'PA' } } },
  });
  assert.equal(pf.length, 1);
  assert.equal(pf[0].transportaNome, 'Motorista Jose');
  assert.equal(pf[0].transportaCpf, '11144477735');
  assert.equal(pf[0].ufPlaca, 'PA');
  const r1 = mdfeResumoImportacao(pf);
  assert.equal(r1.condutor.nome, 'Motorista Jose');
  assert.equal(r1.condutor.cpf, '11144477735');
  assert.equal(r1.placa, 'ABC1D23');

  const pj = mdfeNormalizarNFeImportacao({
    b: { ...base, numero: '000000201', transp: { transporta: { xNome: 'TRANSPORTADORA LTDA', CNPJ: '10709881000178' } } },
  });
  const r2 = mdfeResumoImportacao(pj);
  assert.equal(r2.condutor.nome, '', 'transportador PJ (CNPJ) não vira condutor');
  assert.equal(r2.condutor.cpf, '');
});

test('Consulta nasce povoada: init chama consultarMdfes (paridade NF-e)', () => {
  const init = js.match(/carregarDados\(\)\.then\(\(\) => \{[\s\S]*?\n    \}\);/);
  assert.ok(init, 'bloco de init deve existir');
  assert.match(init[0], /atualizarDashboard\(\);/);
  assert.match(init[0], /definirProximoNumeroMdfe\(\);/);
  assert.match(init[0], /try \{ consultarMdfes\(\); \} catch \(\_\) \{\}/);
});
