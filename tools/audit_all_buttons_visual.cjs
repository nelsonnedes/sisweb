const puppeteer = require('./node_modules/puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(process.cwd(), reqPath.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(4899, async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pages = [
    { name: 'Pré-Romaneio', url: 'http://localhost:4899/preromaneio.html' },
    { name: 'Romaneio TL', url: 'http://localhost:4899/romaneiotl.html' },
    { name: 'Romaneio PCT', url: 'http://localhost:4899/romaneiopct.html' },
    { name: 'Romaneio PES', url: 'http://localhost:4899/romaneiopes.html' },
    { name: 'Romaneio TORA', url: 'http://localhost:4899/romaneiotora.html' }
  ];

  const auditReport = {};

  for (const pInfo of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.evaluateOnNewDocument(() => {
      window.__skipAuthRedirect = true;
      localStorage.setItem('user_session', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('firebase_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('auth_user', JSON.stringify({ uid: 'mock_uid', email: 'test@sisweb.com' }));
      localStorage.setItem('company_info', JSON.stringify({ companyId: 'comp_test', name: 'Empresa Teste' }));
      localStorage.setItem('companies/comp_test/clients', JSON.stringify([
        { id: '1', name: 'Cliente A', cidade: 'Manaus', estado: 'AM' }
      ]));
      localStorage.setItem('companies/comp_test/species', JSON.stringify([
        { id: '1', especie: 'Ipê', nome: 'Ipê', nomeCientifico: 'Handroanthus' }
      ]));
      localStorage.setItem('companies/comp_test/fornecedores', JSON.stringify([
        { id: '1', name: 'Fornecedor A', cidade: 'Manaus', estado: 'AM' }
      ]));
    });

    await page.goto(pInfo.url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 600));

    // Coletar estilos computados dos botões principais da página
    const pageButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .btn, .tab-button, .btn-adicionar, .btn-salvar, .btn-listar'));
      return btns
        .filter(b => !b.closest('.modal') && b.offsetParent !== null)
        .map(b => {
          const style = window.getComputedStyle(b);
          return {
            text: b.innerText.trim().replace(/\n/g, ' '),
            id: b.id || null,
            className: b.className,
            bg: style.backgroundColor,
            color: style.color,
            height: style.height,
            padding: style.padding,
            borderRadius: style.borderRadius,
            fontSize: style.fontSize,
            display: style.display,
            order: style.order
          };
        });
    });

    // Inspecionar modais presentes no HTML
    const modalsInfo = await page.evaluate(() => {
      const modalElements = Array.from(document.querySelectorAll('.modal, [id*="Modal"], [id*="modal"]'));
      return modalElements.map(m => {
        const header = m.querySelector('.modal-header, .header');
        const footer = m.querySelector('.modal-footer, .footer, .species-standard-actions, .actions');
        const buttons = Array.from(m.querySelectorAll('button, .btn, .back-button, .btn-save, .btn-adicionar')).map(b => {
          const s = window.getComputedStyle(b);
          return {
            text: b.innerText.trim().replace(/\n/g, ' '),
            id: b.id || null,
            className: b.className,
            bg: s.backgroundColor,
            color: s.color,
            height: s.height,
            borderRadius: s.borderRadius,
            parentClass: b.parentElement ? b.parentElement.className : null
          };
        });

        let footerStyle = null;
        if (footer) {
          const fs = window.getComputedStyle(footer);
          footerStyle = {
            display: fs.display,
            justifyContent: fs.justifyContent,
            alignItems: fs.alignItems,
            padding: fs.padding,
            background: fs.backgroundColor,
            borderTop: fs.borderTop
          };
        }

        return {
          id: m.id,
          className: m.className,
          footerStyle,
          buttons
        };
      });
    });

    auditReport[pInfo.name] = {
      mainButtons: pageButtons,
      modals: modalsInfo
    };

    await page.close();
  }

  console.log(JSON.stringify(auditReport, null, 2));
  await browser.close();
  server.close();
});
