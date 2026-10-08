import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Onda 16-A: save de cliente demorava dezenas de segundos para aparecer.
// Causa: invalidateReadCacheForPath não cruzava namespace (escrita em
// companies/{t}/clients não matava o cache da leitura 'clients', TTL 3 min).
const svc = readFileSync('firebaseService.js', 'utf8');
const clientSvc = readFileSync('client-service.js', 'utf8');
const compras = readFileSync('compras.js', 'utf8');

test('invalidacao de cache cruza namespace companies/{tenant}', () => {
  assert.match(svc, /const strip = \(s\) => String\(s \|\| ''\)\.replace\(\/\^companies/);
  assert.match(svc, /cs === ps \|\| cs\.startsWith\(ps \+ '\/'\) \|\| ps\.startsWith\(cs \+ '\/'\)/);
});

test('saveClient persiste só o registro (sem rewrite integral em background)', () => {
  assert.match(clientSvc, /Persistir SÓ o registro alterado/);
  assert.match(clientSvc, /svc\.saveToFirebase\('clients', String\(savedClient\.id\), savedClient\)/);
  assert.doesNotMatch(clientSvc, /saveClients\(clients\)\.catch/);
});

test('compras: resumo TORA pode ser desmarcado (volta ao detalhado)', () => {
  assert.match(compras, /TORA: o resumo é opcional/);
  assert.match(compras, /outrosVisiveis\.length === 0/);
  assert.match(compras, /lerModoAgrupamentoCompra\(\) === 'nenhum' && !ehTipoToraCompra\(tipo\)/);
  assert.match(compras, /Detalhado \(TORA sem resumo\)/);
  assert.match(compras, /plaqueta \? `\$\{especie\} \(\$\{plaqueta\}\)` : especie/);
});

test('compras: serrado mantém modo obrigatório (sem regressão)', () => {
  assert.match(compras, /obrigatório no serrado/);
  assert.match(compras, /Selecione um modo no quadro "Agrupar:" para carregar os itens\./);
});
