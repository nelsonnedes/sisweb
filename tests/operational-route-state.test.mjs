import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('vendas e compras mostram estado claro quando rota operacional nao tem tenant ativo', () => {
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');

  assert.match(vendasHtml, /vendas\.js\?v=[^"'\s]+/);
  assert.match(comprasHtml, /compras\.js\?v=[^"'\s]+/);

  assert.match(vendasJs, /function renderOperationalAccessStateVendas\(contexto = \{\}\)/);
  assert.match(comprasJs, /function renderOperationalAccessStateCompras\(contexto = \{\}\)/);
  assert.match(vendasJs, /vendasOperationalAccessState/);
  assert.match(comprasJs, /comprasOperationalAccessState/);
  assert.match(vendasJs, /sisweb-operational-state/);
  assert.match(comprasJs, /sisweb-operational-state/);

  assert.match(vendasJs, /login\.html\?reason=tenant_required&redirect=/);
  assert.match(comprasJs, /login\.html\?reason=tenant_required&redirect=/);
  assert.match(vendasJs, /Entrar novamente/);
  assert.match(comprasJs, /Entrar novamente/);
  assert.match(vendasJs, /Conta SuperAdmin sem empresa operacional/);
  assert.match(comprasJs, /Conta SuperAdmin sem empresa operacional/);

  assert.match(vendasJs, /setOperationalActionsDisabledVendas\(true\)/);
  assert.match(comprasJs, /setOperationalActionsDisabledCompras\(true\)/);
  assert.match(vendasJs, /clearOperationalAccessStateVendas\(\)/);
  assert.match(comprasJs, /clearOperationalAccessStateCompras\(\)/);

  assert.match(vendasJs, /function iniciarSistemaVendasUmaVez\(\)/);
  assert.match(comprasJs, /function iniciarSistemaComprasUmaVez\(\)/);
  assert.match(vendasJs, /if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', iniciarSistemaVendasUmaVez\);[\s\S]*\} else \{\s*iniciarSistemaVendasUmaVez\(\);/);
  assert.match(comprasJs, /if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', iniciarSistemaComprasUmaVez\);[\s\S]*\} else \{\s*iniciarSistemaComprasUmaVez\(\);/);
});

test('acoes principais de vendas e compras sao protegidas quando tenant operacional nao esta pronto', () => {
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');

  assert.match(vendasJs, /async function novoPedido\(\) \{\s*if \(!guardOperationalAccessVendas\(\)\) return;/);
  assert.match(vendasJs, /async function listarPedidos\(\) \{\s*if \(!guardOperationalAccessVendas\(\)\) return;/);
  assert.match(comprasJs, /function novoPedido\(gerarNumero = true\) \{\s*if \(!guardOperationalAccessCompras\(\)\) return;/);
  assert.match(comprasJs, /async function listarPedidos\(\) \{\s*if \(!guardOperationalAccessCompras\(\)\) return;/);

  assert.doesNotMatch(vendasJs, /if \(tenant\) return \{ success: true, companyId: tenant, fallback: true \};/);
  assert.doesNotMatch(comprasJs, /if \(tenant\) return \{ success: true, companyId: tenant, fallback: true \};/);
});
