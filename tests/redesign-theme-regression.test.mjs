import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test('Tema global: tokens e manager seguem o manual de marca', () => {
  const tokens = read('styles/sisweb-tokens.css');
  assert.match(tokens, /--sw-brand:\s*#fe6a00/i, 'marca #FE6A00 (cores.md §3.1)');
  assert.match(tokens, /linear-gradient\(135deg,\s*#ff7a45/i, 'gradiente oficial 135°');
  assert.ok(tokens.includes('html[data-theme="light"]'), 'tema claro via data-theme');
  assert.ok(tokens.includes('--sw-font-sans'), 'tipografia tokenizada');
  assert.ok(!tokens.includes('#3498db'), 'tokens livres do azul legado');

  const theme = read('js/sisweb-theme.js');
  assert.ok(theme.includes('sisweb:theme'), 'persistência sisweb:theme');
  assert.ok(theme.includes('sisweb:theme-change'), 'evento de notificação');
  assert.ok(theme.includes('window.SiswebTheme'), 'API global exposta');
  assert.ok(!/import\s+.*firebase|require\(.*firebase|firestore/i.test(theme), 'theme manager sem imports de backend (sync opcional via window)');
  assert.ok(theme.includes('sisweb:theme:updatedAt'), 'Fase 19: last-write-wins local');
  assert.ok(theme.includes('ui/theme'), 'Fase 19: nó de tema por tenant');
  assert.ok(theme.includes('tenantContextReady'), 'Fase 19: converge após tenant pronto');
});

test('login.html: integra tema sem quebrar autenticação', () => {
  const html = read('login.html');
  for (const needle of [
    'styles/sisweb-tokens.css',
    'styles/auth.css',
    'js/sisweb-theme.js',
    'data-theme',
    'sw-auth',
    'sw-lockup'
  ]) {
    assert.ok(html.includes(needle), `login.html deve conter ${needle}`);
  }
  for (const id of [
    'loginForm', 'email', 'password', 'loginSubmitBtn', 'errorMessage',
    'mfaSection', 'mfaCode', 'registerModal', 'registerForm',
    'forgotPasswordModal', 'forgotPasswordForm', 'contactModal', 'systemHealth'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `id preservado: ${id}`);
  }
  for (const fn of ['handleLogin', 'handleRegister', 'handlePasswordReset', 'handleMfaVerify']) {
    assert.ok(html.includes(fn), `handler preservado: ${fn}`);
  }
  assert.ok(!html.includes('C:\\Sisweb'), 'login.html nunca referencia produção');
  assert.ok(!/<style[\s>]/.test(html), 'Fase 1B: login.html sem <style> inline (auth.css standalone)');
  const authCss = read('styles/auth.css');
  for (const sel of ['body.sw-auth .modal.open', 'body.sw-auth .container', '@keyframes swFadeIn']) {
    assert.ok(authCss.includes(sel), `auth.css standalone contém: ${sel}`);
  }
  assert.ok(authCss.includes('body.sw-auth *'), 'Fase 4: preflight box-sizing escopado (anti-overflow)');
});

test('Engrenagem: menu Tema com Claro/Escuro/Configurações', () => {
  const menu = read('menu-component.js');
  assert.ok(menu.includes('settings-theme-section'), 'seção Tema no settings-panel');
  for (const mode of ['light', 'dark', 'config']) {
    assert.ok(menu.includes(`data-theme-option="${mode}"`), `opção de tema: ${mode}`);
  }
  assert.ok(menu.includes('role="menuitemradio"'), 'opções acessíveis como radio');
  assert.ok(menu.includes('logout-link'), 'Sair preservado');
  assert.ok(menu.includes('user-profile.html'), 'Meu Perfil preservado');
});

test('index.html: integra tema sem quebrar dashboard', () => {
  const html = read('index.html');
  for (const needle of [
    'styles/sisweb-tokens.css',
    'styles/dashboard-theme.css',
    'js/sisweb-theme.js',
    'data-theme'
  ]) {
    assert.ok(html.includes(needle), `index.html deve conter ${needle}`);
  }
  assert.ok(html.includes('<main-menu>'), 'menu global preservado');
  assert.ok(html.includes('DashboardCore'), 'boot do dashboard preservado');
  assert.ok(html.includes('resolveAuthenticatedTenant'), 'tenant guard preservado');
  assert.ok(html.includes('refreshDashboard'), 'refresh preservado');
  assert.ok(!html.includes('C:\\Sisweb'), 'index.html nunca referencia produção');
  assert.ok(!/<style[\s>]/.test(html), 'Fase 2: index.html sem <style> inline');
});

test('Fase 2: módulo dashboard fala a marca Sisweb', () => {
  const pro = read('modules/dashboard/dashboard-professional-styles.css');
  assert.match(pro, /--primary-gradient:\s*linear-gradient\(135deg,\s*#ff7a45/i, 'gradiente primário = marca');
  assert.ok(!pro.includes('#667eea') && !pro.includes('#764ba2'), 'roxo legado eliminado do shell');
  assert.ok(pro.includes("'Aileron'"), 'tipografia oficial no módulo');
  const base = read('modules/dashboard/dashboard-styles.css');
  assert.match(base, /--dashboard-primary:\s*#fe6a00/i, 'primário do módulo = marca');
  assert.ok(!base.includes('#3498db'), 'azul legado eliminado do shell');
  const widgets = read('modules/dashboard/dashboard-widgets.js');
  assert.ok(widgets.includes("primary: '#fe6a00'"), 'charts na marca (só dataset visual)');
  assert.ok(!widgets.includes('#3498db'), 'azul legado fora dos widgets');
});

test('Fase 3: vendas/financas/estoque integrados ao shell de tema', () => {
  for (const f of ['vendas.html', 'financas.html', 'estoque.html']) {
    const html = read(f);
    for (const needle of [
      'styles/sisweb-tokens.css',
      'styles/shell-theme.css',
      'js/sisweb-theme.js',
      'data-theme',
      'menu-component.js'
    ]) {
      assert.ok(html.includes(needle), `${f} deve conter ${needle}`);
    }
    assert.ok(!html.includes('C:\\Sisweb'), `${f} nunca referencia produção`);
  }
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('sisweb-menu-shell'), 'ilha do menu vive no shell');
  const dash = read('styles/dashboard-theme.css');
  assert.ok(!dash.includes('sisweb-menu-shell'), 'ilha sem duplicação no dashboard-theme');
});

test('Fase 5: modais com identidade, sem vencidas, pill e ilha estendida', () => {
  const login = read('login.html');
  const lockups = (login.match(/class="sw-lockup"/g) || []).length;
  assert.ok(lockups >= 4, `lockup no login + 3 modais (achados: ${lockups})`);
  assert.ok(login.includes('id="registerModal"') && login.includes('id="forgotPasswordModal"')
    && login.includes('id="contactModal"'), 'modais preservados');
  const auth = read('styles/auth.css');
  assert.ok(auth.includes('.modal-content .sw-lockup-icon'), 'lockup compacto nos modais');
  assert.ok(auth.includes('.modal.open') && auth.includes('overflow-y: auto'), 'scroll na página do modal');
  const index = read('index.html');
  assert.ok(!index.includes('contasReceberVencidasTable'), 'vencidas fora do index');
  assert.ok(!index.includes('A Receber Vencidas') && !index.includes('A Pagar Vencidas'), 'títulos vencidos fora do index');
  const widgets = read('modules/dashboard/dashboard-widgets.js');
  assert.ok(!widgets.includes('A Receber Vencidas') && !widgets.includes('A Pagar Vencidas'), 'template sem vencidas');
  assert.ok(widgets.includes("getElementById('contasReceberVencidasTable')"), 'guards anti console.error');
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('.sisweb-menu-shell {') || shell.includes('main-menu .sisweb-menu-shell'), 'ilha no shell');
  assert.ok(shell.includes('subscription-inline'), 'pill no shell');
  const tokens = read('styles/sisweb-tokens.css');
  assert.ok(tokens.includes('--sw-pill-bg'), 'pill tokenizada');
});

test('Fase 6: hover por tema e modal suporte bitemático', () => {
  const tokens = read('styles/sisweb-tokens.css');
  assert.ok(tokens.includes('--sw-hover: #242b33;'), 'hover escuro');
  assert.ok(tokens.includes('--sw-hover: #e9edf1;'), 'hover claro suave');
  const shell = read('styles/shell-theme.css');
  assert.ok(!/background:\s*var\(--sw-brand-soft\)/.test(shell), 'wash claro fora do chrome');
  assert.ok(!/rgba\(254,\s*106,\s*0,\s*0\.1[28]\)/.test(shell), 'wash translúcido fora do chrome');
  for (const sel of [
    '#supportModal .support-content',
    '#supportModal .support-mode-tab.active',
    '#supportModal textarea',
    '#supportModal .support-message.customer'
  ]) {
    assert.ok(shell.includes(sel), `suporte temático: ${sel}`);
  }
});

test('Fase 7: conteúdo operacional por tema', () => {
  for (const f of ['vendas.html', 'financas.html', 'estoque.html']) {
    assert.ok(read(f).includes('styles/content-theme.css'), `${f} com camada de conteúdo`);
  }
  const content = read('styles/content-theme.css');
  for (const sel of [
    '--container-background: #1e2228',
    '.table-responsive',
    '.modal-content',
    '.pagination-controls button',
    '.tab.active',
    '.chart-container'
  ]) {
    assert.ok(content.includes(sel), `content-theme contém: ${sel}`);
  }
});

test('Fase 7 onda 2: lote operacional integrado', () => {
  for (const f of [
    'compras.html', 'client.html', 'fornecedor.html', 'species.html',
    'romaneiotora.html', 'romaneiotl.html', 'romaneiopct.html', 'romaneiopes.html',
    'preromaneio.html', 'notas-fiscais.html', 'mdf-e.html', 'importar_especies.html',
    'company.html', 'ajuda.html', 'user-profile.html'
  ]) {
    const html = read(f);
    assert.ok(html.includes('styles/sisweb-tokens.css'), `${f} com tokens`);
    assert.ok(html.includes('js/sisweb-theme.js'), `${f} com theme manager`);
    assert.ok(html.includes('data-theme-mode'), `${f} com bootstrap`);
    assert.ok(!html.includes('C:\\Sisweb'), `${f} sem referência a produção`);
  }
  const content = read('styles/content-theme.css');
  assert.ok(content.includes('#romaneioTable tbody tr:only-child td'), 'vazio da tabela temático');
  assert.ok(content.includes('#romaneioData'), 'date IDs temáticos');
});

test('Fase 8: trilhas restantes integradas', () => {
  for (const f of [
    'admin.html', 'admin-settings.html', 'admin-subscriptions.html',
    'admin-access-governance.html', 'subscription-status.html', 'ajudabitolas.html',
    'folha_pagamento/folha.html'
  ]) {
    const html = read(f);
    assert.ok(html.includes('styles/sisweb-tokens.css'), `${f} com tokens`);
    assert.ok(html.includes('js/sisweb-theme.js'), `${f} com theme manager`);
    assert.ok(html.includes('data-theme-mode'), `${f} com bootstrap`);
    assert.ok(!html.includes('C:\\Sisweb'), `${f} sem referência a produção`);
  }
  assert.ok(!read('subscription.html').includes('sisweb-tokens.css'),
    'subscription pública fora do tema por decisão (trilha de conversão)');
});

test('Fase 10: cards padrão KPI + fundo + rodapé unificados', () => {
  const content = read('styles/content-theme.css');
  for (const sel of [
    '--max-width-container: 1400px',
    '.sales-clients-stat::before',
    '.dashboard-card.receber::before',
    '.stat-card::before'
  ]) {
    assert.ok(content.includes(sel), `unificação: ${sel}`);
  }
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('.global-system-footer'), 'rodapé global no shell');
  assert.ok(shell.includes('radial-gradient(1100px 340px'), 'glow do dashboard no fundo');
});

test('Fase 13: dropdown recolhe + modais romaneio + páginas brancas', () => {
  const menu = read('menu-component.js');
  assert.ok(menu.includes('recolhe o painel ao escolher um item'), 'gear recolhe após clique');
  const content = read('styles/content-theme.css');
  for (const sel of [
    '#listaModal .table-responsive',
    '.romaneio-print-config-dialog',
    '.romaneio-print-config-option',
    '.profile-card',
    '.company-card',
    '.info-card',
    '.manual-topic'
  ]) {
    assert.ok(content.includes(sel), `fase13: ${sel}`);
  }
});

test('Fase 14: zebras cadastros + stats compras', () => {
  const content = read('styles/content-theme.css');
  for (const sel of [
    '#fornecedorListModal .table tbody tr:nth-child(even) td',
    '.purchase-suppliers-stat::before',
    '.dashboard-card.receber::before'
  ]) {
    assert.ok(content.includes(sel), `fase14: ${sel}`);
  }
});

test('Fase 15: alheios assumidos (dump fora da raiz + regex tolerante)', () => {
  assert.ok(!fs.existsSync(path.join(process.cwd(), 'redesign-do-sisweb-login-index-e-tema-light-dark.json')),
    'dump de sessão fora da raiz pública');
  try {
    const tracked = execSync('git ls-files', { cwd: process.cwd() }).toString();
    assert.ok(!tracked.includes('redesign-do-sisweb-login-index-e-tema-light-dark.json'),
      'dump de sessão nunca commitado (tmp é transitório)');
  } catch (_) {}
  const folhaTest = read('tests/folha-acoes-recolhidas.test.mjs');
  assert.ok(folhaTest.includes('var\\(--sw-surface-2\\)'), 'regex aceita valor tokenizado');
});

test('Fase 16: paleta Configurações no lugar de Sistema', () => {
  const theme = read('js/sisweb-theme.js');
  assert.ok(theme.includes('openThemeSettings'), 'manager abre Configurações');
  assert.ok(theme.includes('sisweb:theme:custom'), 'persistência de customização');
  assert.ok(theme.includes('shiftLightness'), 'suavizar/escurecer');
  const menu = read('menu-component.js');
  assert.ok(menu.includes('data-theme-option="config"'), 'opção Configurações');
  assert.ok(!menu.includes('data-theme-option="system"'), 'Sistema removido do menu');
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('.sw-theme-modal'), 'CSS da paleta');
});

test('Fase 19: paginação das abas + fluxo real + páginas na marca + tema no banco', () => {
  for (const [f, ids] of [
    ['vendas.html', ['vendasClientesPagination', 'vendasProdutosPagination', 'vendasRelatorioPagination']],
    ['compras.html', ['comprasFornecedoresPagination', 'comprasProdutosPagination', 'relComprasRelatorioPagination']]
  ]) {
    const html = read(f);
    for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${f} container ${id}`);
  }
  const vendasJs = read('vendas.js');
  for (const fn of ['renderVendasClientesPagination', 'goToVendasClientesPage', 'renderVendasProdutosPagination', 'goToVendasProdutosPage', 'renderVendasRelatorioPagination', 'goToVendasRelatorioPage']) {
    assert.ok(vendasJs.includes(`function ${fn}`), `vendas.js: ${fn}`);
  }
  const comprasJs = read('compras.js');
  for (const fn of ['renderComprasFornecedoresPagination', 'goToComprasFornecedoresPage', 'renderComprasProdutosPagination', 'goToComprasProdutosPage', 'renderRelComprasRelatorioPagination', 'goToRelComprasRelatorioPage']) {
    assert.ok(comprasJs.includes(`function ${fn}`), `compras.js: ${fn}`);
  }
  const fin = read('financas.js');
  for (const fn of ['isContaAbertaFluxo', 'valorRestanteFluxo', 'eachMovimentoFluxo', 'parseDataISOLocal']) {
    assert.ok(fin.includes(`function ${fn}`), `financas.js: ${fn}`);
  }
  assert.ok(fin.includes('ensureReceberDataForRange({ dataInicio, dataFim })'), 'detalhado garante meses');
  assert.ok(fin.includes('Sem movimentações no período'), 'tabela com estado vazio explícito');
  assert.ok(!/c\.dataVencimento === dataStr && c\.status === 'pago'/.test(fin), 'filtro pago-por-vencimento removido');
  const sub = read('subscription-status.html');
  assert.ok(sub.includes('background: var(--sw-gradient)'), 'assinatura no gradiente da marca');
  assert.ok(!sub.includes('linear-gradient(135deg, rgba(15, 23, 42'), 'hero azul removido');
  const ajuda = read('ajuda.html');
  assert.ok(ajuda.includes('.manual-hero') && ajuda.includes('background: var(--sw-gradient)'), 'ajuda com hero de marca');
  const company = read('company.html');
  assert.ok(company.includes('background: var(--sw-gradient)'), 'company com botões de marca');
  assert.ok(!company.includes('#2563eb'), 'azul legado fora da company');
  const rules = read('database.rules.json');
  assert.ok(rules.includes('"ui"'), 'nó ui nas rules');
  assert.ok(rules.includes('^(light|dark|system)$'), 'modo validado nas rules');
});

test('Fase 22: P1 — favicon marca, headers, profile, toast, PWA', () => {
  const slateGrad = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
  for (const f of ['financas.js', 'compras.html', 'romaneio-manager.js']) {
    assert.ok(!read(f).includes(slateGrad), `${f} sem header slate`);
  }
  const profile = read('user-profile.html');
  assert.ok(!profile.includes('#667eea') && !profile.includes('#764ba2'), 'profile sem roxo');
  assert.ok(profile.includes('var(--sw-gradient)'), 'profile na marca');
  const manifest = JSON.parse(read('manifest.json'));
  for (const icon of (manifest.icons || [])) {
    assert.ok(fs.existsSync(path.join(process.cwd(), icon.src.replace(/^\//, ''))), `PWA icon existe: ${icon.src}`);
  }
  const vendasHtml = read('vendas.html');
  assert.ok(vendasHtml.includes('z-index: 10000000'), 'toast acima dos modais');
  assert.ok(vendasHtml.includes('href="/assets/brand/icone.ico"'), 'favicon da marca');
  assert.ok(!vendasHtml.includes('href="favicon.ico"') && !read('folha_pagamento/folha.html').includes('href="/favicon.ico"'), 'favicon legado fora');
  const swVer = (read('sw.js').match(/const APP_VERSION = '([^']+)'/) || [])[1];
  assert.ok(swVer && read('menu-component.js').includes(`const PWA_VERSION = '${swVer}'`), 'SW e menu na mesma versão');
});

test('Fase 21: P0 leaks — injetados, h4/legend, admin, romaneio modais', () => {
  const rom = read('romaneio-manager.js');
  assert.ok(rom.includes('html[data-theme="dark"] #${this.modalId} tbody td'), 'células theme-aware');
  assert.ok(rom.includes('html[data-theme="dark"] #${this.modalId} thead th'), 'cabeçalho theme-aware');
  assert.ok(rom.includes('html[data-theme="dark"] #${this.modalId}.pagination-controls button') || rom.includes('html[data-theme="dark"] #paginationControls_${this.modalId}.pagination-controls button'), 'paginação injetada theme-aware');
  const sp = read('species-manager.js');
  assert.ok(sp.includes('html[data-theme="dark"] .species-list-filter-input'), 'filtros theme-aware');
  const spStd = read('species-modal-standard.css');
  assert.ok(spStd.includes('html[data-theme="dark"] #speciesListModal #speciesListFilter'), 'filtro standard theme-aware');
  const content = read('styles/content-theme.css');
  for (const sel of [
    '#tabelaEstoque tbody tr:active',
    '#listaModal .dropdown-content a',
    '#fornecedorModal .form-group label'
  ]) {
    assert.ok(content.includes(sel), `guarda: ${sel}`);
  }
  const login = read('login.html');
  assert.ok(login.includes('Verificação em duas etapas'), 'MFA preservado');
  assert.ok(!/<h3 style="color:#2c3e50/.test(login), 'MFA sem slate');
  for (const f of ['vendas.html', 'compras.html']) {
    const html = read(f);
    assert.ok(!/<legend[^>]*#2c3e50/.test(html), `${f} legend sem slate`);
    assert.ok(!/<h4[^>]*#2c3e50/.test(html), `${f} h4 sem slate`);
  }
  for (const f of ['admin-settings.html', 'admin-subscriptions.html']) {
    assert.ok(!read(f).includes('background: #f8fafc'), `${f} sem painel claro`);
  }
  const sub = read('subscription-status.html');
  assert.ok(!sub.includes('linear-gradient(135deg, #eff6ff'), 'message-center sem gradiente claro');
  assert.ok(sub.includes('var(--sw-alert-warning-bg)'), 'boxes de status em vars');
});

test('Fase 20: ajudabitolas padronizada + header pagamento/recebimento', () => {
  const html = read('ajudabitolas.html');
  assert.ok(html.includes('styles/content-theme.css'), 'ajudabitolas com camada de conteúdo');
  for (const sel of [
    'html[data-theme="dark"] .header-section',
    'html[data-theme="dark"] .comparison-table .correction',
    'html[data-theme="dark"] .comparison-table .previous',
    'html[data-theme="dark"] .alert-card'
  ]) {
    assert.ok(html.includes(sel), `bitolas dark: ${sel}`);
  }
  assert.ok(html.includes('html[data-theme="dark"] .result'), 'resultado com superfície dark');
  const fin = read('financas.html');
  assert.ok(fin.includes('#pagamentoModal .modal-header'), 'header pagamento padronizado');
  assert.ok(fin.includes('border-bottom: 1px solid var(--sw-border)'), 'header sem vazamento claro');
});

test('Fase 18: títulos padrão dashboard + rodapé ancorado + paleta blindada', () => {
  const content = read('styles/content-theme.css');
  assert.ok(content.includes('.sw-page-title'), 'classe padrão de título');
  assert.match(content, /\.sw-page-title\s*\{[\s\S]*?var\(--sw-gradient\)/, 'título no gradiente da marca');
  for (const f of [
    'vendas.html', 'compras.html', 'estoque.html', 'financas.html',
    'folha_pagamento/folha.html', 'notas-fiscais.html', 'mdf-e.html',
    'client.html', 'fornecedor.html', 'species.html', 'company.html',
    'romaneiopct.html', 'romaneiopes.html', 'romaneiotl.html', 'romaneiotora.html',
    'preromaneio.html', 'admin.html', 'admin-settings.html',
    'admin-subscriptions.html', 'admin-access-governance.html',
    'ajudabitolas.html', 'importar_especies.html'
  ]) {
    assert.ok(read(f).includes('sw-page-title'), `${f} com título padrão`);
  }
  const menu = read('menu-component.js');
  assert.ok(menu.includes("querySelector('.container') || document.body"), 'rodapé ancora no container');
  assert.ok(read('global-footer.js').includes("querySelector('.container') || document.body"), 'espelho do rodapé');
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('.sw-theme-close'), 'paleta tem close');
  assert.match(shell, /\.sw-theme-close\s*\{[\s\S]*?width:\s*auto !important/, 'close blindado contra button global');
});

test('Fase 17: toolbar vendas em linha própria + hover parity + chrome/etiquetas + paginação global', () => {
  const vendas = read('vendas.html');
  assert.ok(vendas.includes('relatorios-toolbar'), 'toolbar dedicada nos Relatórios');
  for (const fn of ['pagarCarregoSelecionados', 'estornarCarregoSelecionados', 'excluirCarregoSelecionados', 'imprimirRelatorio', 'abrirCustomizarColunasRelatorio', 'toggleFiltroCarregoDisponivel', 'toggleSelecionarTodos']) {
    assert.ok(vendas.includes(fn), `handler preservado: ${fn}`);
  }
  assert.ok(vendas.includes('id="relSelCount"') && vendas.includes('id="relFiltroDisponivel"'), 'ids preservados');
  const content = read('styles/content-theme.css');
  assert.ok(content.includes('#relatorios .relatorios-toolbar'), 'layout da toolbar no content-theme');

  const species = read('species-manager.js');
  assert.ok(species.includes('html[data-theme="dark"] .table tbody tr:hover'), 'hover injetado respeita dark');
  const romaneio = read('romaneio-manager.js');
  assert.ok(romaneio.includes('html[data-theme="dark"] #${this.modalId} tbody tr:hover'), 'hover romaneio respeita dark');
  assert.ok(romaneio.includes('html[data-theme="dark"] #paginationControls_${this.modalId}.pagination-controls button'), 'paginação romaneio respeita dark');
  for (const sel of [
    '#listaPedidosModal #listaPedidosTable tbody tr:hover td',
    '.table tbody tr:hover'
  ]) {
    assert.ok(content.includes(sel), `hover parity: ${sel}`);
  }

  const tokens = read('styles/sisweb-tokens.css');
  assert.ok(tokens.includes('--sw-chrome-bg: #1e2228;'), 'chrome dark');
  assert.ok(tokens.includes('--sw-chrome-bg: #ffffff;'), 'chrome light');
  assert.ok(tokens.includes('--sw-label:'), 'etiquetas tokenizadas');
  const theme = read('js/sisweb-theme.js');
  assert.ok(theme.includes('--sw-chrome-bg') && theme.includes('--sw-label'), 'paleta com Menu do topo + Etiquetas');
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('var(--sw-chrome-bg)'), 'chrome fia ilha + sininho + engrenagem');
  assert.ok(content.includes('var(--sw-label)'), 'etiquetas mapeadas no conteúdo');

  for (const f of ['fornecedor.html', 'client.html', 'species.html']) {
    const html = read(f);
    assert.ok(html.includes('background-color: var(--sw-brand)'), `${f} ativo na marca`);
  }
  for (const sel of [
    '[id$="Pagination"] button.active',
    '#romaneioTablePagination button.active',
    'html[data-theme="light"] body .pagination button.active'
  ]) {
    assert.ok(content.includes(sel), `paginação global: ${sel}`);
  }
});
