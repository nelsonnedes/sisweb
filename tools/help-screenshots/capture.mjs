import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliFull = process.argv.includes('--full');
const cliTraining = process.argv.includes('--training') || cliFull;
const defaultBaseUrl = cliTraining ? 'http://127.0.0.1:8766' : 'https://sisweb-7ce82.web.app';
const baseUrl = (process.env.SISWEB_BASE_URL || defaultBaseUrl).replace(/\/+$/, '');
const email = process.env.SISWEB_EMAIL || '';
const password = process.env.SISWEB_PASSWORD || '';
const captureMode = String(process.env.SISWEB_CAPTURE_MODE || (cliTraining ? 'training' : '')).trim().toLowerCase();
const isTrainingMode = captureMode === 'training' || /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/i.test(baseUrl);

const defaultRoutesFile = cliFull ? 'routes.full-training.generated.json' : (isTrainingMode ? 'routes.training.json' : 'routes.json');
const routesPath = path.join(__dirname, process.env.SISWEB_ROUTES_FILE || defaultRoutesFile);
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

const projectRoot = path.resolve(__dirname, '..', '..');
const outRoot = process.env.SISWEB_OUTPUT_DIR
  ? path.resolve(projectRoot, process.env.SISWEB_OUTPUT_DIR)
  : path.join(projectRoot, isTrainingMode ? 'assets/help-manual' : 'help-assets');

function urlJoin(base, p) {
  const clean = String(p || '').replace(/^\/+/, '');
  return `${base}/${clean}`;
}

async function login(page) {
  if (isTrainingMode) {
    console.log('[capture] Modo treinamento local: login real desabilitado.');
    return;
  }
  if (!email || !password) {
    console.log('[capture] SISWEB_EMAIL/SISWEB_PASSWORD não definidos. Captura seguirá sem login.');
    return;
  }

  const loginUrl = urlJoin(baseUrl, 'login.html?redirect=index.html');
  console.log('[capture] Login:', loginUrl);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
    page.locator('#loginForm button[type="submit"]').click()
  ]);

  await page.waitForTimeout(800);
}

async function installTrainingSeed(context) {
  if (!isTrainingMode) return;
  await context.addInitScript(() => {
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    const demoCompany = {
      id: 'company_treinamento',
      companyId: 'company_treinamento',
      tenantId: 'company_treinamento',
      razaoSocial: 'Empresa Treinamento Sisweb LTDA',
      nomeFantasia: 'Empresa Treinamento',
      cnpj: '00.000.000/0001-00',
      email: 'contato@treinamento.local',
      telefone: '(00) 00000-0000',
      cidade: 'Cidade Exemplo',
      estado: 'PA',
      endereco: 'Rua de Treinamento, 100'
    };
    const demoUser = {
      uid: 'uid_treinamento',
      id: 'uid_treinamento',
      email: 'operador@treinamento.local',
      displayName: 'Operador Treinamento',
      username: 'operador.treinamento',
      companyId: demoCompany.companyId,
      tenantId: demoCompany.companyId,
      hasActiveSubscription: true,
      subscription: {
        type: 'monthly',
        startDate: '2026-06-01',
        endDate: '2026-07-01'
      }
    };

    const put = (key, value) => {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };
    const putText = (key, value) => {
      try { window.localStorage.setItem(key, String(value)); } catch (_) {}
    };
    const putSession = (key, value) => {
      try { window.sessionStorage.setItem(key, String(value)); } catch (_) {}
    };

    window.__SISWEB_MANUAL_TRAINING__ = true;
    window.ENABLE_ANON_AUTH = false;
    window._FIREBASE_CONNECTED = false;
    window.firebaseConnected = false;
    window.appTenantId = demoCompany.companyId;
    window.companyInfo = demoCompany;

    put('company_info', demoCompany);
    put('companies', [demoCompany]);
    put('currentUser', demoUser);
    put('persistentUser', demoUser);
    put('users', [demoUser]);
    put('auth', { isLoggedIn: true, email: demoUser.email, username: demoUser.username, companyId: demoCompany.companyId });
    put('siswebAuthSession', {
      authenticated: true,
      uid: demoUser.uid,
      email: demoUser.email,
      companyId: demoCompany.companyId,
      source: 'manual_training_capture',
      updatedAt: now,
      expiresAt
    });
    putText('lastSuccessfulPage', 'index.html');
    putText('lastSuccessfulPageTime', String(now));
    putSession('userAuthenticated', 'true');
    putSession('lastLogin', String(now));
    putSession('redirectCount', '0');

    const clientes = [
      { id: 'cli_demo_1', nome: 'Cliente Exemplo', name: 'Cliente Exemplo', documento: '000.000.000-00', telefone: '(00) 00000-0001', cidade: 'Cidade Exemplo' },
      { id: 'cli_demo_2', nome: 'Cliente Modelo', name: 'Cliente Modelo', documento: '111.111.111-11', telefone: '(00) 00000-0002', cidade: 'Cidade Modelo' }
    ];
    const fornecedores = [
      { id: 'for_demo_1', nome: 'Fornecedor Modelo', name: 'Fornecedor Modelo', documento: '00.000.000/0001-00', telefone: '(00) 00000-0003' }
    ];
    const especies = [
      { id: 'esp_demo_1', nome: 'Espécie Modelo', name: 'Espécie Modelo', unidade: 'm³', preco: 120 },
      { id: 'esp_demo_2', nome: 'Madeira Exemplo', name: 'Madeira Exemplo', unidade: 'm³', preco: 95 }
    ];
    const produtos = [
      { id: 'prod_demo_1', codigo: 'PROD-001', nome: 'Produto Exemplo', name: 'Produto Exemplo', preco: 120, estoque: 18 },
      { id: 'prod_demo_2', codigo: 'PROD-002', nome: 'Item de Treinamento', name: 'Item de Treinamento', preco: 80, estoque: 42 }
    ];
    const pedidos = [
      { id: 'pv_demo_1', numero: 'PV-0001', cliente: 'Cliente Exemplo', total: 600, status: 'Aberto', atualizado: '06/06/2026' },
      { id: 'pv_demo_2', numero: 'PV-0002', cliente: 'Cliente Modelo', total: 250, status: 'Pago', atualizado: '05/06/2026' }
    ];
    const contas = [
      { id: 'rec_demo_1', descricao: 'Venda PV-0001', cliente: 'Cliente Exemplo', valor: 600, vencimento: '2026-06-10', status: 'aberto', tipo: 'receber' },
      { id: 'pag_demo_1', descricao: 'Compra PC-0001', fornecedor: 'Fornecedor Modelo', valor: 250, vencimento: '2026-06-12', status: 'pendente', tipo: 'pagar' }
    ];
    const funcionarios = [
      { id: 'func_demo_1', nome: 'Funcionário Exemplo', cargo: 'Operador', pix: '00000000000', pixTipo: 'cpf', pixFavorecido: 'Funcionário Exemplo', banco: 'Banco Exemplo', ativo: true },
      { id: 'func_demo_2', nome: 'Colaborador Modelo', cargo: 'Auxiliar', pix: 'funcionario@exemplo.local', pixTipo: 'email', pixFavorecido: '', banco: 'Banco Modelo', ativo: true }
    ];

    put('clientes', clientes);
    put('clients', clientes);
    put('fornecedores', fornecedores);
    put('suppliers', fornecedores);
    put('especies', especies);
    put('species', especies);
    put('produtos', produtos);
    put('products', produtos);
    put('pedidos', pedidos);
    put('vendas', pedidos);
    put('contasReceber', contas.filter((c) => c.tipo === 'receber'));
    put('contasPagar', contas.filter((c) => c.tipo === 'pagar'));
    put('funcionarios', funcionarios);
    put('folhaFuncionarios', funcionarios);
  });
}

