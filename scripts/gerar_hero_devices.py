"""Renders premium de devices p/ hero da landing (monitor + phone), com screenshots reais.
Saida: assets/help-manual/mockups/hero/{desktop,mobile}-<slug>.png (fundo transparente)."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = r"C:\Sisweb"
SRC = os.path.join(ROOT, "assets", "help-manual")
OUT = os.path.join(SRC, "mockups", "hero")
os.makedirs(os.path.join(OUT), exist_ok=True)


def _interp(stops, t):
    stops = sorted(stops)
    for i in range(len(stops) - 1):
        (p0, c0), (p1, c1) = stops[i], stops[i + 1]
        if p0 <= t <= p1:
            k = (t - p0) / max(p1 - p0, 1e-6)
            return tuple(int(a + (b - a) * k) for a, b in zip(c0, c1))
    return stops[-1][1]


def vgrad(w, h, stops):
    strip = Image.new("RGBA", (1, 32), (0, 0, 0, 0))
    px = strip.load()
    for y in range(32):
        px[0, y] = _interp(stops, y / 31)
    return strip.resize((w, h), Image.BILINEAR)


def hgrad(w, h, stops):
    strip = Image.new("RGBA", (32, 1), (0, 0, 0, 0))
    px = strip.load()
    for x in range(32):
        px[x, 0] = _interp(stops, x / 31)
    return strip.resize((w, h), Image.BILINEAR)


def cover(src_path, tw, th, focus=(0.5, 0.35)):
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    im = im.resize((int(sw * scale + 0.5), int(sh * scale + 0.5)), Image.LANCZOS)
    nw, nh = im.size
    fx, fy = focus
    x = min(max(int((nw - tw) * fx), 0), nw - tw)
    y = min(max(int((nh - th) * fy), 0), nh - th)
    return im.crop((x, y, x + tw, y + th))


def rmask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0], size[1]], radius=radius, fill=255)
    return m


def stamp(base, layer, xy, round_r=None):
    """Sobrepõe layer respeitando seu alfa (paste c/ mask apagaria: usa o alfa
    da camada no lugar do alfa base)."""
    if round_r is not None:
        a = ImageChops.multiply(layer.split()[3], rmask(layer.size, round_r))
        layer = layer.copy()
        layer.putalpha(a)
    full = Image.new("RGBA", base.size, (0, 0, 0, 0))
    full.paste(layer, (int(xy[0]), int(xy[1])))
    return Image.alpha_composite(base, full)


SILVER = [(0.0, (143, 144, 150, 255)), (0.28, (233, 234, 237, 255)),
          (0.52, (194, 195, 200, 255)), (0.74, (243, 244, 246, 255)),
          (1.0, (152, 153, 160, 255))]
TITAN = [(0.0, (62, 62, 68, 255)), (0.3, (20, 18, 15, 255)),
         (0.55, (45, 44, 50, 255)), (0.8, (14, 13, 12, 255)),
         (1.0, (70, 70, 78, 255))]


def monitor(shot_path, out_path):
    W, H = 1600, 1220
    SW, SH, SX, SY, R = 1472, 920, 64, 56, 26          # area da tela
    BEZ = 14                                            # espessura bezel
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # (sem sombra assada: device flutua direto sobre o fundo da pagina)

    # base oval aluminio
    bw, bh, bx, by = 460, 44, W / 2 - 230, H - 130
    bm = rmask((bw, bh), 22)
    bg = vgrad(bw, bh, [(0, (245, 246, 248, 255)), (0.45, (203, 204, 209, 255)),
                        (1.0, (143, 144, 150, 255))])
    base.paste(bg, (int(bx), int(by)), bm)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=22, outline=(255, 255, 255, 140), width=2)

    # pescoco trapezoidio aluminio
    nw0, nw1, nt, nb = 150, 210, by - 170, by - 6
    neck = hgrad(int(nw1), int(nb - nt), SILVER)
    nm = Image.new("L", (int(nw1), int(nb - nt)), 0)
    nd = ImageDraw.Draw(nm)
    nd.polygon([(nw1 / 2 - nw0 / 2, 0), (nw1 / 2 + nw0 / 2, 0),
                (nw1 - 4, nb - nt), (4, nb - nt)], fill=255)
    base.paste(neck, (int(W / 2 - nw1 / 2), int(nt)), nm)

    # corpo: bezel preto piano
    fx0, fy0 = SX - BEZ, SY - BEZ
    fw, fh = SW + 2 * BEZ, SH + 2 * BEZ + 26
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, fw, fh], radius=R + BEZ, fill=(12, 10, 8, 255))
    # filete aluminio fino
    fd.rounded_rectangle([1, 1, fw - 1, fh - 1], radius=R + BEZ - 1,
                         outline=(210, 211, 216, 45), width=2)
    # brilho superior do bezel
    fd.rounded_rectangle([3, 3, fw - 3, fh - 3], radius=R + BEZ - 3,
                         outline=(255, 255, 255, 14), width=3)
    base.paste(frame, (int(fx0), int(fy0)), rmask((fw, fh), R + BEZ))

    # camera
    d = ImageDraw.Draw(base)
    ccx, ccy = W / 2, int(fy0 + BEZ / 2 + 1)
    d.ellipse([ccx - 5, ccy - 5, ccx + 5, ccy + 5], fill=(4, 6, 10, 255))
    d.ellipse([ccx - 2, ccy - 2, ccx + 2, ccy + 2], fill=(40, 70, 110, 255))

    # tela: screenshot
    shot = cover(shot_path, SW, SH)
    base.paste(shot, (int(SX), int(SY)), rmask((SW, SH), R))

    # vidro: reflexo diagonal sutil sobre a tela
    glass = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.polygon([(0, 0), (SW * 0.42, 0), (SW * 0.16, SH), (0, SH)], fill=(255, 255, 255, 16))
    gd.polygon([(SW * 0.48, 0), (SW * 0.56, 0), (SW * 0.30, SH), (SW * 0.22, SH)],
               fill=(255, 255, 255, 7))
    base = stamp(base, glass, (SX, SY), R)

    base.save(out_path, optimize=True)
    print("OK", out_path, base.size)


def phone(shot_path, out_path):
    W, H = 800, 1600
    SW, SH, SX, SY, R = 700, 1518, 50, 66, 92
    BW = 12  # borda titanio
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # botoes laterais
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([SX - BW - 7, 250, SX - BW + 1, 300], radius=4, fill=(30, 29, 32, 255))
    d.rounded_rectangle([SX - BW - 7, 330, SX - BW + 1, 420], radius=4, fill=(30, 29, 32, 255))
    d.rounded_rectangle([SX - BW - 7, 440, SX - BW + 1, 530], radius=4, fill=(30, 29, 32, 255))
    d.rounded_rectangle([SX + SW + BW - 1, 380, SX + SW + BW + 7, 500], radius=4,
                        fill=(30, 29, 32, 255))

    # (sem sombra assada: device flutua direto sobre o fundo da pagina)

    # corpo titanio
    fx0, fy0 = SX - BW, SY - BW
    fw, fh = SW + 2 * BW, SH + 2 * BW
    tg = hgrad(fw, fh, TITAN)
    base.paste(tg, (int(fx0), int(fy0)), rmask((fw, fh), R + BW))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([fx0, fy0, fx0 + fw, fy0 + fh], radius=R + BW,
                        outline=(255, 255, 255, 36), width=2)

    # tela preta + screenshot
    d.rounded_rectangle([SX - 3, SY - 3, SX + SW + 3, SY + SH + 3], radius=R + 3,
                        fill=(0, 0, 0, 255))
    shot = cover(shot_path, SW, SH, focus=(0.5, 0.0))
    base.paste(shot, (int(SX), int(SY)), rmask((SW, SH), R))

    # dynamic island
    iw, ih = 210, 52
    ix, iy = W / 2 - iw / 2, SY + 22
    d.rounded_rectangle([ix, iy, ix + iw, iy + ih], radius=26, fill=(0, 0, 0, 255))
    d.ellipse([ix + iw - 44, iy + 16, ix + iw - 20, iy + 40], fill=(16, 26, 40, 255))
    d.ellipse([ix + iw - 36, iy + 22, ix + iw - 28, iy + 32], fill=(60, 110, 160, 255))

    # home indicator
    hw, hh = 220, 10
    d.rounded_rectangle([W / 2 - hw / 2, SY + SH - 26, W / 2 + hw / 2, SY + SH - 16],
                        radius=5, fill=(255, 255, 255, 210))

    # vidro diagonal
    glass = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.polygon([(0, 0), (SW * 0.5, 0), (SW * 0.18, SH), (0, SH)], fill=(255, 255, 255, 14))
    base = stamp(base, glass, (SX, SY), R)

    base.save(out_path, optimize=True)
    print("OK", out_path, base.size)


DARK = os.path.join(SRC, "dark")

jobs = [
    ("desktop-dashboard", os.path.join(DARK, "dashboard.png"), monitor),
    ("desktop-estoque", os.path.join(DARK, "estoque.png"), monitor),
    ("desktop-vendas", os.path.join(DARK, "vendas.png"), monitor),
    ("mobile-dashboard", os.path.join(DARK, "m-dashboard.png"), phone),
    ("mobile-estoque", os.path.join(DARK, "m-estoque.png"), phone),
    ("mobile-vendas", os.path.join(DARK, "m-vendas.png"), phone),
]

if __name__ == "__main__":
    import time
    t0 = time.time()
    for slug, src, fn in jobs:
        fn(src, os.path.join(OUT, slug + ".png"))
    print("total %.1fs" % (time.time() - t0))
