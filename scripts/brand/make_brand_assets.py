"""Generate Kanso brand SVGs (outlined text, no font dependency).
Font: Source Serif 4 Semibold (SIL OFL 1.1)."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))  # Usage: pip install fonttools brotli && python scripts/brand/make_brand_assets.py
OUT = os.path.join(HERE, "..", "..", "apps", "web", "public", "brand")
os.makedirs(OUT, exist_ok=True)

font = TTFont(os.path.join(HERE, "ss-semibold.woff2"))
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm


def num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def text_path(text, size, x, y, tracking=0.0):
    scale = size / upm
    cursor = x
    d = []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=num)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, y)))
        d.append(pen.getCommands())
        cursor += gs[name].width * scale + tracking
    return "".join(d), cursor - x - tracking


# Brushed ensō: outer r40.5 @ (48,48), inner r27.75 @ (51.75,43.5), opening at the top right.
RING = "M78.10 20.90A40.5 40.5 0 1 1 42.36 7.89L43.64 16.96A27.75 27.75 0 1 0 72.92 25.56Z"
DOT = (59.81, 15.56, 5.63)

INK, PAPER, TEAL, TEAL_LIGHT, TEAL_PALE = "#1B2A4A", "#FAF8F4", "#1F6F6B", "#3FA39D", "#8FC9C2"

TITLE = "Kanso Solutions"
DESC = "Cercle ensō ouvert tracé au pinceau, avec un point sarcelle dans l'ouverture."


def symbol(ring, dot, tx=0, ty=0, s=1):
    t = f' transform="translate({num(tx)} {num(ty)}) scale({num(s)})"' if (tx or ty or s != 1) else ""
    return f'<g{t}><path fill="{ring}" d="{RING}"/><circle cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}" fill="{dot}"/></g>'


def svg(w, h, body, title=TITLE, desc=DESC):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(h)}" width="{num(w)}" height="{num(h)}" role="img">'
        f"<title>{title}</title><desc>{desc}</desc>{body}</svg>\n"
    )


def write(name, content):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(content)
    print("wrote", name)


def horizontal(ring, dot, word, sub):
    x0 = 118
    kd, kw = text_path("Kanso", 62, x0 - 2, 60)
    sd, sw = text_path("SOLUTIONS", 15.5, x0, 84, tracking=5.2)
    width = x0 + max(kw, sw)
    body = symbol(ring, dot) + f'<path fill="{word}" d="{kd}"/><path fill="{sub}" d="{sd}"/>'
    return svg(width, 96, body)


def stacked(ring, dot, word, sub):
    kd0, kw = text_path("Kanso", 58, 0, 0)
    sd0, sw = text_path("SOLUTIONS", 14.5, 0, 0, tracking=5)
    width = max(96, kw, sw) + 0
    cx = width / 2
    kd, _ = text_path("Kanso", 58, cx - kw / 2, 148)
    sd, _ = text_path("SOLUTIONS", 14.5, cx - sw / 2, 172, tracking=5)
    body = symbol(ring, dot, tx=cx - 48) + f'<path fill="{word}" d="{kd}"/><path fill="{sub}" d="{sd}"/>'
    return svg(width, 180, body)


# Symbol only
write("kanso-symbol.svg", svg(96, 96, symbol(INK, TEAL)))
write("kanso-symbol-light.svg", svg(96, 96, symbol(PAPER, TEAL_LIGHT)))
write("kanso-symbol-mono-ink.svg", svg(96, 96, symbol(INK, INK)))
write("kanso-symbol-mono-paper.svg", svg(96, 96, symbol(PAPER, PAPER)))

# Horizontal lockup
write("kanso-logo.svg", horizontal(INK, TEAL, INK, TEAL))
write("kanso-logo-light.svg", horizontal(PAPER, TEAL_LIGHT, PAPER, TEAL_PALE))
write("kanso-logo-mono-ink.svg", horizontal(INK, INK, INK, INK))
write("kanso-logo-mono-paper.svg", horizontal(PAPER, PAPER, PAPER, PAPER))

# Stacked lockup
write("kanso-logo-stacked.svg", stacked(INK, TEAL, INK, TEAL))
write("kanso-logo-stacked-light.svg", stacked(PAPER, TEAL_LIGHT, PAPER, TEAL_PALE))

# Favicon / app icon: ink rounded square, light symbol (readable on light and dark tabs)
s = 0.6
off = (64 - 96 * s) / 2
fav = (
    f'<rect width="64" height="64" rx="14" fill="{INK}"/>' + symbol(PAPER, TEAL_LIGHT, tx=off, ty=off, s=s)
)
write("favicon.svg", svg(64, 64, fav))


# ---- Product lockups (Kanso + product label) and per-product favicons ----
PRODUCTS = {
    "solutions": ("SOLUTIONS", "#1F6F6B", "#3FA39D"),
    "assistant": ("ASSISTANT", "#1F6F6B", "#3FA39D"),
    "site": ("SITE", "#B4532A", "#E08A5E"),
    "portail": ("PORTAIL", "#2D5B8A", "#7FA9D6"),
}
for name, (label, accent, accent_light) in PRODUCTS.items():
    x0 = 118
    kd, kw = text_path("Kanso", 62, x0 - 2, 60)
    sd, sw = text_path(label, 15.5, x0, 84, tracking=5.2)
    width = x0 + max(kw, sw)
    t = f"Kanso {label.capitalize()}"
    write(
        f"kanso-{name}.svg",
        svg(width, 96, symbol(INK, accent) + f'<path fill="{INK}" d="{kd}"/><path fill="{accent}" d="{sd}"/>', title=t),
    )
    write(
        f"kanso-{name}-light.svg",
        svg(width, 96, symbol(PAPER, accent_light) + f'<path fill="{PAPER}" d="{kd}"/><path fill="{accent_light}" d="{sd}"/>', title=t),
    )
    write(
        f"favicon-{name}.svg",
        svg(64, 64, f'<rect width="64" height="64" rx="14" fill="{INK}"/>' + symbol(PAPER, accent_light, tx=off, ty=off, s=0.6), title=t),
    )
