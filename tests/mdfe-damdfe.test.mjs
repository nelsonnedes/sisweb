import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');

function loadDamdfe() {
  const context = {
    window: {},
    document: { addEventListener() {}, getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeDamdfeInternals;
  assert.ok(internals, '__mdfeDamdfeInternals deve existir');
  return internals;
}

const EMPRESA = { name: 'JN Madeiras', cnpj: '00.000.000/0001-91', address: 'Rua X', city: 'Belém', state: 'PA', phone: '91 9999-9999' };
const MDFE = {
  id: 'abc', numero: '000000020', serie: '1', dataEmissao: '2026-10-16T10:00:00',
  ufInicio: 'PA', municipioCarregamento: 'Belém', ufFim: 'MT', municipioDescarregamento: 'Sinop',
  percursoUfs: ['TO', 'GO'], veiculo: { placa: 'ABC1D23', renavam: '123', tara: 8000, capacidade: 25000 },
  condutor: { nome: 'Zé', cpf: '12345678909', cnh: '999' }, status: 'autorizado',
  documentos: [
    { chave: '1'.repeat(44), valor: 1000.5, peso: 500.25, nfeNumero: '1715', nfeSerie: '1' },
    { chave: '2'.repeat(44), valor: 200, peso: 100 },
  ],
  valorTotal: 1200.5, pesoTotal: 600.25, chaveAcesso: '3'.repeat(44), protocolo: '915260000005061',
  observacoes: 'teste',
};

test('ordenação: nº desc (mais recente primeiro)', () => {
  const { mdfeOrdenarPorNumeroDesc } = loadDamdfe();
  const lista = [{ numero: '000000019' }, { numero: '000000021' }, { numero: '000000020' }];
  assert.deepEqual(lista.sort(mdfeOrdenarPorNumeroDesc).map((m) => m.numero), ['000000021', '000000020', '000000019']);
  assert.deepEqual([{ numero: undefined }, { numero: '5' }].sort(mdfeOrdenarPorNumeroDesc).map((m) => m.numero), ['5', undefined]);
});

test('DAMDFE: só dados do registro + emitente, sem undefined', () => {
  const { mdfeDamdfeConteudo } = loadDamdfe();
  const htmlOut = mdfeDamdfeConteudo(MDFE, EMPRESA);
  for (const esperado of ['000000020', 'JN Madeiras', 'ABC1D23', 'Zé', '1715', '915260000005061', '1'.repeat(44), 'R$ 1.200,50', '600,250 kg', 'Sinop']) {
    assert.ok(htmlOut.includes(esperado), `deve conter: ${esperado.slice(0, 20)}`);
  }
  assert.doesNotMatch(htmlOut, /undefined/);
});

test('DAMDFE: registro legado sem veiculo/condutor/documentos não quebra', () => {
  const { mdfeDamdfeConteudo } = loadDamdfe();
  const htmlOut = mdfeDamdfeConteudo({ id: 'x', numero: '1', status: 'rascunho' }, {});
  assert.ok(htmlOut.includes('Nenhum documento vinculado'));
  assert.doesNotMatch(htmlOut, /undefined/);
});

test('DAMDFE: escapa HTML injetado nos dados', () => {
  const { mdfeDamdfeConteudo } = loadDamdfe();
  const htmlOut = mdfeDamdfeConteudo({ ...MDFE, observacoes: '<script>alert(1)</script>' }, EMPRESA);
  assert.doesNotMatch(htmlOut, /<script>alert/);
  assert.ok(htmlOut.includes('&lt;script&gt;'));
});

test('wiring: redirect pós-autorização + botão PDF + preview (sem toast de texto)', () => {
  assert.match(js, /try \{ consultarMdfes\(\); \} catch \(\_\) \{\}/);
  assert.match(js, /window\.showTab\('consulta'\)/);
  assert.match(js, /__mdfeConsultaFiltrados = mdfeFiltrados\.slice\(\)\.sort\(mdfeOrdenarPorNumeroDesc\)/);
  assert.match(js, /onclick="abrirDamdfeImpressao\('/);
  assert.match(js, /function visualizarMdfe\(id\) \{\s*\n\s*const mdfe = mdfes\.find\(m => String\(m\.id\) === String\(id\)\);\s*\n\s*if \(!mdfe\) \{ notifyUser\('MDF-e não encontrado'\); return; \}\s*\n\s*mdfeAbrirPreviewDamdfe\(mdfe\);\s*\n\}/);
  assert.doesNotMatch(js, /notifyUser\(detalhes\)/);
});
