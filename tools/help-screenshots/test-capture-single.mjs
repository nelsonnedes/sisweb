import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(projectRoot, p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.json': 'application/json'
    }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(8788);

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  await page.evaluateOnNewDocument(() => {
    const now = Date.now();
    const demoCompany = {
      id: 'company_treinamento',
      companyId: 'company_treinamento',
      tenantId: 'company_treinamento',
      razaoSocial: 'Madeireira Modelo Sisweb LTDA',
      nomeFantasia: 'Madeireira Modelo',
      cnpj: '12.345.678/0001-90',
      email: 'contato@madeireiramodelo.local',
      telefone: '(91) 98765-4321',
      cidade: 'Ananindeua',
      estado: 'PA',
      endereco: 'Rodovia BR-316, KM 12',
      bairro: 'Centro',
      cep: '67000-000',
      hasActiveSubscription: true,
      subscriptionPlan: 'Plano Pro Anual',
      subscriptionStatus: 'active',
      planType: 'annual'
    };

    const demoUser = {
      uid: 'uid_treinamento',
      id: 'uid_treinamento',
      userId: 'uid_treinamento',
      email: 'operador@madeireiramodelo.local',
      displayName: 'Nelson Gerente',
      username: 'nelson.gerente',
      role: 'admin',
      companyId: demoCompany.companyId,
      companyID: demoCompany.companyId,
      tenantId: demoCompany.companyId,
      hasActiveSubscription: true,
      subscriptionStatus: 'active',
      accountStatus: 'active',
      status: 'active',
      subscription: {
        type: 'annual',
        plan: 'Plano Pro Anual',
        active: true,
        startDate: '2026-01-01',
        endDate: '2028-12-31'
      }
    };

    const clientes = [
      { id: 'cli_1', nome: 'Construtora Norte Madeiras', name: 'Construtora Norte Madeiras', documento: '12.345.678/0001-99', telefone: '(91) 98111-2233', email: 'compras@nortemadeiras.com.br', cidade: 'Belém', estado: 'PA' },
      { id: 'cli_2', nome: 'Mobiliária Amazônia Real', name: 'Mobiliária Amazônia Real', documento: '98.765.432/0001-11', telefone: '(91) 98222-3344', email: 'contato@amazoniareal.com.br', cidade: 'Ananindeua', estado: 'PA' }
    ];

    const fornecedores = [
      { id: 'for_1', nome: 'Manejo Florestal Sustentável Pará', name: 'Manejo Florestal Sustentável Pará', documento: '22.333.444/0001-55', telefone: '(91) 99111-0000', cidade: 'Paragominas', estado: 'PA' }
    ];

    const especies = [
      { id: 'esp_1', nome: 'Ipê Amarelo', name: 'Ipê Amarelo', nomeCientifico: 'Handroanthus albus', unidade: 'm³', preco: 2800, coeficienteFrancon: 0.7854 },
      { id: 'esp_2', nome: 'Maçaranduba', name: 'Maçaranduba', nomeCientifico: 'Manilkara huberi', unidade: 'm³', preco: 1950, coeficienteFrancon: 0.7854 },
      { id: 'esp_3', nome: 'Cumaru', name: 'Cumaru', nomeCientifico: 'Dipteryx odorata', unidade: 'm³', preco: 2400, coeficienteFrancon: 0.7854 }
    ];

    const produtos = [
      { id: 'prod_1', codigo: 'PRCH-IPE', nome: 'Prancha Ipê 5x20cm 4m', name: 'Prancha Ipê 5x20cm 4m', especie: 'Ipê Amarelo', preco: 3200, estoque: 45.8, unidade: 'm³' }
    ];

    const pedidosVenda = [
      { id: 'pv_101', numero: 'PV-2026-0089', cliente: 'Construtora Norte Madeiras', data: '16/09/2026', total: 48500.00, status: 'Faturado', atualizado: '16/09/2026', itens: [{ produto: 'Prancha Ipê 5x20cm 4m', qtd: 12.5, preco: 3200, subtotal: 40000 }] }
    ];

    const pedidosCompra = [
      { id: 'pc_201', numero: 'PC-2026-0045', fornecedor: 'Manejo Florestal Sustentável Pará', data: '14/09/2026', total: 64000.00, status: 'Recebido', atualizado: '14/09/2026' }
    ];

    const contasReceber = [
      { id: 'rec_1', descricao: 'Venda PV-2026-0089', cliente: 'Construtora Norte Madeiras', valor: 48500.00, vencimento: '2026-09-30', status: 'pendente', tipo: 'receber' }
    ];

    const contasPagar = [
      { id: 'pag_1', descricao: 'Compra PC-2026-0045', fornecedor: 'Manejo Florestal Sustentável Pará', valor: 64000.00, vencimento: '2026-09-28', status: 'pendente', tipo: 'pagar' }
    ];

    const torasEstoque = [
      { id: 'tora_1', plaqueta: 'PLQ-8901', especie: 'Ipê Amarelo', d1: 68, d2: 72, diametroMedio: 70, comprimento: 6.2, volumeFrancon: 2.386, volumeGeometrico: 2.386, patio: 'Pátio Principal - Setor A', dataEntrada: '14/09/2026', status: 'No Pátio' }
    ];

    const funcionarios = [
      { id: 'func_1', nome: 'Carlos Silva de Oliveira', cargo: 'Operador de Serra Fita', salarioBase: 3400, pix: '12345678900', pixTipo: 'cpf', pixFavorecido: 'Carlos Silva de Oliveira', banco: 'Banco do Brasil', ativo: true, quinzena1: 1700, quinzena2: 1700, status: 'Ativo' }
    ];

    const romaneios = [
      { id: 'rom_1', numero: 'ROM-2026-0341', tipo: 'Tora', tipoDesc: 'Romaneio de Tora Francon', cliente: 'Exportadora Tapajós Wood', motorista: 'José Ribamar', placa: 'QER-4J29', data: '16/09/2026', totalPecas: 18, volumeTotal: 44.820, valorTotal: 89640.00, status: 'Carregado' }
    ];

    const put = (key, val) => {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {}
    };

    put('company_info', demoCompany);
    put('companies', [demoCompany]);
    put('currentUser', demoUser);
    put('persistentUser', demoUser);
    put('users', [demoUser]);
    put('userProfile', demoUser);
    put('auth', { isLoggedIn: true, email: demoUser.email, username: demoUser.username, companyId: demoCompany.companyId });
    put('siswebAuthSession', {
      authenticated: true,
      uid: demoUser.uid,
      email: demoUser.email,
      companyId: demoCompany.companyId,
      source: 'manual_training_capture',
      updatedAt: now,
      expiresAt: now + 30 * 24 * 3600 * 1000
    });
    sessionStorage.setItem('userAuthenticated', 'true');
    sessionStorage.setItem('lastLogin', String(now));
    sessionStorage.setItem('redirectCount', '0');

    put('clientes', clientes);
    put('clients', clientes);
    put('fornecedores', fornecedores);
    put('suppliers', fornecedores);
    put('especies', especies);
    put('species', especies);
    put('produtos', produtos);
    put('products', produtos);
    put('pedidos', pedidosVenda);
    put('vendas', pedidosVenda);
    put('compras', pedidosCompra);
    put('pedidosCompra', pedidosCompra);
    put('contasReceber', contasReceber);
    put('contasPagar', contasPagar);
    put('estoqueToras', torasEstoque);
    put('toras', torasEstoque);
    put('funcionarios', funcionarios);
    put('folhaFuncionarios', funcionarios);
    put('romaneios', romaneios);
    put('preromaneios', romaneios);

    window.__SISWEB_MANUAL_TRAINING__ = true;
    window.__skipAuthRedirect = true;
    window._FIREBASE_CONNECTED = true;
    window.firebaseConnected = true;
    window.ENABLE_ANON_AUTH = false;
    window.appTenantId = demoCompany.companyId;
    window.companyInfo = demoCompany;
    window.currentUser = demoUser;
  });

  const allPages = [
    'index.html',
    'company.html',
    'client.html',
    'fornecedor.html',
    'species.html',
    'preromaneio.html',
    'romaneiotora.html',
    'romaneiotl.html',
    'romaneiopct.html',
    'romaneiopes.html',
    'vendas.html',
    'compras.html',
    'estoque.html',
    'financas.html',
    'folha_pagamento/folha.html',
    'notas-fiscais.html',
    'subscription-status.html'
  ];

  for (const p of allPages) {
    const targetUrl = `http://127.0.0.1:8788/${p}`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    // Apply visual data directly into DOM
    await page.evaluate(() => {
      // populate forms / tables if empty
      const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
      const byId = (id) => document.getElementById(id);
      
      // Remove any redirect or alert overlays
      const modal = document.querySelector('.sisweb-operational-state');
      if (modal) modal.remove();
      const loginOverlay = document.querySelector('#loginForm, .login-container');
      if (loginOverlay && !window.location.pathname.includes('login.html')) loginOverlay.style.display = 'none';

      // Ensure main content is visible
      const containers = document.querySelectorAll('.container, .main-content, #app, .dashboard-container');
      containers.forEach(c => { c.style.display = 'block'; c.style.visibility = 'visible'; });
    });

    await new Promise(r => setTimeout(r, 600));
    console.log(`[${p}] -> URL: ${page.url()} | Titulo: ${await page.title()}`);
    await page.screenshot({ path: `tmp/test-${p.replace(/[^a-z0-9]/gi, '_')}.png` });
  }

  await browser.close();
  server.close();
  console.log('Todos os testes concluidos!');
}

main().catch(console.error);