async function applyTrainingScenario(page, scenario) {
  if (!isTrainingMode || !scenario) return;
  await page.evaluate((name) => {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
    const byId = (id) => document.getElementById(id);
    const show = (el, display = 'block') => { if (el) el.style.display = display; };
    const hide = (el) => { if (el) el.style.display = 'none'; };
    const val = (id, value) => {
      const el = byId(id);
      if (!el) return;
      el.value = value;
      el.setAttribute('value', value);
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    };
    const text = (id, value) => {
      const el = byId(id);
      if (el) el.textContent = value;
    };
    const html = (id, value) => {
      const el = byId(id);
      if (el) el.innerHTML = value;
    };
    const selectOption = (id, value, label = value) => {
      const el = byId(id);
      if (!el) return;
      if (!Array.from(el.options || []).some((opt) => opt.value === value)) {
        el.appendChild(new Option(label, value));
      }
      el.value = value;
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    };
    const badge = () => {
      if (byId('manualTrainingBadge')) return;
      const style = document.createElement('style');
      style.id = 'manualTrainingStyle';
      style.textContent = `
        body.manual-training-capture::after {
          content: "Dados fictícios - treinamento Sisweb";
          position: fixed;
          right: 18px;
          bottom: 14px;
          z-index: 2147483647;
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
          border-radius: 999px;
          padding: 8px 12px;
          font: 700 12px Arial, sans-serif;
          box-shadow: 0 8px 24px rgba(15,23,42,.12);
        }
        .manual-training-highlight {
          outline: 2px solid rgba(37, 99, 235, .22);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(style);
      document.body.classList.add('manual-training-capture');
    };
    const showTab = (id) => {
      try {
        if (typeof window.showTab === 'function') {
          window.showTab(id);
          return;
        }
      } catch (_) {}
      document.querySelectorAll('.tab-content').forEach((el) => el.classList.remove('active'));
      document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
      const panel = byId(id);
      if (panel) panel.classList.add('active');
      const button = Array.from(document.querySelectorAll('.tab')).find((el) => (el.getAttribute('onclick') || '').includes(`'${id}'`) || (el.getAttribute('onclick') || '').includes(`"${id}"`));
      if (button) button.classList.add('active');
    };
    const rows = (data) => data.map((row) => `<tr>${row.map((cell) => `<td data-label="">${esc(cell)}</td>`).join('')}</tr>`).join('');
    const rowsHtml = (data) => data.map((row) => `<tr>${row.map((cell) => `<td data-label="">${cell}</td>`).join('')}</tr>`).join('');
    const fillTable = (selector, data) => {
      const table = document.querySelector(selector);
      if (!table) return;
      const tbody = table.tagName === 'TBODY' ? table : table.querySelector('tbody');
      if (tbody) tbody.innerHTML = rows(data);
    };
    const fillTableHtml = (selector, data) => {
      const table = document.querySelector(selector);
      if (!table) return;
      const tbody = table.tagName === 'TBODY' ? table : table.querySelector('tbody');
      if (tbody) tbody.innerHTML = rowsHtml(data);
    };
    const fillFirstTable = (data) => {
      const tbody = document.querySelector('table tbody');
      if (tbody) tbody.innerHTML = rows(data);
    };
    const openModal = (id, display = 'block') => {
      const modal = byId(id);
      if (!modal) return null;
      modal.style.display = display;
      modal.classList.add('manual-training-highlight');
      return modal;
    };
    const fillModalBody = (id, title, lines) => {
      const modal = openModal(id);
      if (!modal) return;
      const titleEl = modal.querySelector('h2,h3,.modal-title');
      if (titleEl && title) titleEl.textContent = title;
      const body = modal.querySelector('.modal-body') || modal.querySelector('.support-content') || modal.querySelector('.modal-content');
      if (body) {
        body.innerHTML = `<div class="form-row">${lines.map((line) => `<div class="form-group"><label>${esc(line[0] || line)}</label>${line[1] ? `<input value="${esc(line[1])}">` : ''}</div>`).join('')}</div>`;
      }
    };
    const showPedidoForm = () => {
      const form = byId('pedidoForm');
      if (!form) return;
      form.style.display = 'block';
      form.classList.add('manual-training-highlight');
      form.scrollIntoView({ block: 'start', inline: 'nearest' });
    };
    const fillPedidoDetalhe = ({ pessoaId, pessoa, detalhes, total, numero }) => {
      openModal('visualizarPedidoModal');
      text('viewPedidoNumero', numero);
      text('viewPedidoData', '06/06/2026');
      html('viewPedidoStatus', '<span class="status-badge status-aprovado">Aprovado</span>');
      text(pessoaId, pessoa);
      const detalhesEl = byId(`${pessoaId}Detalhes`);
      if (detalhesEl) detalhesEl.textContent = detalhes;
      fillTable('#viewPedidoItensTable', [['Produto Exemplo', '2,000 UN', 'R$ 120,00', 'R$ 240,00'], ['Item de Romaneio', '1,000 m³', 'R$ 360,00', 'R$ 360,00']]);
      text('viewPedidoSubtotal', total);
      text('viewPedidoTotalQtd', '3,000');
      text('viewPedidoDesconto', 'R$ 0,00');
      text('viewPedidoTotal', total);
      fillTable('#viewPedidoPagamentoTable', [[total, '10/06/2026', 'Pix', 'Parcela de treinamento', 'Aberto']]);
      text('viewPedidoCreated', '06/06/2026 09:30');
      show(byId('viewPedidoUpdatedContainer'), 'block');
      text('viewPedidoUpdated', '06/06/2026 10:15');
    };
    const fakeQrCode = () => {
      const size = 29;
      const finder = (row, col, startRow, startCol) => {
        const r = row - startRow;
        const c = col - startCol;
        if (r < 0 || c < 0 || r > 6 || c > 6) return false;
        return r === 0 || c === 0 || r === 6 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      };
      const cells = [];
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const fixed = finder(row, col, 0, 0) || finder(row, col, 0, 22) || finder(row, col, 22, 0);
          const timing = row === 6 || col === 6;
          const value = fixed || (timing && (row + col) % 2 === 0) || ((row * 17 + col * 31 + row * col) % 7 < 3);
          cells.push(`<span style="background:${value ? '#111827' : '#fff'}"></span>`);
        }
      }
      return `<div aria-label="QR Code PIX fictício" style="width:210px;height:210px;display:grid;grid-template-columns:repeat(${size},1fr);grid-template-rows:repeat(${size},1fr);gap:0;background:#fff;padding:12px;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 0 0 10px #fff;">${cells.join('')}</div>`;
    };
    const ensureSupport = () => {
      try {
        if (typeof window.showSupport === 'function') window.showSupport();
      } catch (_) {}
      const msg = byId('siswebSupportMessage');
      if (msg) msg.value = 'Exemplo: preciso de ajuda para conferir o QR Code PIX da folha de pagamento.';
    };

    badge();
    document.querySelectorAll('.loading, #loadingModal, .spinner').forEach((el) => hide(el));
    document.querySelectorAll('input[placeholder*="Carregando"], input[value*="Carregando"]').forEach((el) => val(el.id, 'Exemplo'));
    document.querySelectorAll('*').forEach((el) => {
      if (el.childNodes && el.childNodes.length === 1 && /Carregando/i.test(el.textContent || '')) {
        el.textContent = (el.textContent || '').replace(/Carregando\.{0,3}/gi, 'Exemplo');
      }
    });

    switch (name) {
      case 'inicio':
        fillFirstTable([['Alerta', 'Financeiro', 'Título vence hoje', 'Abrir'], ['Rotina', 'Folha', 'Conferir lançamentos', 'Ver'], ['Suporte', 'Sistema', 'Ticket aguardando', 'Abrir']]);
        break;
      case 'empresa':
        val('razaoSocial', 'Empresa Treinamento Sisweb LTDA');
        val('nomeFantasia', 'Empresa Treinamento');
        val('cnpj', '00.000.000/0001-00');
        val('telefone', '(00) 00000-0000');
        val('email', 'contato@treinamento.local');
        break;
      case 'empresa-lista':
        fillModalBody('companyModal', 'Empresas cadastradas', [['Empresa Treinamento Sisweb LTDA', 'Tenant: company_treinamento'], ['CNPJ', '00.000.000/0001-00'], ['Status', 'Ativo']]);
        break;
      case 'cadastros':
        fillFirstTable([['Cliente Exemplo', '000.000.000-00', '(00) 00000-0001', 'Editar'], ['Cliente Modelo', '111.111.111-11', '(00) 00000-0002', 'Editar']]);
        break;
      case 'romaneios':
        val('cliente', 'Cliente Exemplo');
        val('especie', 'Espécie Modelo');
        fillFirstTable([['001', '2,20 x 0,35', '0,269 m³', 'Editar'], ['002', '2,40 x 0,40', '0,377 m³', 'Editar']]);
        break;
      case 'romaneios-lista':
        fillModalBody('listaModal', 'Lista de Romaneios', [['Romaneio TR-0001', 'Cliente Exemplo'], ['Tipo', 'Tora'], ['Volume', '0,646 m³']]);
        fillModalBody('listaRomaneiosModal', 'Lista de Romaneios', [['Romaneio TR-0001', 'Cliente Exemplo'], ['Tipo', 'Tora'], ['Volume', '0,646 m³']]);
        break;
      case 'vendas':
        showTab('pedidos');
        showPedidoForm();
        val('pedidoData', '2026-06-06');
        val('pedidoNumero', 'PV-0001');
        selectOption('pedidoStatus', 'aprovado', 'Aprovado');
        val('clienteBusca', 'Cliente Exemplo');
        selectOption('clienteSelect', 'cliente-exemplo', 'Cliente Exemplo');
        val('produtoManual', 'Produto Exemplo');
        val('quantidadeManual', '2');
        selectOption('unidadeManual', 'UN', 'UN');
        val('precoManual', 'R$ 120,00');
        fillTableHtml('#itensTable', [
          ['Produto Exemplo', '2,000 UN', 'R$ 120,00', 'R$ 240,00', '<button class="btn-warning btn-small"><i class="fas fa-edit"></i></button> <button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>'],
          ['Romaneio TL 001', '1,000 m³', 'R$ 360,00', 'R$ 360,00', '<button class="btn-warning btn-small"><i class="fas fa-edit"></i></button> <button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>']
        ]);
        text('subtotal', 'R$ 600,00');
        text('totalGeralQtd', '3,000');
        text('totalGeral', 'R$ 600,00');
        val('contaValor', 'R$ 600,00');
        val('contaVencimento', '2026-06-10');
        selectOption('contaTipo', 'pix', 'Pix');
        val('numeroParcelas', '1x');
        val('contaObservacao', 'Pagamento de treinamento');
        fillTableHtml('#contasReceberTable', [['R$ 600,00', '10/06/2026', 'Pix', 'Pagamento de treinamento', '<button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>']]);
        text('totalContasReceber', 'R$ 600,00');
        break;
      case 'vendas-lista':
        openModal('listaPedidosModal');
        val('searchPedidos', 'Cliente Exemplo');
        fillTableHtml('#pedidosTable', [
          ['<input type="checkbox"> PV-0001', '06/06/2026', 'Cliente Exemplo', 'R$ 600,00', '<span class="status-badge status-aprovado">Aprovado</span>', '06/06/2026 10:15', '<button class="btn-primary btn-small"><i class="fas fa-eye"></i></button> <button class="btn-warning btn-small"><i class="fas fa-edit"></i></button>'],
          ['<input type="checkbox"> PV-0002', '05/06/2026', 'Cliente Modelo', 'R$ 250,00', '<span class="status-badge status-entregue">Entregue</span>', '05/06/2026 16:40', '<button class="btn-primary btn-small"><i class="fas fa-eye"></i></button> <button class="btn-success btn-small"><i class="fas fa-print"></i></button>']
        ]);
        break;
      case 'vendas-detalhe':
        fillPedidoDetalhe({
          pessoaId: 'viewPedidoCliente',
          pessoa: 'Cliente Exemplo',
          detalhes: 'Documento: 000.000.000-00 | contato@treinamento.local',
          total: 'R$ 600,00',
          numero: 'PV-0001'
        });
        break;
      case 'compras':
        showTab('pedidos');
        showPedidoForm();
        val('pedidoData', '2026-06-06');
        val('pedidoNumero', 'PC-0001');
        selectOption('pedidoStatus', 'aprovado', 'Aprovado');
        val('fornecedorBusca', 'Fornecedor Modelo');
        selectOption('fornecedorSelect', 'fornecedor-modelo', 'Fornecedor Modelo');
        val('produtoManual', 'Produto Exemplo');
        val('quantidadeManual', '5');
        selectOption('unidadeManual', 'UN', 'UN');
        val('precoManual', 'R$ 80,00');
        fillTableHtml('#itensTable', [
          ['Produto Exemplo', '5,000 UN', 'R$ 80,00', 'R$ 400,00', '<button class="btn-warning btn-small"><i class="fas fa-edit"></i></button> <button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>'],
          ['Serviço Exemplo', '1,000 UN', 'R$ 150,00', 'R$ 150,00', '<button class="btn-warning btn-small"><i class="fas fa-edit"></i></button> <button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>']
        ]);
        text('subtotal', 'R$ 550,00');
        text('totalGeralQtd', '6,000');
        text('totalGeral', 'R$ 550,00');
        val('contaValor', 'R$ 550,00');
        val('contaVencimento', '2026-06-12');
        selectOption('contaTipo', 'pix', 'Pix');
        val('numeroParcelas', '1x');
        val('contaObservacao', 'Pagamento de treinamento');
        fillTableHtml('#contasPagarTable', [['R$ 550,00', '12/06/2026', 'Pix', 'Pagamento de treinamento', '<button class="btn-danger btn-small"><i class="fas fa-trash"></i></button>']]);
        text('totalContasPagar', 'R$ 550,00');
        break;
      case 'compras-lista':
        openModal('listaPedidosModal');
        val('searchPedidos', 'Fornecedor Modelo');
        fillTableHtml('#pedidosTable', [
          ['<input type="checkbox"> PC-0001', '06/06/2026', 'Fornecedor Modelo', 'R$ 550,00', '<span class="status-badge status-aprovado">Aprovado</span>', '06/06/2026 11:05', '<button class="btn-primary btn-small"><i class="fas fa-eye"></i></button> <button class="btn-warning btn-small"><i class="fas fa-edit"></i></button>'],
          ['<input type="checkbox"> PC-0002', '05/06/2026', 'Fornecedor Exemplo', 'R$ 320,00', '<span class="status-badge status-entregue">Entregue</span>', '05/06/2026 17:10', '<button class="btn-primary btn-small"><i class="fas fa-eye"></i></button> <button class="btn-success btn-small"><i class="fas fa-print"></i></button>']
        ]);
        break;
      case 'compras-detalhe':
        fillPedidoDetalhe({
          pessoaId: 'viewPedidoFornecedor',
          pessoa: 'Fornecedor Modelo',
          detalhes: 'Documento: 00.000.000/0001-00 | financeiro@treinamento.local',
          total: 'R$ 550,00',
          numero: 'PC-0001'
        });
        break;
      case 'estoque':
        showTab('consulta');
        fillTable('#tabelaEstoque', [['TR-0001', 'Espécie Modelo', '0,269 m³', 'Pátio A', 'Disponível', 'Ver'], ['TR-0002', 'Madeira Exemplo', '0,377 m³', 'Pátio B', 'Reservada', 'Ver']]);
        break;
      case 'estoque-rastreabilidade':
        openModal('rastreabilidadeModal');
        fillTable('#rastreabilidadeModal table', [['TR-0001', 'Romaneio TR-0001', 'Entrada', '06/06/2026'], ['TR-0001', 'Pedido PV-0001', 'Saída', '07/06/2026']]);
        break;
      case 'financas':
        showTab('receber');
        fillFirstTable([['10/06/2026', 'Cliente Exemplo', 'Venda PV-0001', 'R$ 600,00', 'Aberto', 'Pagar'], ['12/06/2026', 'Fornecedor Modelo', 'Compra PC-0001', 'R$ 250,00', 'Pendente', 'Anexar']]);
        break;
      case 'financas-pagamento':
        fillModalBody('pagamentoModal', 'Registrar Pagamento', [['Data de pagamento', '06/06/2026'], ['Valor pago', 'R$ 600,00'], ['Forma', 'PIX'], ['Observação', 'Comprovante de treinamento']]);
        fillModalBody('modalPagamento', 'Registrar Pagamento', [['Data de pagamento', '06/06/2026'], ['Valor pago', 'R$ 600,00'], ['Forma', 'PIX'], ['Observação', 'Comprovante de treinamento']]);
        break;
      case 'folha':
        show(byId('tabela-folhas-section'));
        show(byId('totais-section'));
        fillTableHtml('#folhasTableBody', [
          ['Funcionário Exemplo', 'PIX', '06/2026', 'Quinzena', '50%', 'R$ 1.800,00', 'R$ 600,00', 'R$ 120,00', 'R$ 0,00', 'R$ 0,00', 'R$ 720,00', '<button class="pix-qrcode-button"><i class="fas fa-qrcode"></i> Ver Qrcode</button>'],
          ['Colaborador Modelo', 'Conta Bancária', '06/2026', 'Mês Fechado Pago', '100%', 'R$ 1.850,00', 'R$ 0,00', 'R$ 150,00', 'R$ 120,00', 'R$ 0,00', 'R$ 0,00', '<button class="btn btn-secondary btn-sm"><i class="fas fa-chevron-down"></i> Expandir</button>']
        ]);
        text('totalBruto', 'R$ 2.450,00');
        text('totalQuinzena', 'R$ 600,00');
        text('totalAcrescimos', 'R$ 270,00');
        text('totalDescontos', 'R$ 120,00');
        text('totalLiquido', 'R$ 720,00');
        text('totalPagos', 'R$ 600,00');
        text('totalRestantes', 'R$ 720,00');
        break;
      case 'folha-funcionario':
        {
        const funcionarioModal = openModal('funcionarioModal');
        text('funcionarioModalTitle', 'Editar Funcionário');
        val('funcionarioNome', 'Funcionário Exemplo');
        val('funcionarioCpf', '000.000.000-00');
        val('funcionarioPis', '000.00000.00-0');
        val('funcionarioCtps', '0000000-00');
        val('funcionarioSalario', '1800.00');
        val('funcionarioCargo', 'Operador');
        selectOption('funcionarioTipoContrato', 'clt', 'CLT');
        val('funcionarioDataAdmissional', '2026-01-10');
        selectOption('funcionarioFormaPagamento', 'PIX', 'PIX');
        val('funcionarioPixFavorecido', 'Funcionário Exemplo');
        val('funcionarioPix', '00000000000');
        selectOption('funcionarioPixTipo', 'cpf', 'CPF');
        val('funcionarioBanco', 'Banco Exemplo');
        const pixGroup = byId('funcionarioPixGroup');
        const pixTipoGroup = byId('funcionarioPixTipoGroup');
        if (pixGroup) pixGroup.classList.add('manual-training-highlight');
        if (pixTipoGroup) pixTipoGroup.classList.add('manual-training-highlight');
        const body = funcionarioModal && funcionarioModal.querySelector('.modal-body');
        if (body) body.scrollTop = 360;
        }
        break;
      case 'folha-qr':
        openModal('pixQrCodeModal');
        html('pixQrCodeContainer', fakeQrCode());
        text('pixQrCodeFavorecido', 'Favorecido: Funcionário Exemplo');
        text('pixQrCodeBanco', 'Banco: Banco Exemplo');
        text('pixQrCodeChave', 'Chave Pix: 000.000.000-00');
        text('pixQrCodeLiquido', 'Valor líquido: R$ 720,00');
        break;
      case 'fiscal':
        showTab('emissao');
        val('nfNumero', 'Auto');
        val('nfSerie', '1');
        val('nfDataEmissao', '2026-06-06');
        selectOption('nfTipo', 'saida', 'Saída');
        selectOption('nfNatOpSelect', 'Venda de Mercadoria', 'Venda de Mercadoria');
        val('nfClienteBusca', 'Cliente Exemplo');
        selectOption('nfCliente', 'cli_demo_1', 'Cliente Exemplo');
        val('nfClienteCnpj', '00.000.000/0001-00');
        val('nfClienteEndereco', 'Rua de Treinamento, 100');
        val('nfClienteCidade', 'Cidade Exemplo');
        text('nfSummaryAmbiente', 'Homologação');
        text('nfSummaryCliente', 'Cliente Exemplo');
        text('nfSummaryItens', '2');
        text('nfSummaryTotal', 'R$ 620,00');
        text('nfSummaryValidacao', 'Pronto para revisão');
        fillTable('#itensContainer', [['Produto Exemplo', '0000.00.00', '5102', '2', 'R$ 100,00', 'R$ 200,00'], ['Frete Exemplo', '0000.00.00', '5102', '1', 'R$ 420,00', 'R$ 420,00']]);
        fillTable('#notasTable', [['NF-0001', '1', '06/06/2026', 'Cliente Exemplo', 'R$ 620,00', 'Emitida', 'DANFE']]);
        break;
      case 'mdfe':
        showTab('emissao');
        val('mdfeNumero', 'Auto');
        val('mdfeSerie', '1');
        val('mdfeDataEmissao', '2026-06-06T09:30');
        selectOption('mdfeUfInicio', 'PA', 'PA');
        val('mdfeObservacoes', 'MDF-e fictício para treinamento.');
        fillTable('#mdfesTable', [['MDF-0001', '06/06/2026', 'PA', 'Emitido', 'Encerrar'], ['MDF-0002', '05/06/2026', 'PA', 'Encerrado', 'Ver']]);
        break;
      case 'assinatura':
        text('planType', 'Plano Mensal');
        text('currentPlan', 'R$ 99,00');
        text('startDate', '01/06/2026');
        text('endDate', '01/07/2026');
        text('daysLeft', '25 dias');
        break;
      case 'assinatura-pagamento':
        fillModalBody('paymentModal', 'Pagamento', [['Plano', 'Mensal'], ['Valor', 'R$ 99,00'], ['PIX automático', 'Gerar QR Code'], ['Comprovante', 'Enviar arquivo']]);
        break;
      case 'perfil':
        text('profileName', 'Operador Treinamento');
        text('profileEmail', 'operador@treinamento.local');
        break;
      case 'perfil-editar':
        fillModalBody('editPersonalModal', 'Editar Informações Pessoais', [['Nome', 'Operador Treinamento'], ['Telefone', '(00) 00000-0000'], ['Foto', 'Selecionar arquivo']]);
        break;
      case 'suporte':
        ensureSupport();
        break;
      default:
        fillFirstTable([['Exemplo', 'Dado fictício', 'Treinamento', 'Ver']]);
    }
  }, scenario);
  await page.waitForTimeout(350);
}

async function ensureReady(page) {
  const waitStable = async () => {
    let last = page.url();
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(350);
      const cur = page.url();
      if (cur === last) return;
      last = cur;
    }
  };

  const safeEvaluate = async (fn, attempts = 4) => {
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        return await page.evaluate(fn);
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        lastErr = err;
        if (msg.toLowerCase().includes('execution context was destroyed') || msg.toLowerCase().includes('target closed')) {
          await page.waitForTimeout(500);
          continue;
        }
        throw err;
      }
    }
    return null; // Return null instead of throwing to prevent script from crashing
  };

  await page.waitForLoadState('domcontentloaded');
  await waitStable();
  await page.waitForLoadState('networkidle').catch(() => null);
  await safeEvaluate(() => {
    try {
      const modals = ['helpModal', 'aboutModal'];
      modals.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    } catch (_) {}
  });
}

async function applyGenericTrainingAction(page, action) {
  if (!isTrainingMode || !action) return;
  await page.evaluate((input) => {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
    const byId = (id) => document.getElementById(id);
    const show = (el, display = 'block') => {
      if (!el) return;
      el.hidden = false;
      el.style.display = display;
      el.classList.add('show');
    };
    const val = (el, value, dispatch = true) => {
      if (!el) return;
      el.value = value;
      el.setAttribute('value', value);
      if (dispatch) {
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      }
    };
    const badge = () => {
      if (byId('manualTrainingStyle')) return;
      const style = document.createElement('style');
      style.id = 'manualTrainingStyle';
      style.textContent = `
        body.manual-training-capture::after {
          content: "Dados fictícios - treinamento Sisweb";
          position: fixed;
          right: 18px;
          bottom: 14px;
          z-index: 2147483647;
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
          border-radius: 999px;
          padding: 8px 12px;
          font: 700 12px Arial, sans-serif;
          box-shadow: 0 8px 24px rgba(15,23,42,.12);
        }
        .manual-training-highlight {
          outline: 2px solid rgba(37, 99, 235, .22);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(style);
      document.body.classList.add('manual-training-capture');
    };
    const fillInputs = (root = document) => {
      root.querySelectorAll('input, textarea').forEach((el) => {
        if (root === document && el.closest('.modal,.modal-overlay')) return;
        if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio') return;
        if (el.value && !/carregando|undefined|null/i.test(el.value)) return;
        const name = `${el.id || ''} ${el.name || ''} ${el.placeholder || ''}`.toLowerCase();
        if (el.type === 'date') val(el, '2026-06-06', false);
        else if (el.type === 'month') val(el, '2026-06', false);
        else if (el.type === 'number') val(el, '1', false);
        else if (name.includes('email')) val(el, 'treinamento@exemplo.local', false);
        else if (name.includes('cnpj') || name.includes('cpf') || name.includes('doc')) val(el, '00.000.000/0001-00', false);
        else if (name.includes('telefone') || name.includes('celular')) val(el, '(00) 00000-0000', false);
        else if (name.includes('valor') || name.includes('preco') || name.includes('total')) val(el, 'R$ 100,00', false);
        else if (name.includes('senha')) val(el, '********', false);
        else val(el, 'Dado fictício de treinamento', false);
      });
      root.querySelectorAll('select').forEach((el) => {
        if (root === document && el.closest('.modal,.modal-overlay')) return;
        if (!el.options || !el.options.length) el.appendChild(new Option('Exemplo', 'exemplo'));
        if (!el.value && el.options.length > 1) el.value = el.options[1].value;
        else if (!el.value) el.value = el.options[0].value;
      });
    };
    const fillTables = (root = document) => {
      root.querySelectorAll('tbody').forEach((tbody) => {
        const text = (tbody.textContent || '').trim();
        const empty = !tbody.children.length || /nenhum|carregando|sem dados|não encontrado/i.test(text);
        if (!empty && tbody.querySelectorAll('tr').length > 1) return;
        const headerCount = Math.max(3, Math.min(8, tbody.closest('table')?.querySelectorAll('thead th').length || 4));
        const samples = [
          ['Exemplo 001', '06/06/2026', 'Cliente Exemplo', 'R$ 600,00', 'Aberto', 'Ver', 'Editar', 'Imprimir'],
          ['Exemplo 002', '07/06/2026', 'Fornecedor Modelo', 'R$ 250,00', 'Conferido', 'Ver', 'Editar', 'Imprimir']
        ];
        tbody.innerHTML = samples.map((row) => `<tr>${row.slice(0, headerCount).map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
      });
    };
    const activateTab = (idOrLabel) => {
      const value = String(idOrLabel || '').trim();
      if (!value) return;
      try {
        if (typeof window.showTab === 'function') {
          window.showTab(value);
          return;
        }
      } catch (_) {}
      const target = byId(value) || Array.from(document.querySelectorAll('.tab-content')).find((el) => {
        const text = `${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
        return text.includes(value.toLowerCase());
      });
      if (!target) return;
      document.querySelectorAll('.tab-content').forEach((el) => {
        el.classList.remove('active');
        el.hidden = true;
        if (el !== target) el.style.display = 'none';
      });
      target.hidden = false;
      target.style.display = 'block';
      target.classList.add('active');
    };
    const openModal = (id, title) => {
      const modal = byId(id);
      if (!modal) return;
      show(modal, 'block');
      modal.classList.add('manual-training-highlight');
      const titleEl = modal.querySelector('h1,h2,h3,.modal-title');
      if (titleEl && title) titleEl.textContent = title;
      fillInputs(modal);
      fillTables(modal);
      const body = modal.querySelector('.modal-body,.modal-content,.support-content') || modal;
      if (body && !body.querySelector('table,input,textarea,select') && (body.textContent || '').trim().length < 80) {
        const panel = document.createElement('div');
        panel.className = 'manual-training-highlight';
        panel.style.cssText = 'padding:16px;border:1px solid #dbeafe;border-radius:8px;background:#f8fbff;color:#1e293b;';
        panel.innerHTML = `<strong>${esc(title || id)}</strong><p style="margin:8px 0 0;">Janela demonstrativa com dados fictícios para treinamento.</p>`;
        body.appendChild(panel);
      }
    };
    const showReportState = (label) => {
      activateTab('relatorios');
      ['relatorioResult', 'reportResult', 'resultadoRelatorio', 'relatoriosResultado'].forEach((id) => show(byId(id), 'block'));
      fillInputs();
      fillTables();
      let panel = byId('manualTrainingActionPanel');
      if (!panel) {
        panel = document.createElement('section');
        panel.id = 'manualTrainingActionPanel';
        panel.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:8px;background:#f8fbff;color:#1e293b;';
        const main = document.querySelector('.container, main, body');
        main.appendChild(panel);
      }
      panel.innerHTML = `<h3 style="margin:0 0 8px;color:#1e3a8a;">${esc(label || 'Relatório')}</h3><p style="margin:0;">Estado de treinamento para demonstrar filtros, colunas, impressão e exportação sem dados reais.</p>`;
      panel.scrollIntoView({ block: 'center', inline: 'nearest' });
    };
    const showMobileMenu = () => {
      const menu = document.querySelector('.mobile-menu, .menu-toggle, .hamburger, .mobile-menu-link');
      const dropdowns = document.querySelectorAll('.dropdown-content, .settings-dropdown, .alerts-panel');
      dropdowns.forEach((el) => show(el, 'block'));
      if (menu) menu.classList.add('manual-training-highlight');
    };
    const closeModalsForCleanState = () => {
      document.querySelectorAll('.modal, .modal-overlay').forEach((el) => {
        el.classList.remove('show', 'manual-training-highlight');
        el.style.display = 'none';
      });
    };

    badge();
    document.querySelectorAll('.loading, #loadingModal, .spinner').forEach((el) => { el.style.display = 'none'; });
    if (input.kind !== 'modal') closeModalsForCleanState();
    fillInputs();
    fillTables();

    if (input.kind === 'tab') {
      activateTab(input.id || input.label);
      fillInputs();
      fillTables();
    } else if (input.kind === 'modal') {
      openModal(input.id, input.title);
    } else if (input.kind === 'action') {
      const label = input.label || input.onclick || 'Ação';
      const lower = String(label).toLowerCase();
      if (lower.includes('coluna')) {
        openModal('customizarColunasModal', 'Configurar colunas');
        openModal('columnsConfigModal', 'Configurar colunas');
        openModal('folhasColumnsConfigModal', 'Configurar colunas');
      } else if (lower.includes('listar')) {
        ['listaPedidosModal', 'listaModal', 'listaRomaneiosModal', 'folhasFechadasModal'].forEach((id) => openModal(id, label));
      } else {
        showReportState(label);
      }
    } else if (input.kind === 'mobile') {
      showMobileMenu();
    }
  }, action);
  await page.waitForTimeout(300);
}

async function runActions(page, actions) {
  const list = Array.isArray(actions) ? actions : [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const type = String(a.type || '').toLowerCase();
    try {
      if (type === 'wait') {
        const ms = Math.max(0, Math.min(60000, Number(a.ms || 0)));
        if (ms) await page.waitForTimeout(ms);
        continue;
      }
      if (type === 'waitfor') {
        const selector = String(a.selector || '').trim();
        const timeoutMs = Math.max(0, Math.min(15000, Number(a.timeoutMs || 0) || 6000));
        if (selector) await page.waitForSelector(selector, { timeout: timeoutMs }).catch(() => null);
        continue;
      }
      if (type === 'click') {
        const selector = String(a.selector || '').trim();
        if (!selector) continue;
        const loc = page.locator(selector).first();
        if (await loc.count()) {
          await loc.click({ timeout: 4000 }).catch(() => null);
        }
        continue;
      }
      if (type === 'eval') {
        const script = String(a.script || '').trim();
        if (!script) continue;
        await page.evaluate((s) => {
          try {
            // eslint-disable-next-line no-eval
            return eval(s);
          } catch (_) {
            return null;
          }
        }, script).catch(() => null);
        continue;
      }
      if (type === 'training') {
        await applyTrainingScenario(page, String(a.name || '').trim());
        continue;
      }
      if (type === 'trainingpage') {
        await applyGenericTrainingAction(page, { kind: 'page', route: a.route || '' });
        continue;
      }
      if (type === 'trainingtab') {
        await applyGenericTrainingAction(page, { kind: 'tab', id: a.id || '', label: a.label || '' });
        continue;
      }
      if (type === 'trainingmodal') {
        await applyGenericTrainingAction(page, { kind: 'modal', id: a.id || '', title: a.title || '' });
        continue;
      }
      if (type === 'trainingaction') {
        await applyGenericTrainingAction(page, { kind: 'action', label: a.label || '', onclick: a.onclick || '' });
        continue;
      }
      if (type === 'trainingmobile') {
        await applyGenericTrainingAction(page, { kind: 'mobile' });
        continue;
      }
    } catch (_) {}
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await installTrainingSeed(context);
  const page = await context.newPage();

  try {
    await login(page);

    for (const r of routes) {
      const id = String(r.id || '').trim();
      const p = String(r.path || '').trim();
      if (!id || !p) continue;

      const url = urlJoin(baseUrl, p);
      const outFile = path.join(outRoot, `${id}.png`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });

      console.log('[capture] Página:', url);
      if (r.viewport && r.viewport.width && r.viewport.height) {
        await page.setViewportSize({
          width: Number(r.viewport.width),
          height: Number(r.viewport.height)
        }).catch(() => null);
      } else {
        await page.setViewportSize({ width: 1366, height: 768 }).catch(() => null);
      }
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await ensureReady(page);
      await runActions(page, r.actions);
      await ensureReady(page);

      await page.screenshot({ path: outFile, fullPage: true });
      console.log('[capture] OK:', path.relative(projectRoot, outFile));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[capture] Erro:', err);
  process.exitCode = 1;
});
