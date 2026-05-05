import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = (process.env.SISWEB_BASE_URL || 'https://sisweb-7ce82.web.app').replace(/\/+$/, '');
const email = process.env.SISWEB_EMAIL || '';
const password = process.env.SISWEB_PASSWORD || '';

const routesPath = path.join(__dirname, 'routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

const projectRoot = path.resolve(__dirname, '..', '..');
const outRoot = path.join(projectRoot, 'help-assets');

function urlJoin(base, p) {
  const clean = String(p || '').replace(/^\/+/, '');
  return `${base}/${clean}`;
}

async function login(page) {
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
    } catch (_) {}
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
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
