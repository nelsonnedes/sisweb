import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Diagnóstico gravacao_falhou (Sentry 2026-10-10: profile + fiscal/notas/nfe):
// 1) contexto do evento nunca mais vem cego (companyId/uid/page);
// 2) negação de regra vira texto acionável na UI (Sentry mantém o técnico).

test('relato Sentry carrega contexto explícito', async (t) => {
  await t.test('firebaseService inclui companyId/uid/page', () => {
    const src = fs.readFileSync('firebaseService.js', 'utf8');
    assert.ok(src.includes('__sentryCtx'), 'contexto defensivo presente');
    assert.ok(src.includes("companyId: __sentryCtx.companyId"), 'companyId explicito');
    assert.ok(src.includes('uid: __sentryCtx.uid'), 'uid explicito');
  });

  await t.test('whitelist do Sentry inclui uid/page', () => {
    const src = fs.readFileSync('sentry-init.js', 'utf8');
    assert.ok(src.includes("'uid', 'page'"), 'uid/page chegam ao Extra');
  });
});

test('negacao de regra fiscal vira mensagem amigavel', async (t) => {
  await t.test('nf-storage mapeia permission_denied', () => {
    const src = fs.readFileSync('nf-storage.js', 'utf8');
    assert.ok(src.includes('function mapWriteError'), 'mapeador presente');
    assert.ok(src.includes('Sem permissão para '), 'texto acionavel em PT');
    assert.ok(src.includes('salvarNF') && src.includes('mapWriteError(e,'), 'salvarNF usa mapeador');
  });
});
