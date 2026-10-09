"""
================================================================================
GERADOR AUTOMATIZADO DE MOCKUPS PROFISSIONAIS (DESKTOP & MOBILE) - SISWEB
================================================================================
Tecnologias: Playwright (async_api) + Pillow (PIL)
Caminhos locais: Windows raw strings (r"...")
================================================================================
"""

import asyncio
import io
import os
import re
from urllib.parse import urlparse
from PIL import Image, ImageDraw, ImageFilter
from playwright.async_api import async_playwright

# ==============================================================================
# CONFIGURAÇÕES GERAIS E CAMINHOS (WINDOWS)
# ==============================================================================

# Diretórios de saída obrigatórios
OUTPUT_DIR_DESKTOP = r"C:\Sisweb\tmp\help-manual-optimized\mockup_desktop"
OUTPUT_DIR_MOBILE = r"C:\Sisweb\tmp\help-manual-optimized\mockup_mobil"

# Caminhos dos templates de mockup
TEMPLATE_DESKTOP_PATH = r"C:\Sisweb\assets\mockup_desktop_template.png"
TEMPLATE_MOBILE_PATH = r"C:\Sisweb\assets\mockup_mobile_template.png"

# ------------------------------------------------------------------------------
# CALIBRAÇÃO DO MOCKUP DESKTOP:
# Dimensões da área da tela e coordenadas de colagem (X, Y) dentro do template
# ------------------------------------------------------------------------------
DESKTOP_SCREEN_WIDTH = 1440    # Largura da tela dentro do mockup
DESKTOP_SCREEN_HEIGHT = 900    # Altura da tela dentro do mockup
DESKTOP_PASTE_X = 80          # Posição X inicial no template (distância da esquerda)
DESKTOP_PASTE_Y = 60          # Posição Y inicial no template (distância do topo)

# ------------------------------------------------------------------------------
# CALIBRAÇÃO DO MOCKUP MOBILE:
# Dimensões da área da tela e coordenadas de colagem (X, Y) dentro do template
# ------------------------------------------------------------------------------
MOBILE_SCREEN_WIDTH = 390     # Largura da tela dentro do mockup (resolução iPhone 13)
MOBILE_SCREEN_HEIGHT = 844    # Altura da tela dentro do mockup (resolução iPhone 13)
MOBILE_PASTE_X = 55           # Posição X inicial no template (distância da esquerda)
MOBILE_PASTE_Y = 68           # Posição Y inicial no template (distância do topo)

# ------------------------------------------------------------------------------
# CONFIGURAÇÃO DE ACESSO E AUTENTICAÇÃO
# ------------------------------------------------------------------------------
# Alterne para True para autenticar e capturar telas internas do sistema
REQUIRE_LOGIN = True

# Credenciais de teste via env (nunca commitar senha real)
LOGIN_URL = "https://sisweb-7ce82.web.app/login.html"
LOGIN_EMAIL = os.environ.get("SISWEB_TEST_EMAIL", "")
LOGIN_PASSWORD = os.environ.get("SISWEB_TEST_PASSWORD", "")

# ------------------------------------------------------------------------------
# LISTA DE ROTAS / URLS DO SISTEMA PARA PROCESSAMENTO EM LOTE
# ------------------------------------------------------------------------------
BASE_URL = "https://sisweb-7ce82.web.app"

# Telas públicas e módulos internos essenciais
URLS_TO_CAPTURE = [
    # Telas institucionais e comerciais
    f"{BASE_URL}/landing-vendas.html",
    f"{BASE_URL}/subscription.html",
    f"{BASE_URL}/subscription-status.html",
    f"{BASE_URL}/ajuda.html",
    f"{BASE_URL}/login.html",
    # Módulos internos autenticados
    f"{BASE_URL}/index.html",
    f"{BASE_URL}/vendas.html",
    f"{BASE_URL}/romaneiotora.html",
    f"{BASE_URL}/estoque.html",
]


# ==============================================================================
# FUNÇÕES DE APOIO E CRIAÇÃO AUTOMÁTICA DE TEMPLATES (FALLBACK)
# ==============================================================================

def ensure_directories():
    """Garante que as pastas de saída existam no disco."""
    os.makedirs(OUTPUT_DIR_DESKTOP, exist_ok=True)
    os.makedirs(OUTPUT_DIR_MOBILE, exist_ok=True)
    os.makedirs(os.path.dirname(TEMPLATE_DESKTOP_PATH), exist_ok=True)


