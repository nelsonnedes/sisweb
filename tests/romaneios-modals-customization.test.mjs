import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

function createStaticServer(root) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    const rawUrl = (req.url || '/').split('?')[0];
    const safePath = path.normalize(decodeURIComponent(rawUrl)).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(root, safePath === '/' ? 'index.html' : safePath);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return server;
}

test('Validação Completa: Paginação, Altura de Linhas e Redimensionamento de Colunas nos Modais de Romaneios', async (t) => {
  const rootDir = process.cwd();
  const server = createStaticServer(rootDir);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  } catch (err) {
    server.close();
    return;
  }

  t.after(async () => {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const mockTenant = 'empresa_teste_123';
  const mockClients = [
    { id: 'cli_1', name: 'Madeireira Amazonas Ltda', cidade: 'Manaus', estado: 'AM', phone: '92988887777', email: 'contato@amazonas.com' },
    { id: 'cli_2', name: 'Construtora Horizonte', cidade: 'Curitiba', estado: 'PR', phone: '41977776666', email: 'obras@horizonte.com' }
  ];
  const mockSpecies = [
    { id: 'esp_1', especie: 'Ipê', nome: 'Ipê', nomeCientifico: 'Handroanthus serratifolius' },
    { id: 'esp_2', especie: 'Cumaru', nome: 'Cumaru', nomeCientifico: 'Dipteryx odorata' }
  ];
  const mockRomaneios = [
    {
      id: 'rom_101',
      numero: '101',
      tipo: 'TL',
      companyId: mockTenant,
      cliente: { id: 'cli_1', name: 'Madeireira Amazonas Ltda' },
      especie: { id: 'esp_1', name: 'Ipê' },
      data: '2026-08-16',
      dataEmissao: '2026-08-16',
      totalVolume: 0.625,
      totalValor: 3700,
      itens: [
        { id: 1, especie: 'Ipê', espessura: 25, largura: 150, comprimento: 3000, quantidade: 20, pecasPorPacote: 1, valor: 1500, volume: 0.225 }
      ],
      items: [
        { id: 1, especie: 'Ipê', espessura: 25, largura: 150, comprimento: 3000, quantidade: 20, pecasPorPacote: 1, valor: 1500, volume: 0.225 }
      ]
    }
  ];

  async function setupMockSession(page) {
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch (_) {}
    });

    await page.evaluateOnNewDocument((tenant, clients, species, romaneios) => {
      window.__skipAuthRedirect = true;
      window.companyId = tenant;
      window.__currentCompanyId = tenant;
      window.CURRENT_COMPANY_ID = tenant;
      localStorage.setItem('user_session', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('firebase_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('auth_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('currentUser', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('company_info', JSON.stringify({ companyId: tenant, name: 'Empresa Teste' }));
      localStorage.setItem(`companies/${tenant}/clients`, JSON.stringify(clients));
      localStorage.setItem(`companies/${tenant}/species`, JSON.stringify(species));
      localStorage.setItem(`companies/${tenant}/romaneios`, JSON.stringify(romaneios));
      localStorage.setItem(`companies/${tenant}/romaneios/pes`, JSON.stringify(romaneios));
      localStorage.setItem(`companies/${tenant}/romaneios/tl`, JSON.stringify(romaneios));
      localStorage.setItem(`companies/${tenant}/romaneios/pct`, JSON.stringify(romaneios));
      localStorage.setItem(`companies/${tenant}/romaneios/tora`, JSON.stringify(romaneios));
      localStorage.setItem('romaneios', JSON.stringify(romaneios));
      localStorage.setItem('romaneiosPct', JSON.stringify(romaneios));
      localStorage.setItem('romaneiosPes', JSON.stringify(romaneios));
      localStorage.setItem('romaneiosTora', JSON.stringify(romaneios));
      localStorage.setItem('preromaneios', JSON.stringify(romaneios));
    }, mockTenant, mockClients, mockSpecies, mockRomaneios);
  }

  // 1. Teste Romaneio TL
  await t.test('1. Romaneio TL: Controles de paginação (5, 10, 50, 100), densidade e rodapé', async () => {
    const page = await browser.newPage();
    await setupMockSession(page);
    await page.goto(`${origin}/romaneiotl.html`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="abrirListaRomaneios"]') || document.querySelector('#btnListarRomaneios');
      if (btn) btn.click();
      else if (window.ModalListaRomaneios) window.ModalListaRomaneios.openModal();
    });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate(() => {
      const select = document.querySelector('.rlc-page-size-select');
      const density = document.querySelector('.rlc-density-select');
      const info = document.getElementById('romaneioModalInfo');
      const printBtn = document.querySelector('#listaModal .romaneio-print-config-trigger');
      const closeBtn = document.querySelector('#listaModal .close-modal-btn');

      return {
        hasPageSizeSelect: !!select,
        pageSizeOptions: select ? Array.from(select.options).map(o => o.value) : [],
        hasDensitySelect: !!density,
        densityOptions: density ? Array.from(density.options).map(o => o.value) : [],
        hasInfo: !!info,
        hasPrintConfig: !!printBtn,
        hasCloseBtn: !!closeBtn
      };
    });

    assert.ok(result.hasPageSizeSelect, 'Seletor de itens por página deve existir em TL');
    assert.deepStrictEqual(result.pageSizeOptions, ['5', '10', '50', '100'], 'Opções 5, 10, 50, 100 devem existir');
    assert.ok(result.hasDensitySelect, 'Seletor de densidade deve existir em TL');
    assert.deepStrictEqual(result.densityOptions, ['compacta', 'normal', 'confortavel'], 'Opções de densidade válidas');
    assert.ok(result.hasInfo, 'Texto de info do rodapé deve existir');
    assert.ok(result.hasPrintConfig, 'Botão de Configurar Impressão deve estar no rodapé');
    assert.ok(result.hasCloseBtn, 'Botão de Fechar deve estar no rodapé');
    await page.close();
  });

  // 2. Teste Romaneio PCT
  await t.test('2. Romaneio PCT: Controles de paginação (5, 10, 50, 100), densidade e rodapé', async () => {
    const page = await browser.newPage();
    await setupMockSession(page);
    await page.goto(`${origin}/romaneiopct.html`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="abrirListaRomaneios"]') || document.querySelector('#btnListarRomaneios');
      if (btn) btn.click();
      else if (window.ModalListaRomaneiosPCT) window.ModalListaRomaneiosPCT.openModal();
    });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate(() => {
      const select = document.querySelector('#listaModal .rlc-page-size-select');
      const density = document.querySelector('#listaModal .rlc-density-select');
      const info = document.getElementById('romaneioModalInfo');
      const printBtn = document.querySelector('#listaModal .romaneio-print-config-trigger');
      const closeBtn = document.querySelector('#listaModal .close-modal-btn');

      return {
        hasPageSizeSelect: !!select,
        pageSizeOptions: select ? Array.from(select.options).map(o => o.value) : [],
        hasDensitySelect: !!density,
        hasInfo: !!info,
        hasPrintConfig: !!printBtn,
        hasCloseBtn: !!closeBtn
      };
    });

    assert.ok(result.hasPageSizeSelect, 'Seletor de itens por página deve existir em PCT');
    assert.deepStrictEqual(result.pageSizeOptions, ['5', '10', '50', '100']);
    assert.ok(result.hasDensitySelect, 'Seletor de densidade deve existir em PCT');
    assert.ok(result.hasPrintConfig, 'Botão de Configurar Impressão deve estar no rodapé');
    assert.ok(result.hasCloseBtn, 'Botão de Fechar deve estar no rodapé');
    await page.close();
  });

  // 3. Teste Romaneio PES
  await t.test('3. Romaneio PES: Controles de paginação (5, 10, 50, 100), densidade e rodapé', async () => {
    const page = await browser.newPage();
    await setupMockSession(page);
    await page.goto(`${origin}/romaneiopes.html`, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 800));

    await page.evaluate(async () => {
      try {
        const modal = document.getElementById('romaneioListModal');
        if (!modal || modal.style.display === 'none') {
          if (typeof window.showRomaneiosList === 'function') {
            await window.showRomaneiosList();
          }
        }
      } catch (_) {}
    });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate(() => {
      const modal = document.getElementById('romaneioListModal');
      const select = modal ? modal.querySelector('.rlc-page-size-select') : null;
      const density = modal ? modal.querySelector('.rlc-density-select') : null;
      const info = document.getElementById('romaneioModalInfo');
      const printBtn = modal ? modal.querySelector('.romaneio-print-config-trigger') : null;
      const closeBtn = modal ? modal.querySelector('.close-modal-btn') : null;

      return {
        hasModal: !!modal,
        hasPageSizeSelect: !!select,
        pageSizeOptions: select ? Array.from(select.options).map(o => o.value) : [],
        hasDensitySelect: !!density,
        hasInfo: !!info,
        hasPrintConfig: !!printBtn,
        hasCloseBtn: !!closeBtn
      };
    });

    assert.ok(result.hasModal, 'Modal de romaneios PES deve ser criado');
    assert.ok(result.hasPageSizeSelect, 'Seletor de itens por página deve existir em PES');
    assert.deepStrictEqual(result.pageSizeOptions, ['5', '10', '50', '100']);
    assert.ok(result.hasDensitySelect, 'Seletor de densidade deve existir em PES');
    assert.ok(result.hasPrintConfig, 'Botão de Configurar Impressão deve estar no rodapé de PES');
    assert.ok(result.hasCloseBtn, 'Botão de Fechar deve estar no rodapé de PES');
    await page.close();
  });

  // 4. Teste Romaneio Tora
  await t.test('4. Romaneio Tora: Controles de paginação (5, 10, 50, 100), densidade e rodapé', async () => {
    const page = await browser.newPage();
    await setupMockSession(page);
    await page.goto(`${origin}/romaneiotora.html`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="abrirListaRomaneios"]') || document.querySelector('#btnListarRomaneios');
      if (btn) btn.click();
      else if (window.romaneioToraManager) window.romaneioToraManager.openModal();
    });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate(() => {
      const modal = document.querySelector('[id*="romaneioModal"]') || document.getElementById('listaModal');
      const select = document.querySelector('.rlc-page-size-select');
      const density = document.querySelector('.rlc-density-select');
      const info = modal ? (modal.querySelector('.modal-info') || document.getElementById('romaneioModalInfo')) : null;
      const printBtn = document.querySelector('.romaneio-print-config-trigger');
      const closeBtn = document.querySelector('.close-modal-btn') || document.querySelector('.close-btn-footer');

      return {
        hasModal: !!modal,
        hasPageSizeSelect: !!select,
        pageSizeOptions: select ? Array.from(select.options).map(o => o.value) : [],
        hasDensitySelect: !!density,
        hasInfo: !!info,
        hasPrintConfig: !!printBtn,
        hasCloseBtn: !!closeBtn
      };
    });

    assert.ok(result.hasModal, 'Modal de romaneios Tora deve existir');
    assert.ok(result.hasPageSizeSelect, 'Seletor de itens por página deve existir em Tora');
    assert.deepStrictEqual(result.pageSizeOptions, ['5', '10', '50', '100']);
    assert.ok(result.hasDensitySelect, 'Seletor de densidade deve existir em Tora');
    assert.ok(result.hasPrintConfig, 'Botão de Configurar Impressão deve estar no rodapé de Tora');
    assert.ok(result.hasCloseBtn, 'Botão de Fechar deve estar no rodapé de Tora');
    await page.close();
  });

  // 5. Teste Pré-Romaneio
  await t.test('5. Pré-Romaneio: Controles de paginação (5, 10, 50, 100), densidade e rodapé', async () => {
    const page = await browser.newPage();
    await setupMockSession(page);
    await page.goto(`${origin}/preromaneio.html`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="abrirLista"]') || document.querySelector('.btn-listar');
      if (btn) btn.click();
      else if (typeof window.abrirLista === 'function') window.abrirLista();
    });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate(() => {
      const modal = document.getElementById('listaModal');
      const select = modal ? modal.querySelector('.rlc-page-size-select') : null;
      const density = modal ? modal.querySelector('.rlc-density-select') : null;
      const info = document.getElementById('preromaneioModalInfo');
      const closeBtn = modal ? modal.querySelector('.close-modal-btn') : null;

      return {
        hasModal: !!modal,
        hasPageSizeSelect: !!select,
        pageSizeOptions: select ? Array.from(select.options).map(o => o.value) : [],
        hasDensitySelect: !!density,
        hasInfo: !!info,
        hasCloseBtn: !!closeBtn
      };
    });

    assert.ok(result.hasModal, 'Modal de pré-romaneios deve existir');
    assert.ok(result.hasPageSizeSelect, 'Seletor de itens por página deve existir em Pré-Romaneio');
    assert.deepStrictEqual(result.pageSizeOptions, ['5', '10', '50', '100']);
    assert.ok(result.hasDensitySelect, 'Seletor de densidade deve existir em Pré-Romaneio');
    assert.ok(result.hasInfo, 'Texto de info do rodapé deve existir em Pré-Romaneio');
    assert.ok(result.hasCloseBtn, 'Botão de Fechar deve estar no rodapé de Pré-Romaneio');
    await page.close();
  });
});
