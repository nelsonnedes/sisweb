import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

const sharedClientFields = [
  'clientCnpj',
  'clientPersonType',
  'clientIndIEDest',
  'clientStateRegistration',
  'clientMunicipalRegistration',
  'clientSuframa',
  'clientCep',
  'clientNumber',
  'clientNeighborhood',
  'clientComplement',
  'clientMunicipalityCode',
  'clientCountryCode',
  'clientCountryName'
];

const sharedSupplierFields = [
  'fornecedorPersonType',
  'fornecedorIndIEDest',
  'fornecedorStateRegistration',
  'fornecedorMunicipalRegistration',
  'fornecedorSuframa',
  'fornecedorCep',
  'fornecedorNumber',
  'fornecedorNeighborhood',
  'fornecedorComplement',
  'fornecedorMunicipalityCode',
  'fornecedorCountryCode',
  'fornecedorCountryName'
];

function assertHasIds(source, ids, label) {
  for (const id of ids) {
    assert.match(source, new RegExp(`id="${id}"`), `${label} deve conter #${id}`);
  }
}

function assertOptionalLocation(source, label) {
  assert.doesNotMatch(
    source,
    /id="(?:clientState|clientCity|newClientState|newClientCity|fornecedorState|fornecedorCity|fornEstado|fornCidade|state|city|vendasClienteState|vendasClienteCity|comprasFornecedorState|comprasFornecedorCity)"\s+required/,
    `${label} não deve exigir UF/Cidade para cadastro inicial`
  );
}

test('cadastros principais de clientes e fornecedores expõem campos fiscais opcionais para NF-e', () => {
  const clientHtml = read('client.html');
  const fornecedorHtml = read('fornecedor.html');
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');

  assertHasIds(clientHtml, [
    'cnpj',
    'personType',
    'ieIndicator',
    'stateRegistration',
    'municipalRegistration',
    'suframa',
    'postalCode',
    'complement',
    'municipalityCode',
    'countryCode',
    'countryName'
  ], 'client.html');
  assertHasIds(fornecedorHtml, [
    'cnpj',
    'personType',
    'ieIndicator',
    'stateRegistration',
    'municipalRegistration',
    'suframa',
    'postalCode',
    'number',
    'neighborhood',
    'complement',
    'municipalityCode',
    'countryCode',
    'countryName'
  ], 'fornecedor.html');
  assertHasIds(vendasHtml, [
    'vendasClienteTipoPessoa',
    'vendasClienteIndIEDest',
    'vendasClienteInscricaoEstadual',
    'vendasClienteInscricaoMunicipal',
    'vendasClienteSuframa',
    'vendasClienteCep',
    'vendasClienteComplement',
    'vendasClienteMunicipalityCode',
    'vendasClienteCountryCode',
    'vendasClienteCountryName'
  ], 'vendas.html');
  assertHasIds(comprasHtml, [
    'comprasFornecedorTipoPessoa',
    'comprasFornecedorIndIEDest',
    'comprasFornecedorInscricaoEstadual',
    'comprasFornecedorInscricaoMunicipal',
    'comprasFornecedorSuframa',
    'comprasFornecedorCep',
    'comprasFornecedorComplement',
    'comprasFornecedorMunicipalityCode',
    'comprasFornecedorCountryCode',
    'comprasFornecedorCountryName'
  ], 'compras.html');

  [clientHtml, fornecedorHtml, vendasHtml, comprasHtml].forEach((html, index) => {
    assertOptionalLocation(html, ['client.html', 'fornecedor.html', 'vendas.html', 'compras.html'][index]);
  });
});

