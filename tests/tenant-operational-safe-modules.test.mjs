import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `End marker not found after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

test('estoque e financas exigem tenant autenticado online antes do carregamento operacional', () => {
  const estoqueHtml = read('estoque.html');
  const financasHtml = read('financas.html');
  const estoqueJs = read('estoque.js');
  const financasJs = read('financas.js');

  assert.match(estoqueHtml, /estoque\.js\?v=2026-06-16-tenant-safe-v1/);
  assert.match(financasHtml, /financas\.js\?v=2026-07-01-finance-pay-edit-v1/);
  assert.match(financasHtml, /window\.__siswebFirebaseServiceReady = \(async function/);
  assert.match(financasHtml, /resolveAuthenticatedTenant: firebaseSvc\.resolveAuthenticatedTenant \|\| existingFirebaseService\.resolveAuthenticatedTenant/);

  assert.match(estoqueJs, /function isFirebaseOfflineModeEstoque\(\)/);
  assert.match(estoqueJs, /async function ensureTenantContext\(timeoutMs = 10000\)/);
  assert.match(estoqueJs, /resolveAuthenticatedTenant\(\{ timeoutMs: Math\.min\(timeoutMs, 4500\), allowCached: isOffline \}\)/);
  assert.match(estoqueJs, /let tenant = isOffline \? getCachedTenant\(\) : null;/);
  assert.match(estoqueJs, /if \(!tenant\) \{[\s\S]*if \(firebaseAvailable\) return;/);

  assert.match(financasJs, /function isFirebaseOfflineModeFinancas\(\)/);
  assert.match(financasJs, /async function ensureFinanceTenantContext\(timeoutMs = 7000\)/);
  assert.match(financasJs, /window\.__siswebFirebaseServiceReady/);
  assert.match(financasJs, /resolveAuthenticatedTenant\(\{ timeoutMs: Math\.min\(timeoutMs, 4500\), allowCached: isOffline \}\)/);
  assert.match(financasJs, /const financeTenant = await ensureFinanceTenantContext\(\);/);
  assert.match(financasJs, /if \(firebaseAvailable && !financeTenant\) \{/);
  assert.match(financasJs, /mostrarNotificacao\('Empresa da sessão não identificada\. Faça login novamente para carregar o Financeiro\.', 'error'\)/);
});

test('notas fiscais resolve tenant autenticado antes de inicializar modulos e eventos fiscais', () => {
  const notas = read('notas-fiscais.html');
  const firebaseService = read('firebaseService.js');

  assert.match(notas, /resolveAuthenticatedTenant/);
  assert.match(notas, /function obterTenantIdNFCacheOffline\(\) \{\s*if \(!isFirebaseOfflineModeNF\(\)\) return '';/);
  assert.match(notas, /async function garantirContextoEmpresaNF\(timeoutMs = 7000\)/);
  assert.match(notas, /async function obterUidAutenticadoNF\(\)/);
  assert.match(notas, /resolveAuthenticatedTenant\(\{ timeoutMs: Math\.min\(timeoutMs, 4500\), allowCached: isOffline \}\)/);
  assert.match(notas, /const nfInit = await inicializarNFService\(\);/);
  assert.match(notas, /const tid0 = String\(\(nfInit && nfInit\.tenantId\) \|\| obterTenantIdNF\(\) \|\| ''\)\.trim\(\);/);
  assert.doesNotMatch(notas, /const raw0 = localStorage\.getItem\('company_info'\);/);
  assert.doesNotMatch(notas, /authService\?\.getCurrentUser\?\(\)\?\.uid/);
  assert.match(notas, /callFunction,/);
  assert.match(notas, /getCurrentUid,/);
  assert.match(notas, /window\.firebaseService = \{\s*\.\.\.\(window\.firebaseService \|\| \{\}\),/);
  assert.match(firebaseService, /export \{[\s\S]*callFunction,[\s\S]*getCurrentUid,[\s\S]*app/s);

  const tenantResolverBlock = blockBetween(notas, 'function obterTenantIdNF() {', 'function setEventoFiscalMsg');
  assert.match(tenantResolverBlock, /getCurrentTenantId/);
  assert.match(tenantResolverBlock, /getTenantId/);
  assert.match(tenantResolverBlock, /return obterTenantIdNFCacheOffline\(\);/);

  const secureOps = [
    ['async function salvarTokenManual()', 'window.salvarTokenManual = salvarTokenManual;'],
    ['async function uploadCertificado()', 'async function removerCertificado()'],
    ['async function removerCertificado()', 'const PROVEDOR_INFO = {'],
    ['async function conectarA3Nuvem()', 'async function salvarConfiguracoes()'],
    ['async function abrirDANFENota(nfId) {', 'function obterTenantIdNF() {'],
    ['async function iniciarCancelamento(nfId, chave, nProt) {', 'async function editarRascunho(nfId) {'],
    ['async function editarRascunho(nfId) {', 'function nfRenderizarTabelaNaturezas() {'],
    ['async function nfRemoverNatureza(id, desc) {', 'window.nfEditarNatureza  = nfEditarNatureza;'],
  ];

  for (const [start, end] of secureOps) {
    const block = blockBetween(notas, start, end);
    assert.match(block, /const tid = obterTenantIdNF\(\);/, `${start} precisa usar o resolvedor central de tenant`);
  }

  const initBlock = blockBetween(notas, 'async function inicializarNFService()', 'function preencherCamposConfig');
  assert.match(initBlock, /const uid  = await obterUidAutenticadoNF\(\);/);

  const uploadBlock = blockBetween(notas, 'async function uploadCertificado()', 'async function removerCertificado()');
  assert.match(uploadBlock, /const uid = await obterUidAutenticadoNF\(\);/);
  assert.match(uploadBlock, /window\.uploadCertificado = uploadCertificado;/);

  const tokenBlock = blockBetween(notas, 'async function salvarTokenManual()', 'window.salvarTokenManual = salvarTokenManual;');
  assert.match(tokenBlock, /const uid = await obterUidAutenticadoNF\(\);/);

  const cloudBlock = blockBetween(notas, 'async function conectarA3Nuvem()', 'async function salvarConfiguracoes()');
  assert.match(cloudBlock, /const uid = await obterUidAutenticadoNF\(\);/);
  assert.match(cloudBlock, /window\.conectarA3Nuvem = conectarA3Nuvem;/);
  assert.match(notas, /window\.showTab = window\.showTab \|\| function showTab\(tabName\)/);
});