def ensure_templates_exist():
    """
    Garante que os templates existam no disco. Se não existirem,
    gera templates padrão ultra-profissionais automaticamente com Pillow.
    """
    if not os.path.exists(TEMPLATE_DESKTOP_PATH):
        print(f"[AVISO] Template Desktop não encontrado. Gerando template padrão em: {TEMPLATE_DESKTOP_PATH}")
        _build_default_desktop_template(TEMPLATE_DESKTOP_PATH)

    if not os.path.exists(TEMPLATE_MOBILE_PATH):
        print(f"[AVISO] Template Mobile não encontrado. Gerando template padrão em: {TEMPLATE_MOBILE_PATH}")
        _build_default_mobile_template(TEMPLATE_MOBILE_PATH)


def _build_default_desktop_template(filepath: str):
    """Gera template Desktop estilo monitor/laptop moderno com sombra e janela."""
    total_w, total_h = 1600, 1000
    screen_w, screen_h = DESKTOP_SCREEN_WIDTH, DESKTOP_SCREEN_HEIGHT
    offset_x, offset_y = DESKTOP_PASTE_X, DESKTOP_PASTE_Y

    img = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    bezel_box = [offset_x - 24, offset_y - 44, offset_x + screen_w + 24, offset_y + screen_h + 24]
    s_draw.rounded_rectangle(bezel_box, radius=20, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    img = Image.alpha_composite(shadow, img)

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(bezel_box, radius=20, fill=(28, 32, 38, 255), outline=(60, 66, 78, 255), width=2)
    draw.rounded_rectangle([offset_x, offset_y - 36, offset_x + screen_w, offset_y + 10], radius=8, fill=(38, 44, 54, 255))

    btn_y = offset_y - 18
    draw.ellipse([offset_x + 16, btn_y - 6, offset_x + 28, btn_y + 6], fill=(239, 68, 68, 255))
    draw.ellipse([offset_x + 36, btn_y - 6, offset_x + 48, btn_y + 6], fill=(245, 158, 11, 255))
    draw.ellipse([offset_x + 56, btn_y - 6, offset_x + 68, btn_y + 6], fill=(34, 197, 94, 255))

    url_box = [offset_x + 100, btn_y - 10, offset_x + screen_w - 100, btn_y + 10]
    draw.rounded_rectangle(url_box, radius=6, fill=(24, 28, 34, 255))
    draw.ellipse([offset_x + 115, btn_y - 4, offset_x + 123, btn_y + 4], fill=(148, 163, 184, 255))

    screen_mask = Image.new("L", (total_w, total_h), 255)
    mask_draw = ImageDraw.Draw(screen_mask)
    mask_draw.rectangle([offset_x, offset_y, offset_x + screen_w, offset_y + screen_h], fill=0)
    img.putalpha(screen_mask)

    draw = ImageDraw.Draw(img)
    draw.rectangle([offset_x - 1, offset_y - 1, offset_x + screen_w + 1, offset_y + screen_h + 1], outline=(50, 56, 66, 255), width=1)
    img.save(filepath, "PNG")


def _build_default_mobile_template(filepath: str):
    """Gera template Mobile estilo iPhone 13 com moldura arredondada, notch e sombra."""
    total_w, total_h = 500, 980
    screen_w, screen_h = MOBILE_SCREEN_WIDTH, MOBILE_SCREEN_HEIGHT
    offset_x, offset_y = MOBILE_PASTE_X, MOBILE_PASTE_Y

    img = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    phone_box = [offset_x - 16, offset_y - 20, offset_x + screen_w + 16, offset_y + screen_h + 20]
    s_draw.rounded_rectangle(phone_box, radius=48, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    img = Image.alpha_composite(shadow, img)

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(phone_box, radius=48, fill=(24, 26, 32, 255), outline=(70, 75, 88, 255), width=3)
    draw.rounded_rectangle([offset_x + screen_w + 16, offset_y + 120, offset_x + screen_w + 20, offset_y + 190], radius=2, fill=(60, 65, 75, 255))
    draw.rounded_rectangle([offset_x - 20, offset_y + 100, offset_x - 16, offset_y + 150], radius=2, fill=(60, 65, 75, 255))
    draw.rounded_rectangle([offset_x - 20, offset_y + 165, offset_x - 16, offset_y + 215], radius=2, fill=(60, 65, 75, 255))

    speaker_x = offset_x + (screen_w // 2)
    draw.rounded_rectangle([speaker_x - 30, offset_y - 10, speaker_x + 30, offset_y - 6], radius=2, fill=(45, 50, 60, 255))

    screen_mask = Image.new("L", (total_w, total_h), 255)
    mask_draw = ImageDraw.Draw(screen_mask)
    mask_draw.rounded_rectangle([offset_x, offset_y, offset_x + screen_w, offset_y + screen_h], radius=36, fill=0)
    img.putalpha(screen_mask)

    draw = ImageDraw.Draw(img)
    notch_w = 120
    notch_h = 24
    notch_left = offset_x + (screen_w - notch_w) // 2
    draw.rounded_rectangle([notch_left, offset_y + 6, notch_left + notch_w, offset_y + 6 + notch_h], radius=12, fill=(18, 19, 24, 255))
    draw.ellipse([notch_left + notch_w - 24, offset_y + 12, notch_left + notch_w - 12, offset_y + 24], fill=(28, 38, 55, 255))
    draw.rounded_rectangle([offset_x, offset_y, offset_x + screen_w, offset_y + screen_h], radius=36, outline=(40, 45, 55, 255), width=2)
    img.save(filepath, "PNG")


def get_friendly_filename(url: str) -> str:
    """
    Gera um nome de arquivo seguro e amigável baseado no caminho da rota.
    Exemplos:
      - 'https://.../landing-vendas.html' -> 'landing-vendas.png'
      - 'https://.../subscription' -> 'subscription.png'
      - 'https://.../' -> 'home.png'
    """
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        return "home.png"
    
    base = os.path.basename(path)
    name_without_ext = os.path.splitext(base)[0]
    safe_name = re.sub(r'[/\\:*?"<>|]', "_", name_without_ext)
    return f"{safe_name}.png"


def embed_screenshot_in_mockup(
    screenshot_bytes: bytes,
    template_path: str,
    target_width: int,
    target_height: int,
    paste_x: int,
    paste_y: int,
    output_filepath: str,
):
    """
    Redimensiona a captura de tela e insere dentro do template de mockup,
    posicionando o template (moldura/bordas/notch) por cima para um acabamento perfeito.
    """
    screenshot = Image.open(io.BytesIO(screenshot_bytes)).convert("RGBA")
    template = Image.open(template_path).convert("RGBA")

    # Redimensiona o print para o tamanho exato da área de tela do mockup
    resized_screenshot = screenshot.resize(
        (target_width, target_height), Image.Resampling.LANCZOS
    )

    # Cria uma tela de base transparente do tamanho total do template
    canvas = Image.new("RGBA", template.size, (0, 0, 0, 0))

    # Cola o print na coordenada definida
    canvas.paste(resized_screenshot, (paste_x, paste_y))

    # Sobrepõe o template por cima (alpha composite) para que os cantos arredondados,
    # bordas e detalhes do aparelho cubram e emoldurem o print
    final_image = Image.alpha_composite(canvas, template)

    # Salva o arquivo final com qualidade otimizada
    final_image.save(output_filepath, "PNG", optimize=True)


# ==============================================================================
# FLUXO DE LOGIN (AUTENTICAÇÃO NO SISTEMA)
# ==============================================================================
async def perform_login_if_needed(page):
    """
    Realiza o login automatizado no SisWeb caso a variável REQUIRE_LOGIN esteja ativa.
    Utiliza as credenciais de teste configuradas.
    """
    if not REQUIRE_LOGIN:
        return
    if not LOGIN_EMAIL or not LOGIN_PASSWORD:
        print("\n[AUTH] SISWEB_TEST_EMAIL/SISWEB_TEST_PASSWORD ausentes. Capture apenas telas públicas.")
        return

    print(f"\n[AUTH] Acessando tela de login: {LOGIN_URL}")
    try:
        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(1)

        # Preenche os campos de email e senha
        print(f"[AUTH] Preenchendo credenciais para: {LOGIN_EMAIL}")
        await page.fill("#email", LOGIN_EMAIL)
        await page.fill("#password", LOGIN_PASSWORD)

        # Clica no botão de login
        await page.click("#loginSubmitBtn")
        print("[AUTH] Botão Entrar acionado. Aguardando autenticação e redirecionamento...")

        # Aguarda a transição para fora da tela de login (index.html, admin.html, etc.)
        await page.wait_for_url(lambda u: "login.html" not in u, timeout=25000)
        await page.wait_for_load_state("networkidle", timeout=15000)
        await asyncio.sleep(3)
        print(f"[AUTH] Autenticado com sucesso! URL atual pós-login: {page.url}")

    except Exception as e:
        print(f"[AUTH AVISO] Prosseguindo (status login: {page.url} - {e})")


# ==============================================================================
# EXECUÇÃO PRINCIPAL
# ==============================================================================
async def main():
    ensure_directories()
    ensure_templates_exist()

    async with async_playwright() as p:
        # Inicia o Chromium em modo headless
        browser = await p.chromium.launch(headless=True)

        # ----------------------------------------------------------------------
        # A) ETAPA DESKTOP (Resolução 1920x1080)
        # ----------------------------------------------------------------------
        print("\n" + "=" * 60)
        print("INICIANDO ETAPA DESKTOP (1920x1080)")
        print("=" * 60)

        desktop_context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            locale="pt-BR",
        )
        desktop_page = await desktop_context.new_page()

        # Autentica se necessário
        await perform_login_if_needed(desktop_page)

        for url in URLS_TO_CAPTURE:
            filename = get_friendly_filename(url)
            output_path = os.path.join(OUTPUT_DIR_DESKTOP, filename)

            try:
                print(f"[Desktop] Navegando para: {url}")
                await desktop_page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(2)  # Aguarda animações, gráficos e renderizações

                # Captura a viewport da tela
                screenshot_bytes = await desktop_page.screenshot(full_page=False)

                # Incorpora o print ao template Desktop
                embed_screenshot_in_mockup(
                    screenshot_bytes=screenshot_bytes,
                    template_path=TEMPLATE_DESKTOP_PATH,
                    target_width=DESKTOP_SCREEN_WIDTH,
                    target_height=DESKTOP_SCREEN_HEIGHT,
                    paste_x=DESKTOP_PASTE_X,
                    paste_y=DESKTOP_PASTE_Y,
                    output_filepath=output_path,
                )
                print(f" [OK] Salvo: {output_path}")

            except Exception as e:
                print(f" [ERRO] Falha no Desktop ({url}): {e}")

        await desktop_context.close()

        # ----------------------------------------------------------------------
        # B) ETAPA MOBILE (Perfil nativo iPhone 13)
        # ----------------------------------------------------------------------
        print("\n" + "=" * 60)
        print("INICIANDO ETAPA MOBILE (iPhone 13 - 390x844)")
        print("=" * 60)

        iphone_13 = p.devices["iPhone 13"]
        mobile_context = await browser.new_context(**iphone_13, locale="pt-BR")
        mobile_page = await mobile_context.new_page()

        # Autentica se necessário
        await perform_login_if_needed(mobile_page)

        for url in URLS_TO_CAPTURE:
            filename = get_friendly_filename(url)
            output_path = os.path.join(OUTPUT_DIR_MOBILE, filename)

            try:
                print(f"[Mobile] Navegando para: {url}")
                await mobile_page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(2)  # Aguarda renderização de elementos responsivos

                # Captura a viewport da tela mobile
                screenshot_bytes = await mobile_page.screenshot(full_page=False)

                # Incorpora o print ao template Mobile
                embed_screenshot_in_mockup(
                    screenshot_bytes=screenshot_bytes,
                    template_path=TEMPLATE_MOBILE_PATH,
                    target_width=MOBILE_SCREEN_WIDTH,
                    target_height=MOBILE_SCREEN_HEIGHT,
                    paste_x=MOBILE_PASTE_X,
                    paste_y=MOBILE_PASTE_Y,
                    output_filepath=output_path,
                )
                print(f" [OK] Salvo: {output_path}")

            except Exception as e:
                print(f" [ERRO] Falha no Mobile ({url}): {e}")

        await mobile_context.close()
        await browser.close()

    print("\n" + "=" * 60)
    print("PROCESSO DE CAPTURA E GERAÇÃO DE MOCKUPS CONCLUÍDO COM SUCESSO!")
    print(f"Destino Desktop: {OUTPUT_DIR_DESKTOP}")
    print(f"Destino Mobile:  {OUTPUT_DIR_MOBILE}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
