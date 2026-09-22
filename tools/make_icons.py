# Genera los íconos de Turbo (velocímetro) en public/icons. Uso: python tools/make_icons.py
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG, TRACK, ACCENT, NEEDLE, HUB = "#0f1216", "#222831", "#5cc8b0", "#f2b86b", "#e8ecf1"

def draw(size):
    s = size * 4  # dibujar grande y reducir = bordes suaves
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    c, r, w = s / 2, s * 0.33, int(s * 0.075)
    box = [c - r, c - r + s * 0.04, c + r, c + r + s * 0.04]
    cy = c + s * 0.04
    d.arc(box, 135, 405, fill=TRACK, width=w)
    d.arc(box, 135, 330, fill=ACCENT, width=w)
    for i in range(9):  # marcas del velocímetro
        a = math.radians(135 + i * 270 / 8)
        r1, r2 = r - w * 1.1, r - w * 1.7
        d.line([(c + r1 * math.cos(a), cy + r1 * math.sin(a)), (c + r2 * math.cos(a), cy + r2 * math.sin(a))], fill="#3a4450", width=max(2, int(s * 0.012)))
    a = math.radians(315)
    L = r * 0.78
    tip = (c + L * math.cos(a), cy + L * math.sin(a))
    perp = a + math.pi / 2
    bw = s * 0.035
    d.polygon([tip, (c + bw * math.cos(perp), cy + bw * math.sin(perp)), (c - bw * math.cos(perp), cy - bw * math.sin(perp))], fill=NEEDLE)
    hr = s * 0.055
    d.ellipse([c - hr, cy - hr, c + hr, cy + hr], fill=HUB)
    return img.resize((size, size), Image.LANCZOS)

OUT.mkdir(parents=True, exist_ok=True)
for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    draw(size).save(OUT / name, optimize=True)
    print("ok", name)
