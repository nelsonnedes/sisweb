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
    if (reqUrl === '/') reqUrl = '/romaneiotl.html';
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

test('E2E Browser: Fundo dos campos e isolamento bitemático em tempo real', async (t) => {
  const rootDir = process.cwd();
  const { server, origin } = await createLocalServer(rootDir);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Mock do Firebase e autenticação para carregamento limpo
    await page.evaluateOnNewDocument(() => {
      window.__firebaseMock = true;
      localStorage.setItem('sisweb:theme', 'dark');
      localStorage.removeItem('sisweb:theme:custom');
    });

    await page.goto(`${origin}/romaneiotl.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));

    // 1. Testa Fundo Padrão dos Campos no Tema Escuro
    const darkBgDefault = await page.evaluate(() => {
      window.SiswebTheme.set('dark');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    assert.ok(darkBgDefault, 'Deve encontrar campo de input no formulário');
    // #121417 = rgb(18, 20, 23)
    assert.equal(darkBgDefault, 'rgb(18, 20, 23)', 'Fundo padrão do input no dark deve ser #121417');

    // 2. Customiza Fundo dos Campos no Tema Escuro e valida reflexo imediato
    const darkBgCustom = await page.evaluate(() => {
      window.SiswebTheme.setCustom('--sw-input-bg', '#2a3b4c', 'dark');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    // #2a3b4c = rgb(42, 59, 76)
    assert.equal(darkBgCustom, 'rgb(42, 59, 76)', 'Input deve refletir imediatamente a nova cor no Dark');

    // 3. Alterna para Tema Claro e verifica que NÃO vazou a cor do Dark
    const lightBgInitial = await page.evaluate(() => {
      window.SiswebTheme.set('light');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    // #ffffff = rgb(255, 255, 255)
    assert.equal(lightBgInitial, 'rgb(255, 255, 255)', 'Input no Claro não deve herdar cor customizada do Dark');

    // 4. Customiza Fundo dos Campos no Tema Claro e valida reflexo imediato
    const lightBgCustom = await page.evaluate(() => {
      window.SiswebTheme.setCustom('--sw-input-bg', '#fff5ea', 'light');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    // #fff5ea = rgb(255, 245, 234)
    assert.equal(lightBgCustom, 'rgb(255, 245, 234)', 'Input no Claro deve refletir cor customizada');

    // 5. Alterna de volta para Dark e verifica que o Dark mantém a sua cor sem interferência
    const darkBgReturn = await page.evaluate(() => {
      window.SiswebTheme.set('dark');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    assert.equal(darkBgReturn, 'rgb(42, 59, 76)', 'Input no Dark deve preservar suas configurações sem vazamento do Claro');

    // 6. Abre o Modal de Configurações e valida componentes
    const modalCheck = await page.evaluate(() => {
      window.SiswebTheme.openSettings();
      const modal = document.getElementById('siswebThemeModal');
      const activeTab = modal ? modal.querySelector('.sw-theme-tab.active') : null;
      const searchInput = modal ? modal.querySelector('.sw-theme-search') : null;
      const inputBgRow = modal ? modal.querySelector('.sw-theme-row[data-var="--sw-input-bg"]') : null;
      const inputBgHex = inputBgRow ? inputBgRow.querySelector('.sw-theme-hex').value : null;

      return {
        modalOpened: !!modal,
        activeTab: activeTab ? activeTab.getAttribute('data-target') : null,
        hasSearch: !!searchInput,
        inputBgHex: inputBgHex
      };
    });

    assert.equal(modalCheck.modalOpened, true, 'Modal deve abrir no DOM');
    assert.equal(modalCheck.activeTab, 'dark', 'Aba ativa deve corresponder ao tema atual');
    assert.equal(modalCheck.hasSearch, true, 'Campo de busca rápida deve estar presente');
    assert.equal(modalCheck.inputBgHex, '#2a3b4c', 'Valor exibido no controle deve bater com a cor configurada');

    // 7. Reseta tema Dark e valida restauração
    const resetResult = await page.evaluate(() => {
      window.SiswebTheme.resetCustom('dark');
      const input = document.querySelector('input[type="text"], input:not([type]), select');
      return input ? window.getComputedStyle(input).backgroundColor : null;
    });
    assert.equal(resetResult, 'rgb(18, 20, 23)', 'Input no Dark deve voltar ao padrão após reset');

    // Limpa localStorage
    await page.evaluate(() => {
      localStorage.removeItem('sisweb:theme:custom');
      localStorage.setItem('sisweb:theme', 'dark');
    });

  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
