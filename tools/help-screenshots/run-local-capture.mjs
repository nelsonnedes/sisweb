import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const PORT = 8766;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function createLocalServer() {
  return http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1:' + PORT);
      let reqPath = decodeURIComponent(parsedUrl.pathname);
      if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
      }

      const filePath = path.join(projectRoot, reqPath);
      if (!filePath.startsWith(projectRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found: ' + reqPath);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error: ' + err.message);
    }
  });
}

async function runChildProcess(scriptPath, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    console.log('[run] Executando: node ' + path.basename(scriptPath) + ' ' + args.join(' '));
    const child = fork(scriptPath, args, {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Processo ' + path.basename(scriptPath) + ' encerrou com codigo ' + code));
      }
    });
    child.on('error', reject);
  });
}

async function main() {
  const server = createLocalServer();
  await new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log('[server] Servidor local de captura ativo em http://127.0.0.1:' + PORT);
      resolve();
    });
  });

  try {
    console.log('[step 1/5] Gerando rotas completas (desktop + mobile)...');
    await runChildProcess(path.join(__dirname, 'build-full-routes.mjs'));

    console.log('[step 2/5] Capturando rotas base de treinamento...');
    await runChildProcess(path.join(__dirname, 'capture.mjs'), ['--training'], {
      SISWEB_BASE_URL: 'http://127.0.0.1:' + PORT
    });

    console.log('[step 3/5] Capturando rotas completas (todas as telas e dispositivos)...');
    await runChildProcess(path.join(__dirname, 'capture.mjs'), ['--full'], {
      SISWEB_BASE_URL: 'http://127.0.0.1:' + PORT
    });

    console.log('[step 4/5] Otimizando imagens com sharp e espelhando...');
    await runChildProcess(path.join(__dirname, 'optimize.mjs'), ['--apply'], {
      SISWEB_IMAGE_DIR: 'assets/help-manual',
      SISWEB_OPTIMIZE_OUT_DIR: 'tmp/help-manual-optimized'
    });

    console.log('[step 5/5] Atualizando help-gallery.generated.js...');
    await runChildProcess(path.join(__dirname, 'build-help-gallery.mjs'));

    console.log('\n=============================================');
    console.log(' Captura e Otimizacao concluidas com sucesso! ');
    console.log('=============================================\n');
  } finally {
    server.close();
    console.log('[server] Servidor local de captura encerrado.');
  }
}

main().catch((err) => {
  console.error('[error] Falha no processo de captura:', err);
  process.exit(1);
});