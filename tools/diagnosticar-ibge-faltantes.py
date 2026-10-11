# Diagnostico IBGE faltantes - SOMENTE LEITURA.
# Uso com SISWEB_TEST_EMAIL/SISWEB_TEST_PASSWORD; gera relatorio em docs/stories.
# (requer servidor local em 127.0.0.1:5500)
import asyncio, json, os, sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.async_api import async_playwright

EMAIL = os.environ.get('SISWEB_TEST_EMAIL', '')
PASSWORD = os.environ.get('SISWEB_TEST_PASSWORD', '')
BASE = 'http://127.0.0.1:5500'

COLECOES = ['clients', 'fornecedores', 'fiscal/notas/nfe', 'fiscal/notas/nfce']

COD_KEYS = ['codigoMunicipio', 'municipioCodigo', 'municipalityCode', 'cMun', 'ibgeCode']


async def main():
    if not EMAIL or not PASSWORD:
        print('Defina SISWEB_TEST_EMAIL e SISWEB_TEST_PASSWORD.')
        return
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        await pg.goto(f'{BASE}/login.html', wait_until='networkidle', timeout=45000)
        await pg.fill('#email', EMAIL)
        await pg.fill('#password', PASSWORD)
        await pg.click('#loginSubmitBtn')
        await pg.wait_for_url(lambda u: 'login.html' not in u, timeout=30000)
        await pg.wait_for_timeout(4000)
        out = await pg.evaluate('''(args) => (async () => {
            const r = { tenant: null, colecoes: {} };
            try {
                const info = JSON.parse(localStorage.getItem('company_info') || '{}');
                r.tenant = window.appTenantId
                    || info.companyId || info.companyID || info.tenantId || info.id || null;
            } catch (_) {}
            const svc = window.firebaseService;
            if (!svc || !r.tenant) return r;
            const temCodigo = (o) => {
                if (!o || typeof o !== 'object') return true;
                const vals = [o.codigoMunicipio, o.municipioCodigo, o.municipalityCode,
                    o.cMun, o.ibgeCode,
                    o.endereco && o.endereco.codigoMunicipio,
                    o.dest && o.dest.endereco && o.dest.endereco.codigoMunicipio,
                    o.emit && o.emit.endereco && o.emit.endereco.codigoMunicipio];
                return vals.some((v) => String(v || '').replace(/\\D/g, '').length === 7);
            };
            const nomeCidade = (o) => {
                if (!o || typeof o !== 'object') return '';
                return o.cidade || o.city
                    || (o.endereco && (o.endereco.municipio || o.endereco.cidade)) || '';
            };
            for (const col of args.colecoes) {
                try {
                    const res = await svc.loadFromFirebase(`companies/${r.tenant}/${col}`);
                    const data = res && res.success ? res.data : res;
                    const arr = Array.isArray(data) ? data
                        : (data && typeof data === 'object' ? Object.values(data) : []);
                    const sem = arr.filter((x) => !temCodigo(x)).slice(0, 10)
                        .map((x) => String(nomeCidade(x) || '(sem cidade)').slice(0, 40));
                    r.colecoes[col] = { total: arr.length,
                        semCodigo: arr.filter((x) => !temCodigo(x)).length,
                        exemplos: sem };
                } catch (e) { r.colecoes[col] = { erro: String(e).slice(0, 120) }; }
            }
            try {
                const pr = await svc.loadFromFirebase(`companies/${r.tenant}/profile`);
                const pd = pr && pr.success ? pr.data : pr;
                r.colecoes['profile'] = { total: pd ? 1 : 0,
                    semCodigo: (pd && !temCodigo(pd)) ? 1 : 0, exemplos: [] };
            } catch (e) { r.colecoes['profile'] = { erro: String(e).slice(0, 120) }; }
            return r;
        })()''', {'colecoes': COLECOES})
        print('diagnostico:', json.dumps(out, ensure_ascii=False))
        agora = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
        linhas = [f'# Relatório IBGE faltantes — {agora}', '',
                 f'Tenant auditado: `{out.get("tenant")}`', '',
                 '| Coleção | Total | Sem `codigoMunicipio` | Exemplos (cidade) |',
                 '|---|---|---|---|']
        for col, st in (out.get('colecoes') or {}).items():
            if 'erro' in st:
                linhas.append(f'| `{col}` | erro | — | {st["erro"]} |')
            else:
                ex = ', '.join(st.get('exemplos', [])) or '—'
                linhas.append(f'| `{col}` | {st.get("total", 0)} | {st.get("semCodigo", 0)} | {ex} |')
        linhas += ['', '> Gerado por `tools/diagnosticar-ibge-faltantes.py` (somente leitura).',
                  '> Critério: qualquer alias válido com 7 dígitos.',
                  '> Ação: NÃO sobrescrever — completar via formulários (Fase B) ou rotina assistida.']
        with open('docs/stories/relatorio-ibge-faltantes.md', 'w', encoding='utf-8') as f:
            f.write('\n'.join(linhas) + '\n')
        print('relatorio: docs/stories/relatorio-ibge-faltantes.md')
        await b.close()

asyncio.run(main())
