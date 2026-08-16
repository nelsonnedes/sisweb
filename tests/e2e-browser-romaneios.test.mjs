import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

function createLocalServer(rootDir, port = 0) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/romaneiopes.html';
    const filePath = path.join(rootDir, reqUrl.replace(/^\//, ''));

    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

test('E2E Browser Tests com Puppeteer - Páginas de Romaneios e Captura de Console', async (t) => {
  const rootDir = process.cwd();
  const { server, origin } = await createLocalServer(rootDir);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  } catch (launchErr) {
    console.warn('⚠️ Não foi possível iniciar Chromium do Puppeteer neste ambiente:', launchErr.message);
    server.close();
    return;
  }

  const mockTenant = 'empresa_teste_123';
  const mockClients = [
    { id: 'cli_1', name: 'Madeireira Amazonas Ltda', cidade: 'Manaus', estado: 'AM', phone: '92988887777', email: 'contato@amazonas.com' },
    { id: 'cli_2', name: 'Construtora Horizonte', cidade: 'Curitiba', estado: 'PR', phone: '41977776666', email: 'obras@horizonte.com' }
  ];
  const mockSpecies = [
    { id: 'esp_1', especie: 'Ipê', nome: 'Ipê', nomeCientifico: 'Handroanthus serratifolius' },
    { id: 'esp_2', especie: 'Cumaru', nome: 'Cumaru', nomeCientifico: 'Dipteryx odorata' }
  ];
  const mockRomaneiosPes = [
    {
      id: 'rom_pes_101',
      numero: '101',
      tipo: 'pes',
      cliente: { id: 'cli_1', name: 'Madeireira Amazonas Ltda' },
      especie: { id: 'esp_1', name: 'Ipê' },
      data: '2026-08-16',
      preco: 15.50,
      itens: [
        { id: 1, especie: 'Ipê', espessura: 25, largura: 150, comprimento: 3000, quantidade: 20, pecasPorPacote: 1, valor: 1500, volume: 0.225 },
        { id: 2, especie: 'Ipê', espessura: 50, largura: 200, comprimento: 4000, quantidade: 10, pecasPorPacote: 1, valor: 2200, volume: 0.400 }
      ]
    }
  ];

  async function setupPageWithMockAuth(page) {
    await page.evaluateOnNewDocument((tenant, clients, species, romaneios) => {
      window.__skipAuthRedirect = true;
      localStorage.setItem('user_session', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('firebase_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('auth_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('company_info', JSON.stringify({ companyId: tenant, name: 'Empresa Teste' }));
      localStorage.setItem(`companies/${tenant}/clients`, JSON.stringify(clients));
      localStorage.setItem(`companies/${tenant}/species`, JSON.stringify(species));
      localStorage.setItem(`companies/${tenant}/romaneios/pes`, JSON.stringify(romaneios));
    }, mockTenant, mockClients, mockSpecies, mockRomaneiosPes);
  }

  await t.test('1. Romaneio PES: Carregamento sem SyntaxError, Modais e Edição de Item', async () => {
    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await setupPageWithMockAuth(page);
    await page.goto(`${origin}/romaneiopes.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(pageErrors.length, 0, `Erros de página detectados em PES: ${pageErrors.join(' | ')}`);

    // 1.1 Testar abertura do modal de listar clientes
    const modalClienteVisivel = await page.evaluate(async () => {
      if (typeof openClientListModal === 'function') {
        await openClientListModal();
        const m = document.getElementById('clientListModal');
        return m && m.style.display !== 'none';
      }
      return false;
    });

    assert.ok(modalClienteVisivel, 'Modal de clientes deve abrir ao chamar openClientListModal');
    // Fechar modal de clientes para os próximos testes
    await page.evaluate(() => {
      const m = document.getElementById('clientListModal');
      if (m) m.style.display = 'none';
    });
    await new Promise((r) => setTimeout(r, 200));

    // 1.2 Testar abertura do modal de listar romaneios
    const modalRes = await page.evaluate(async () => {
      try {
        if (typeof showRomaneiosList === 'function') {
          await showRomaneiosList();
          const m = document.getElementById('romaneioListModal');
          return { exists: !!m, display: m ? m.style.display : null, error: null };
        }
        return { exists: false, display: null, error: 'showRomaneiosList not a function' };
      } catch (err) {
        return { exists: false, display: null, error: err.message };
      }
    });

    assert.strictEqual(modalRes.error, null, `Erro ao executar showRomaneiosList: ${modalRes.error}`);
    assert.ok(modalRes.exists && modalRes.display !== 'none', `Modal deve existir e estar visível: ${JSON.stringify(modalRes)}`);

    // 1.3 Testar edição de romaneio carregando itens
    const editDone = await page.evaluate(() => {
      const editBtn = document.querySelector('#romaneioListModal .action-button.edit-button, #romaneioListModal button[onclick*="editRomaneio"]');
      if (editBtn) {
        editBtn.click();
        return true;
      }
      return false;
    });

    if (editDone) {
      await new Promise((r) => setTimeout(r, 600));

      const itemRowInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll('#romaneioTableBody tr');
        const editItemBtns = document.querySelectorAll('#romaneioTableBody .btn-editar');
        return { rowCount: rows.length, editBtnCount: editItemBtns.length };
      });

      assert.ok(itemRowInfo.rowCount > 0, 'Itens do romaneio devem carregar na tabela');
      assert.ok(itemRowInfo.editBtnCount > 0, 'Coluna Ações deve conter botões .btn-editar');

      // 1.4 Testar clique no botão de editar item
      const itemEditDone = await page.evaluate(() => {
        const editItemBtn = document.querySelector('#romaneioTableBody .btn-editar');
        if (editItemBtn) {
          editItemBtn.click();
          return true;
        }
        return false;
      });

      if (itemEditDone) {
        await new Promise((r) => setTimeout(r, 400));

        const formState = await page.evaluate(() => {
          const btnAdicionar = document.getElementById('btnAdicionar');
          const esp = document.getElementById('espessura')?.value;
          return { btnText: btnAdicionar?.textContent?.trim(), espessura: esp };
        });

        assert.match(formState.btnText, /Atualizar Item/, 'Botão Adicionar deve mudar para Atualizar Item');
        assert.ok(formState.espessura, 'Campo espessura deve ser preenchido');
      }
    }

    // 1.5 Testar clonagem de romaneio PES
    const clonePESRes = await page.evaluate(async () => {
      if (typeof window.clonarRomaneio === 'function') {
        await window.clonarRomaneio(0);
        const btnSalvar = document.getElementById('btnSalvar');
        return {
          clonado: true,
          btnText: btnSalvar ? btnSalvar.textContent.trim() : null,
          romaneioEmEdicao: window.romaneioEmEdicao
        };
      }
      return { clonado: false };
    });
    assert.ok(clonePESRes.clonado, 'Função clonarRomaneio deve existir e executar em PES');
    assert.match(clonePESRes.btnText, /Salvar/, 'Botão deve permanecer como Salvar (não Atualizar) na clonagem');
    assert.ok(!clonePESRes.romaneioEmEdicao, 'romaneioEmEdicao deve ser limpo na clonagem PES');

    assert.strictEqual(pageErrors.length, 0, `Nenhum erro de página deve ocorrer: ${pageErrors.join(' | ')}`);
    await page.close();
  });

  await t.test('2. Romaneio TL: Carregamento sem SyntaxError e Teste de Clonagem', async () => {
    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupPageWithMockAuth(page);

    await page.goto(`${origin}/romaneiotl.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(pageErrors.length, 0, `Erros em romaneiotl: ${pageErrors.join(' | ')}`);

    const btnListar = await page.$('button[onclick*="abrirListaRomaneios"]');
    assert.ok(btnListar, 'Botão Listar deve existir em TL');

    const cloneTLRes = await page.evaluate(() => {
      return {
        hasClonarRomaneio: typeof window.clonarRomaneio === 'function',
        hasModalClonar: typeof window.ModalListaRomaneios?.clonarRomaneio === 'function',
        hasSalvarClonar: typeof window.SalvarRomaneio?.clonarRomaneio === 'function'
      };
    });
    assert.ok(cloneTLRes.hasClonarRomaneio || cloneTLRes.hasModalClonar || cloneTLRes.hasSalvarClonar, 'Clonagem deve estar disponível em TL');

    await page.close();
  });

  await t.test('3. Romaneio PCT: Carregamento sem SyntaxError e Teste de Clonagem', async () => {
    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupPageWithMockAuth(page);

    await page.goto(`${origin}/romaneiopct.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(pageErrors.length, 0, `Erros em romaneiopct: ${pageErrors.join(' | ')}`);

    const clonePCTRes = await page.evaluate(() => {
      return {
        hasClonarPCT: typeof window.clonarRomaneioPCT === 'function',
        hasModalClonarPCT: typeof window.ModalListaRomaneiosPCT?.clonarRomaneio === 'function',
        hasCarregarClonar: typeof window.CarregarRomaneioPCT?.clonarRomaneio === 'function'
      };
    });
    assert.ok(clonePCTRes.hasClonarPCT || clonePCTRes.hasModalClonarPCT || clonePCTRes.hasCarregarClonar, 'Clonagem deve estar disponível em PCT');

    await page.close();
  });

  await t.test('4. Romaneio Tora: Carregamento sem SyntaxError e Teste de Clonagem', async () => {
    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupPageWithMockAuth(page);

    await page.goto(`${origin}/romaneiotora.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(pageErrors.length, 0, `Erros em romaneiotora: ${pageErrors.join(' | ')}`);

    const cloneToraRes = await page.evaluate(() => {
      return {
        hasClonarTora: typeof window.clonarRomaneioTora === 'function'
      };
    });
    assert.ok(cloneToraRes.hasClonarTora, 'window.clonarRomaneioTora deve estar disponível em Tora');

    await page.close();
  });

  await t.test('5. Pré-Romaneio: Carregamento sem SyntaxError e Interface Pronta', async () => {
    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    await setupPageWithMockAuth(page);

    await page.goto(`${origin}/preromaneio.html`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    assert.strictEqual(pageErrors.length, 0, `Erros em preromaneio: ${pageErrors.join(' | ')}`);
    await page.close();
  });

  if (browser) await browser.close();
  server.close();
});