test('modais operacionais de cliente e fornecedor incluem campos fiscais opcionais', () => {
  const comprasHtml = read('compras.html');
  const openNewClientModalJs = read('openNewClientModal.js');
  const preromaneioHtml = read('preromaneio.html');
  const romaneioPctHtml = read('romaneiopct.html');
  const romaneioPesHtml = read('romaneiopes.html');
  const romaneioToraHtml = read('romaneiotora.html');
  const romaneioToraModais = read('romaneiotora_modais.js');
  const gerenciarClientes = read('modules/crud/gerenciar-clientes.js');

  assertHasIds(openNewClientModalJs, [
    'newClientCnpj',
    'newClientTipoPessoa',
    'newClientIndIEDest',
    'newClientInscricaoEstadual',
    'newClientInscricaoMunicipal',
    'newClientSuframa',
    'newClientCep',
    'newClientNumber',
    'newClientNeighborhood',
    'newClientComplement',
    'newClientMunicipalityCode',
    'newClientCountryCode',
    'newClientCountryName',
    'newClientObs'
  ], 'openNewClientModal.js');
  assert.match(openNewClientModalJs, /function openClientFormModal\(options = \{\}\)/);
  assert.match(openNewClientModalJs, /function openEditClientModal\(client, options = \{\}\)/);
  assert.match(openNewClientModalJs, /window\.openEditClientModal = openEditClientModal/);
  assert.match(openNewClientModalJs, /typeof window\.popularCidades === 'function'/);
  assertHasIds(comprasHtml, [
    'fornDocumento',
    'fornTipoPessoa',
    'fornIndIEDest',
    'fornInscricaoEstadual',
    'fornInscricaoMunicipal',
    'fornSuframa',
    'fornCep',
    'fornNumero',
    'fornBairro',
    'fornComplemento',
    'fornCodigoMunicipio',
    'fornPaisCodigo',
    'fornPais',
    'fornObs'
  ], 'compras.html modalFornecedor');
  assertHasIds(preromaneioHtml, sharedClientFields, 'preromaneio.html clientModal');
  assertHasIds(romaneioPctHtml, sharedClientFields, 'romaneiopct.html clientModal');
  assertHasIds(romaneioPesHtml, sharedClientFields, 'romaneiopes.html clientModal');
  assertHasIds(gerenciarClientes, sharedClientFields, 'GerenciarClientes modal');
  assertHasIds(romaneioToraModais, sharedClientFields, 'romaneiotora_modais.js dynamic supplier modal');

  assertHasIds(preromaneioHtml, sharedSupplierFields, 'preromaneio.html fornecedorModal');
  assertHasIds(romaneioToraHtml, sharedSupplierFields, 'romaneiotora.html fornecedorModal');

  assert.doesNotMatch(comprasHtml, /id="clientModal"/, 'compras.html não deve manter modal legado de cliente para fornecedor');

  [comprasHtml, openNewClientModalJs, preromaneioHtml, romaneioPctHtml, romaneioPesHtml, romaneioToraHtml, romaneioToraModais].forEach((html, index) => {
    assertOptionalLocation(html, ['compras.html', 'openNewClientModal.js', 'preromaneio.html', 'romaneiopct.html', 'romaneiopes.html', 'romaneiotora.html', 'romaneiotora_modais.js'][index]);
  });
});

