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

  await t.test('redirect global alert()->toast instalado com guarda unica', () => {
    assert.ok(svc.includes('window.alert = function'), 'deve instalar redirect de window.alert');
    assert.ok(svc.includes('__siswebAlertOverridden'), 'redirect com guarda unica (compativel T1)');
    assert.ok(svc.includes('classifyAlertMessage'), 'redirect usa classificador de tipo');
    assert.ok(svc.includes('window.__classifyAlertMessage'), 'classificador exposto para testes');
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

test('Onda C: classificador alert()->toast acerta as categorias', async (t) => {
  const m = svc.match(/function classifyAlertMessage\(text\) \{[\s\S]*?\n    \}/);
  assert.ok(m, 'classificador extraivel do servico');
  const classify = new Function(`${m[0]}; return classifyAlertMessage;`)();

  const casos = [
    // [mensagem, tipo esperado]
    ['Informe a plaqueta.', 'warning'],
    ['Selecione um romaneio primeiro.', 'warning'],
    ['O fornecedor selecionado não corresponde ao fornecedor do romaneio.', 'warning'],
    ['Já existe uma tora com esta plaqueta no estoque.', 'warning'],
    ['Existem plaquetas duplicadas no estoque: P1. Corrija antes de salvar.', 'warning'],
    ['Nenhum MDF-e encontrado no período selecionado', 'warning'],
    ['A lista de espécies ainda não foi carregada. Aguarde.', 'warning'],
    ['Biblioteca SheetJS (XLSX) não carregada. Tente recarregar a página.', 'error'],
    ['Módulo de certificado não carregado', 'error'],
    ['Tenant não identificado', 'error'],
    ['Sessão autenticada não encontrada. Faça login novamente.', 'error'],
    ['Não foi possível salvar o MDF-e: erro X', 'error'],
    ['MDF-e rejeitado: retorno sem autorização', 'error'],
    ['Falha ao abrir janela de impressão.', 'error'],
    ['Impressão bloqueada no mobile. Permita popups.', 'warning'],
    ['Carregados 5 itens do romaneio.', 'success'],
    ['Tora atualizada com sucesso.', 'success'],
    ['3 tora(s) excluída(s) permanentemente do estoque.', 'success'],
    ['Certificado removido.', 'success'],
    ['MDF-e autorizado com sucesso!\nProtocolo: 123', 'success'],
    ['✅ NF-e cancelada com sucesso!', 'success'],
    ['❌ Erro ao enviar certificado: X', 'error'],
    ['⚠️ CNPJ da empresa inválido. Verifique.', 'warning'],
    ['MDF-e carregado para edição', 'info'],
    ['Retorno SEFAZ: 100 - Autorizado o uso', 'success'],
    ['Configuração em nuvem será implementada na próxima fase.', 'info'],
    ['Fornecedor selecionado para o pedido.', 'info'],
  ];
  for (const [msg, esperado] of casos) {
    await t.test(`"${msg.slice(0, 42)}..." => ${esperado}`, () => {
      assert.strictEqual(classify(msg), esperado);
    });
  }
});
test('Onda D: folha e admin delegam ao servico', async (t) => {
  await t.test('FolhaUtils.showToast delega (adeus bottom-right proprio)', () => {
    const src = fs.readFileSync('folha_pagamento/folha-utils.js', 'utf8');
    assert.ok(src.includes('window.NotificationService.show'),
      'FolhaUtils deve delegar ao NotificationService');
    const delegaEm = src.indexOf('window.NotificationService.show');
    const legadoEm = src.indexOf('toast-container-folha');
    assert.ok(delegaEm !== -1 && delegaEm < legadoEm,
      'delegacao deve vir antes da criacao do container proprio');
  });

  await t.test('AdminUI.toast delega ao servico', () => {
    const src = fs.readFileSync('scripts/admin/admin-ui.js', 'utf8');
    assert.ok(src.includes('window.NotificationService.show'),
      'AdminUI.toast deve delegar ao NotificationService');
  });

  await t.test('AdminUI.confirm delega ao confirmDialog (mesma API Promise)', () => {
    const src = fs.readFileSync('scripts/admin/admin-ui.js', 'utf8');
    assert.ok(src.includes('window.confirmDialog({ title: title, message: message })'),
      'AdminUI.confirm deve delegar ao confirmDialog');
  });
});
test('Onda E1: nucleo destrutivo usa confirmDialog (zero confirm nativo)', async (t) => {
  const migrados = ['financas.js', 'estoque.js', 'estoque_produtos.js', 'vendas.js',
    'compras.js', 'js/client.js', 'js/fornecedor.js', 'js/species.js',
    'standardized-client-modal.js'];
  for (const f of migrados) {
    await t.test(`${f} sem confirm() nativo`, () => {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(!/\bconfirm\s*\(/.test(src), `${f} nao pode conter confirm() nativo`);
      assert.ok(src.includes('confirmDialog'), `${f} deve usar confirmDialog`);
    });
  }

  await t.test('funcoes convertidas sao async e destrutivos usam danger', () => {
    const fin = fs.readFileSync('financas.js', 'utf8');
    for (const fn of ['async function gerarParcelas', 'async function restaurarBackup',
      'async function limparTodosDados', 'async function excluirConta',
      'async function excluirPagamento']) {
      assert.ok(fin.includes(fn), `financas deve ter ${fn}`);
    }
    assert.ok(fin.includes("danger: true, confirmLabel: 'Excluir'"), 'exclusoes com danger+Excluir');
    assert.ok(fin.includes("confirmLabel: 'Apagar tudo'"), 'wipe com Apagar tudo');
    const est = fs.readFileSync('estoque.js', 'utf8');
    assert.ok(est.includes('async function limparTabelaEntrada'), 'limparTabelaEntrada async');
    const ven = fs.readFileSync('vendas.js', 'utf8');
    assert.ok(ven.includes('async function limparCarrinhoItens'), 'limparCarrinhoItens async');
    const com = fs.readFileSync('compras.js', 'utf8');
    assert.ok(com.includes('async function cancelarPedido'), 'cancelarPedido async');
    assert.ok(com.includes('window.limparCarrinhoItens = async function'),
      'limparCarrinhoItens (compras) async');
  });
});
test('Onda B: ToastManager unificado e familia legada removida', async (t) => {
  await t.test('compras.js e vendas.js delegam show ao servico', () => {
    for (const f of ['compras.js', 'vendas.js']) {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(src.includes('window.NotificationService.show'),
        `${f} deve delegar ao NotificationService`);
    }
  });

  await t.test('assinaturas publicas preservadas (show/helpers/mostrarToast)', () => {
    const vendas = fs.readFileSync('vendas.js', 'utf8');
    assert.ok(vendas.includes('show(message, type'), 'vendas show preserva assinatura');
    assert.ok(vendas.includes('window.ToastManager = ToastManager'), 'expoe window.ToastManager');
    assert.ok(vendas.includes('window.mostrarToast'), 'expoe window.mostrarToast');
    const compras = fs.readFileSync('compras.js', 'utf8');
    assert.ok(compras.includes('success: (msg, title, duration)'),
      'compras helpers preservam assinatura');
  });

  await t.test('src/components/ui/notifications.js removido (codigo morto)', () => {
    assert.ok(!fs.existsSync('src/components/ui/notifications.js'),
      'arquivo legado morto deve estar removido');
    const allow = fs.readFileSync('hosting-files.json', 'utf8');
    assert.ok(!allow.includes('src/components/ui/notifications.js'),
      'allowlist nao deve conter o arquivo removido');
  });
});
