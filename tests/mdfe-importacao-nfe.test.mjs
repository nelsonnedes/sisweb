import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync('mdf-e.html', 'utf8');
const js = readFileSync('mdf-e.js', 'utf8');

function loadInternals() {
  const context = {
    window: {},
    document: { addEventListener() {} },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeImportInternals;
  assert.ok(internals, '__mdfeImportInternals deve existir em mdf-e.js');
  return internals;
}

// Objetos criados no realm do vm têm outro prototype — re-homed via JSON para
// as comparações estritas de estrutura (assert/strict).
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function notaBase(overrides = {}) {
  return {
    id: 'nf_1',
    status: 'autorizada',
    numero: '000000123',
    dataEmissao: '2026-10-10',
    chave: '35261012345678000195550010000001231234567890',
    total: { vNF: 1500.5 },
    dest: { nome: 'CLIENTE TESTE', endereco: { municipio: 'Rio de Janeiro', uf: 'RJ' } },
    emit: { endereco: { municipio: 'São Paulo', uf: 'SP' } },
    transp: { vol: [{ pesoL: 1200.5 }], veicTransp: { placa: 'ABC1D23' } },
    ...overrides,
  };
}

test('UI de importação existe no HTML (botão, modal e busca)', () => {
  assert.match(html, /onclick="abrirImportacaoNFe\(\)"/);
  assert.match(html, /id="mdfeImportModal"/);
  assert.match(html, /id="mdfeImportTitulo"/);
  assert.match(html, /id="mdfeImportBusca"/);
  assert.match(html, /id="mdfeImportLista"/);
  assert.match(html, /id="mdfeImportConfirmar"/);
  assert.match(html, /onclick="confirmarImportacaoNFe\(\)"/);
  assert.match(html, /onclick="selecionarTodasImportacaoNFe\(\)"/);
  assert.match(html, /\.status-importado \{/);
});

test('importação lê NF-e autorizadas do tenant e traz os dados da nota (prioridade sobre prefill)', () => {
  assert.match(js, /fiscal\/notas\/nfe/);
  assert.match(js, /svc\.loadFromFirebase\(`companies\/\$\{tenantIdMdfe\}\/fiscal\/notas\/nfe`\)/);
  assert.match(js, /\['autorizada', 'autorizado'\]\.includes/);
  assert.match(js, /documentosFiscais\.map\(\(doc\) => mdfeDigits\(doc\.chave\)\)/);
  // Import explícito: valores da nota prevalecem (sem guarda de "só se vazio")
  assert.match(js, /if \(ufInicioEl && resumo\.origem\.uf\) ufInicioEl\.value = resumo\.origem\.uf;/);
  assert.match(js, /if \(cidadeCarregamentoEl && resumo\.origem\.municipio\) cidadeCarregamentoEl\.value = resumo\.origem\.municipio;/);
  assert.match(js, /if \(ufFimEl && resumo\.destino\.uf\) ufFimEl\.value = resumo\.destino\.uf;/);
  assert.match(js, /if \(cidadeDescarregamentoEl && resumo\.destino\.municipio\) cidadeDescarregamentoEl\.value = resumo\.destino\.municipio;/);
  assert.match(js, /if \(placaEl && resumo\.placa\) placaEl\.value = resumo\.placa;/);
  assert.match(js, /status: 'Importado'/);
  for (const fn of ['abrirImportacaoNFe', 'fecharImportacaoNFe', 'filtrarImportacaoNFe', 'alternarSelecaoImportacaoNFe', 'selecionarTodasImportacaoNFe', 'confirmarImportacaoNFe']) {
    assert.match(js, new RegExp(`window\\.${fn} = ${fn}`), `exposição ausente: ${fn}`);
  }
});

test('normalização aceita somente NF-e autorizadas com chave de 44 dígitos', () => {
  const { mdfeNormalizarNFeImportacao } = loadInternals();
  const lista = mdfeNormalizarNFeImportacao({
    a: notaBase(),
    b: notaBase({ id: 'nf_2', status: 'rascunho', numero: '000000124' }),
    c: notaBase({ id: 'nf_3', status: 'cancelada' }),
    d: notaBase({ id: 'nf_4', status: 'rejeitada' }),
    e: notaBase({ id: 'nf_5', status: 'aguardando' }),
    f: notaBase({ id: 'nf_6', status: 'autorizado', numero: '000000122', chave: '35261012345678000195550010000001221234567891' }),
  });
  assert.equal(lista.length, 2);
  assert.deepEqual(plain(lista.map((n) => n.numero)), ['123', '122']);
  assert.equal(lista[0].chave.length, 44);
  assert.equal(lista[0].destinatario, 'CLIENTE TESTE');
  assert.equal(lista[0].municipio, 'Rio de Janeiro');
  assert.equal(lista[0].uf, 'RJ');
  assert.equal(lista[0].origemMunicipio, 'São Paulo');
  assert.equal(lista[0].origemUf, 'SP');
  assert.equal(lista[0].placa, 'ABC1D23');
  assert.equal(lista[0].valor, 1500.5);
  assert.equal(lista[0].peso, 1200.5);
  assert.equal(lista[0].pesoDisponivel, true);
});

test('normalização rejeita chave inválida e usa fallback de valor e peso', () => {
  const { mdfeNormalizarNFeImportacao } = loadInternals();
  const lista = mdfeNormalizarNFeImportacao({
    a: notaBase({ chave: '123' }),
    b: notaBase({
      id: 'nf_b',
      numero: '000000010',
      total: undefined,
      valorTotal: 250,
      transp: { vol: [{ pesoL: '', pesoB: 999.25 }] },
    }),
    c: notaBase({ id: 'nf_c', numero: '000000011', transp: {} }),
  });
  assert.equal(lista.length, 2);
  const comFallback = lista.find((n) => n.numero === '10');
  assert.equal(comFallback.valor, 250);
  assert.equal(comFallback.peso, 999.25);
  const semPeso = lista.find((n) => n.numero === '11');
  assert.equal(semPeso.peso, 0);
  assert.equal(semPeso.pesoDisponivel, false);
  assert.equal(semPeso.placa, '');
});

test('soma da importação agrega valor, peso e conta notas sem peso', () => {
  const { mdfeSomarImportacao } = loadInternals();
  const totais = mdfeSomarImportacao([
    { valor: 100.25, peso: 10.5 },
    { valor: 49.75, peso: 0 },
    null,
  ]);
  assert.equal(totais.valor, 150);
  assert.equal(totais.peso, 10.5);
  assert.equal(totais.semPeso, 1);
});

test('resumo aplica percurso e placa quando unânimes', () => {
  const { mdfeResumoImportacao } = loadInternals();
  const resumo = mdfeResumoImportacao([
    { origemMunicipio: 'São Paulo', origemUf: 'SP', municipio: 'Rio de Janeiro', uf: 'RJ', placa: 'ABC1D23' },
    { origemMunicipio: 'São Paulo', origemUf: 'SP', municipio: 'Rio de Janeiro', uf: 'RJ', placa: 'ABC1D23' },
  ]);
  assert.deepEqual(plain(resumo.origem), { municipio: 'São Paulo', uf: 'SP' });
  assert.deepEqual(plain(resumo.destino), { municipio: 'Rio de Janeiro', uf: 'RJ' });
  assert.equal(resumo.placa, 'ABC1D23');
  assert.equal(resumo.destinosDivergentes, false);
  assert.equal(resumo.placasDivergentes, false);
});

test('resumo sinaliza divergências e ignora placeholders', () => {
  const { mdfeResumoImportacao } = loadInternals();
  const resumo = mdfeResumoImportacao([
    { origemMunicipio: 'N/A', origemUf: 'SP', municipio: 'Rio de Janeiro', uf: 'RJ', placa: 'ABC1D23' },
    { origemMunicipio: 'São Paulo', origemUf: 'SP', municipio: 'São Paulo', uf: 'SP', placa: 'XYZ9Z99' },
  ]);
  assert.deepEqual(plain(resumo.origem), { municipio: 'São Paulo', uf: 'SP' });
  assert.deepEqual(plain(resumo.destino), { municipio: 'Rio de Janeiro', uf: 'RJ' });
  assert.equal(resumo.destinosDivergentes, true);
  assert.equal(resumo.placasDivergentes, true);
  assert.equal(resumo.placa, 'ABC1D23');
});

test('resumo vazio não inventa percurso', () => {
  const { mdfeResumoImportacao } = loadInternals();
  const resumo = mdfeResumoImportacao([]);
  assert.deepEqual(plain(resumo.origem), { municipio: '', uf: '' });
  assert.deepEqual(plain(resumo.destino), { municipio: '', uf: '' });
  assert.equal(resumo.placa, '');
  assert.equal(resumo.destinosDivergentes, false);
  assert.equal(resumo.placasDivergentes, false);
});
