import asyncio
import io
import json
import os
import re
from PIL import Image
from playwright.async_api import async_playwright

BASE_URL = "https://sisweb-7ce82.web.app"
LOGIN_URL = f"{BASE_URL}/login.html"
EMAIL = os.environ.get("SISWEB_TEST_EMAIL", "")
PASSWORD = os.environ.get("SISWEB_TEST_PASSWORD", "")

PROJECT_ROOT = r"C:\Sisweb"
HELP_MANUAL_DIR = os.path.join(PROJECT_ROOT, "assets", "help-manual")
MOCKUPS_DESK_DIR = os.path.join(HELP_MANUAL_DIR, "mockups", "desktop")
MOCKUPS_MOB_DIR = os.path.join(HELP_MANUAL_DIR, "mockups", "mobile")
TMP_DESK_DIR = os.path.join(PROJECT_ROOT, "tmp", "help-manual-optimized", "mockup_desktop")
TMP_MOB_DIR = os.path.join(PROJECT_ROOT, "tmp", "help-manual-optimized", "mockup_mobil")

TEMPLATE_DESKTOP = os.path.join(PROJECT_ROOT, "assets", "mockup_desktop_template.png")
TEMPLATE_MOBILE = os.path.join(PROJECT_ROOT, "assets", "mockup_mobile_template.png")

# Tópicos da Ajuda mapeados para suas páginas reais
TOPICS = [
    {
        "id": "inicio",
        "title": "Visão geral e ordem recomendada",
        "url": f"{BASE_URL}/index.html",
        "pre_action": None,
    },
    {
        "id": "navegacao",
        "title": "Menu, PWA, alertas e sessão",
        "url": f"{BASE_URL}/index.html",
        "pre_action": "open_menu",
    },
    {
        "id": "empresa",
        "title": "Empresa e tenant",
        "url": f"{BASE_URL}/company.html",
        "pre_action": None,
    },
    {
        "id": "cadastros",
        "title": "Clientes, fornecedores e espécies",
        "url": f"{BASE_URL}/client.html",
        "pre_action": None,
    },
    {
        "id": "romaneios",
        "title": "Romaneios e pré-romaneio",
        "url": f"{BASE_URL}/romaneiotora.html",
        "pre_action": None,
    },
    {
        "id": "vendas",
        "title": "Vendas e pedidos",
        "url": f"{BASE_URL}/vendas.html",
        "pre_action": None,
    },
    {
        "id": "compras",
        "title": "Compras e contas a pagar",
        "url": f"{BASE_URL}/compras.html",
        "pre_action": None,
    },
    {
        "id": "fiscal",
        "title": "Notas Fiscais e MDF-e",
        "url": f"{BASE_URL}/notas-fiscais.html",
        "pre_action": None,
    },
    {
        "id": "estoque",
        "title": "Estoque de toras e almoxarifado",
        "url": f"{BASE_URL}/estoque.html",
        "pre_action": None,
    },
    {
        "id": "financas",
        "title": "Financeiro",
        "url": f"{BASE_URL}/financas.html",
        "pre_action": None,
    },
    {
        "id": "folha",
        "title": "Folha de pagamento",
        "url": f"{BASE_URL}/folha_pagamento/folha.html",
        "pre_action": None,
    },
    {
        "id": "assinatura",
        "title": "Assinatura e planos",
        "url": f"{BASE_URL}/subscription-status.html",
        "pre_action": None,
    },
    {
        "id": "perfil",
        "title": "Meu Perfil",
        "url": f"{BASE_URL}/user-profile.html",
        "pre_action": None,
    },
    {
        "id": "suporte",
        "title": "Central de Suporte",
        "url": f"{BASE_URL}/index.html",
        "pre_action": "open_support",
    },
]

def embed_mockup(raw_bytes, template_path, w, h, x, y, out_path):
    screenshot = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    template = Image.open(template_path).convert("RGBA")
    resized = screenshot.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", template.size, (0, 0, 0, 0))
    canvas.paste(resized, (x, y))
    final = Image.alpha_composite(canvas, template)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path, "PNG", optimize=True)

async def apply_pre_action(page, action, is_mobile=False):
    if not action:
        return
    try:
        if action == "open_menu":
            if is_mobile:
                # Tenta abrir menu hamburger mobile
                btn = await page.query_selector('.sw-menu-toggle, #menuToggle, .hamburger, [aria-label*="menu" i]')
                if btn:
                    await btn.click()
                    await page.wait_for_timeout(600)
            else:
                # Tenta abrir dropdown de tema ou configuracoes
                cog = await page.query_selector('.fa-cog, .fa-gear, [aria-label*="config" i]')
                if cog:
                    await cog.click()
                    await page.wait_for_timeout(500)
        elif action == "open_support":
            await page.evaluate("""() => {
                if (typeof window.showSupport === 'function') {
                    window.showSupport();
                } else {
                    const btn = document.querySelector('#faleConoscoBtn, [onclick*="showSupport"]');
                    if (btn) btn.click();
                }
            }""")
            await page.wait_for_timeout(1000)
    except Exception as e:
        print(f"  [Aviso ação {action}]: {e}")

async def login(page):
    print("Acessando tela de login...")
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
    await page.fill("#email", EMAIL)
    await page.fill("#password", PASSWORD)
    await page.click("#loginSubmitBtn")
    await page.wait_for_url(lambda u: "login.html" not in u, timeout=25000)
    await page.wait_for_timeout(3000)
    print(f"Login bem-sucedido! URL pós-login: {page.url}")

