import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Onda A (2026-10-10): trava do NotificationService global.
// Todo novo feedback visual deve usar NotificationService/confirmDialog.
// Nenhum arquivo NOVO ou migrado nesta onda pode conter alert()/confirm().

const svc = fs.readFileSync('js/notification-service.js', 'utf8');

test('NotificationService global existe com API completa', async (t) => {
  await t.test('expoe NotificationService com show/success/warning/error/info', () => {
    assert.ok(svc.includes('window.NotificationService'), 'deve expor window.NotificationService');
    for (const m of ['success', 'warning', 'error', 'info']) {
      assert.ok(svc.includes(m + ':'), `deve expor metodo ${m}`);
    }
  });

  await t.test('expoe confirmDialog que retorna Promise e nunca usa confirm nativo', () => {
    assert.ok(svc.includes('confirmDialog'), 'deve expor confirmDialog');
    assert.ok(svc.includes('new Promise'), 'confirmDialog deve retornar Promise');
    assert.ok(!/\bconfirm\s*\(/.test(svc), 'servico nao pode conter confirm() nativo');
    assert.ok(!/\balert\s*\(/.test(svc), 'servico nao pode conter alert() nativo');
  });

  await t.test('usa container unico, aria-live, tokens --sw-* e suporte multilinha', () => {
    assert.ok(svc.includes('sw-toast-container'), 'container unico #sw-toast-container');
    assert.ok(svc.includes('aria-live'), 'deve ter aria-live');
    for (const tok of ['--sw-success', '--sw-warning', '--sw-danger', '--sw-info']) {
      assert.ok(svc.includes(tok), `deve usar token ${tok}`);
    }
    assert.ok(svc.includes('pre-line'), 'mensagem deve suportar multilinha (\\n)');
    assert.ok(svc.includes('sw-confirm-overlay'), 'confirm usa overlay proprio');
    assert.ok(svc.includes('fail-closed') || svc.includes('resolve(false)'), 'confirm fail-closed sem DOM');
  });

  await t.test('duracoes configuraveis e erro nao gruda para sempre', () => {
    assert.ok(svc.includes('error: 6000') || svc.includes('error:6000'), 'erro com auto-dismiss (nao gruda)');
    assert.ok(svc.includes('opts.duration') || svc.includes('duration'), 'duracao configuravel via opts');
  });

  await t.test('compat window.__toast sem sobrescrever window.alert', () => {
    assert.ok(svc.includes('window.__toast'), 'define __toast para menu-component');
    assert.ok(!svc.includes('window.alert ='), 'NAO deve sobrescrever window.alert (Onda F)');
  });
});

test('menu-component carrega o servico em todas as paginas', async (t) => {
  const menu = fs.readFileSync('menu-component.js', 'utf8');
  await t.test('injeta js/notification-service.js com versao e guarda duplicada', () => {
    assert.ok(menu.includes('js/notification-service.js'), 'menu deve referenciar o servico');
    assert.ok(menu.includes('data-sw-notify'), 'script injetado deve ter marcador data-sw-notify');
    assert.ok(menu.includes('window.NotificationService'), 'menu deve checar servico ja carregado');
  });
});

test('T5 e T4 delegam ao servico (zero fallback alert)', async (t) => {
  const alvos = ['js/client.js', 'js/fornecedor.js', 'js/species.js', 'modules/core/utils.js'];
  for (const f of alvos) {
    await t.test(`${f} delega e nao tem fallback alert`, () => {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(src.includes('window.NotificationService'), `${f} deve delegar ao NotificationService`);
      assert.ok(!/return alert\s*\(/.test(src), `${f} nao pode ter fallback return alert(`);
    });
  }
});