test('modais longos de cliente e fornecedor mantem rodape visivel com corpo rolavel', () => {
  const clientHtml = read('client.html');
  const fornecedorHtml = read('fornecedor.html');
  const comprasHtml = read('compras.html');
  const openNewClientModalJs = read('openNewClientModal.js');

  assert.match(clientHtml, /#modalForm \.modal-content \{[\s\S]*max-height: calc\(100dvh - 48px\);[\s\S]*overflow: hidden;/);
  assert.match(clientHtml, /#modalForm #mainForm \{[\s\S]*display: flex;[\s\S]*min-height: 0;/);
  assert.match(clientHtml, /#modalForm \.modal-body \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow-y: auto;/);

  assert.match(fornecedorHtml, /\.modal-content \{[\s\S]*max-height: calc\(100dvh - 48px\);[\s\S]*overflow: hidden;/);
  assert.match(fornecedorHtml, /<form id="mainForm">\s*<div class="modal-body">/);
  assert.match(fornecedorHtml, /\.modal-footer \{[\s\S]*flex: 0 0 auto;[\s\S]*justify-content: flex-end;/);

  assert.match(comprasHtml, /#modalFornecedor \.modal-content \{[\s\S]*max-height: calc\(100dvh - 48px\);[\s\S]*overflow: hidden;/);
  assert.match(comprasHtml, /<form onsubmit="salvarFornecedorInline\(event\)">\s*<div class="modal-body">/);
  assert.match(comprasHtml, /<div class="modal-footer action-buttons">/);

  assert.match(openNewClientModalJs, /max-height:calc\(100dvh - 48px\); overflow:hidden;/);
  assert.match(openNewClientModalJs, /class="modal-body" style="[\s\S]*overflow-y:auto;/);
  assert.match(openNewClientModalJs, /class="modal-footer" style="[\s\S]*flex:0 0 auto;/);
});

test('cadastros rápidos de pedido usam caminhos canônicos de clientes e fornecedores', () => {
  const openNewClientModalJs = read('openNewClientModal.js');
  const comprasHtml = read('compras.html');
  const comprasJs = read('compras.js');
  const fornecedorJs = read('js/fornecedor.js');
  const comprasFornecedoresCarregarDados = comprasJs.match(/async function comprasFornecedoresCarregarDados\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const fornecedorLoadData = fornecedorJs.match(/async function loadData\(\) \{[\s\S]*?finally \{/)?.[0] || '';

  assert.match(openNewClientModalJs, /window\.clientService && typeof window\.clientService\.saveClient === 'function'/);
  assert.match(openNewClientModalJs, /clientFormModalContext\.mode === 'edit'/);
  assert.match(openNewClientModalJs, /clientFormModalContext\.onSaved/);
  assert.doesNotMatch(openNewClientModalJs, /saveFornecedor|saveData\(['"`]fornecedores|saveToFirebase\(['"`]fornecedores/);
  assert.match(comprasJs, /saveData\('fornecedores', ordered\)/);
  assert.match(comprasJs, /const saved = await service\.saveFornecedor\(novoFornecedor\)/);
  assert.doesNotMatch(comprasFornecedoresCarregarDados, /clients/);
  assert.doesNotMatch(fornecedorLoadData, /clients/);
  assert.doesNotMatch(comprasHtml, /id="clientModal"[\s\S]*saveClient/);
});

test('normalizadores preservam aliases fiscais usados pela emissão NF-e', () => {
  const sources = [
    read('js/client.js'),
    read('js/fornecedor.js'),
    read('client-service.js'),
    read('romaneios-client-save-fix.js'),
    read('vendas.js'),
    read('compras.js'),
    read('client-modal-handler.js'),
    read('fornecedor-modals.js'),
    read('romaneiotora_modais.js')
  ].join('\n');

  for (const token of ['documento', 'indIEDest', 'inscricaoEstadual', 'inscricaoMunicipal', 'suframa', 'cep', 'cMun', 'cPais', 'xPais']) {
    assert.match(sources, new RegExp(token), `normalizadores devem preservar ${token}`);
  }
});

test('PWA e abas comerciais usam cachebuster fiscal atual', () => {
  assert.match(read('vendas.html'), /vendas\.js\?v=2026-06-23-cadastro-fiscal-nfe-v1/);
  assert.match(read('vendas.html'), /openNewClientModal\.js\?v=2026-07-01-menu-global-dedupe-v1/);
  assert.match(read('notas-fiscais.html'), /openNewClientModal\.js\?v=2026-07-01-menu-global-dedupe-v1/);
  assert.match(read('compras.html'), /compras\.js\?v=2026-06-30-pedido-contact-modals-v1/);
  assert.match(read('client.html'), /js\/client\.js\?v=2026-06-23-cadastro-fiscal-nfe-v1/);
  assert.match(read('fornecedor.html'), /js\/fornecedor\.js\?v=2026-06-30-pedido-contact-modals-v1/);
  assert.match(read('sw.js'), /const APP_VERSION = '2026-07-01-menu-global-dedupe-v1'/);
});