async def main():
    for d in [HELP_MANUAL_DIR, MOCKUPS_DESK_DIR, MOCKUPS_MOB_DIR, TMP_DESK_DIR, TMP_MOB_DIR]:
        os.makedirs(d, exist_ok=True)

    extracted_data = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # ----------------------------------------------------
        # 1. CAPTURA DESKTOP (1920x1080)
        # ----------------------------------------------------
        print("\n==================================================")
        print("INICIANDO CAPTURA DE TELAS REAIS DESKTOP (14 MÓDULOS)")
        print("==================================================")
        context_desk = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            locale="pt-BR"
        )
        page_desk = await context_desk.new_page()
        await login(page_desk)

        for item in TOPICS:
            tid = item["id"]
            url = item["url"]
            print(f"\n[Desktop] Processando: {item['title']} ({url})")
            try:
                await page_desk.goto(url, wait_until="networkidle", timeout=25000)
                await page_desk.wait_for_timeout(2500)
                await apply_pre_action(page_desk, item["pre_action"], is_mobile=False)

                # Extrai dados da tela para enriquecer as explicacoes reais
                info = await page_desk.evaluate("""() => {
                    const kpis = Array.from(document.querySelectorAll('.kpi-card, .metric-card, .info-card, .sw-kpi, .card')).slice(0, 8).map(el => {
                        const label = el.querySelector('.label, .title, h4, h5, span, p')?.innerText?.trim() || '';
                        const val = el.querySelector('.value, .number, strong, h2, h3')?.innerText?.trim() || '';
                        return [label.replace(/\\n/g, ' '), val];
                    }).filter(k => k[0] && k[1]);

                    const buttons = Array.from(document.querySelectorAll('button, .btn, .sw-btn')).map(b => b.innerText.trim()).filter(t => t && t.length < 30).slice(0, 10);
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean).slice(0, 6);
                    return { kpis, buttons, headings, title: document.title };
                }""")
                extracted_data[tid] = info

                # Captura bytes
                shot_bytes = await page_desk.screenshot(full_page=False)

                # Salva print direto no help-manual
                p1 = os.path.join(HELP_MANUAL_DIR, f"{tid}-1.png")
                p_overview = os.path.join(HELP_MANUAL_DIR, f"{tid}-overview.png")
                with open(p1, "wb") as f:
                    f.write(shot_bytes)
                with open(p_overview, "wb") as f:
                    f.write(shot_bytes)

                # Gera mockup Desktop embutido
                m_out_assets = os.path.join(MOCKUPS_DESK_DIR, f"{tid}.png")
                m_out_tmp = os.path.join(TMP_DESK_DIR, f"{tid}.png")
                embed_mockup(shot_bytes, TEMPLATE_DESKTOP, 1440, 900, 80, 60, m_out_assets)
                embed_mockup(shot_bytes, TEMPLATE_DESKTOP, 1440, 900, 80, 60, m_out_tmp)

                print(f"  -> Salvo print real e mockup desktop para: {tid}")
            except Exception as e:
                print(f"  [ERRO Desktop {tid}]: {e}")

        await context_desk.close()

        # ----------------------------------------------------
        # 2. CAPTURA MOBILE (iPhone 13 - 390x844)
        # ----------------------------------------------------
        print("\n==================================================")
        print("INICIANDO CAPTURA DE TELAS REAIS MOBILE (14 MÓDULOS)")
        print("==================================================")
        iphone_13 = p.devices["iPhone 13"]
        context_mob = await browser.new_context(**iphone_13, locale="pt-BR")
        page_mob = await context_mob.new_page()
        await login(page_mob)

        for item in TOPICS:
            tid = item["id"]
            url = item["url"]
            print(f"\n[Mobile] Processando: {item['title']} ({url})")
            try:
                await page_mob.goto(url, wait_until="networkidle", timeout=25000)
                await page_mob.wait_for_timeout(2500)
                await apply_pre_action(page_mob, item["pre_action"], is_mobile=True)

                shot_bytes = await page_mob.screenshot(full_page=False)

                # Salva print direto mobile
                p_mob = os.path.join(HELP_MANUAL_DIR, f"{tid}-mobile.png")
                with open(p_mob, "wb") as f:
                    f.write(shot_bytes)

                # Gera mockup Mobile embutido
                m_out_assets = os.path.join(MOCKUPS_MOB_DIR, f"{tid}.png")
                m_out_tmp = os.path.join(TMP_MOB_DIR, f"{tid}.png")
                embed_mockup(shot_bytes, TEMPLATE_MOBILE, 390, 844, 55, 68, m_out_assets)
                embed_mockup(shot_bytes, TEMPLATE_MOBILE, 390, 844, 55, 68, m_out_tmp)

                print(f"  -> Salvo print real e mockup mobile para: {tid}")
            except Exception as e:
                print(f"  [ERRO Mobile {tid}]: {e}")

        await context_mob.close()
        await browser.close()

    # Salva dados extraídos para orientar a atualização textual dos tópicos
    info_json_path = os.path.join(PROJECT_ROOT, "tmp", "ajuda_extracted_real_data.json")
    with open(info_json_path, "w", encoding="utf-8") as f:
        json.dump(extracted_data, f, ensure_ascii=False, indent=2)
    print(f"\nDados reais das telas extraídos com sucesso em: {info_json_path}")
    print("Processo de captura 100% finalizado!")

if __name__ == "__main__":
    asyncio.run(main())
