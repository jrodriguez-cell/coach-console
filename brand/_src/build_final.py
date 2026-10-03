"""Final asset build: logos, favicons, Instagram set, merch print files, design tokens.

Run from anywhere:  python3 brand/_src/build_final.py
"""
import json
import os
import shutil
import subprocess

from mttm import fmt
from alphabet import BRAND
from system import (COLORS, COLORWAYS, CORE_WAYS, DPI, HEAVY, MANROPE, MERCH, MICHROMA, REGULAR, THEMES, U, hexc,
                    logo_svg, placed)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
jobs = []


def out(rel):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def write(rel, text):
    with open(out(rel), "w") as f:
        f.write(text)
    return rel


def png(svg_rel, png_rel, w, h, transparent=False):
    jobs.append({"src": os.path.join(ROOT, svg_rel), "out": out(png_rel), "width": w, "height": h,
                 "transparent": transparent})


def vb_size(svg):
    v = [float(x) for x in svg.split('viewBox="')[1].split('"')[0].split()]
    return v[2], v[3]


def export(kind, slug, svg, folder, widths, transparent):
    rel = write(f"{folder}/svg/{slug}.svg", svg)
    vw, vh = vb_size(svg)
    for w in widths:
        png(rel, f"{folder}/png/{slug}-{w}.png", w, round(w * vh / vw), transparent)


# clean previous output of this script
for d in ("logo", "instagram", "tokens"):
    shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)
for d in os.listdir(os.path.join(ROOT, "merch")):  # keep merch/mockups (built by build_mockups.py)
    if d != "mockups":
        shutil.rmtree(os.path.join(ROOT, "merch", d), ignore_errors=True)

# ================================================================ LOGOS
for slug, fg, bg in COLORWAYS:
    t = bg is None
    export("wordmark", f"mttm-wordmark-{slug}", logo_svg("wordmark", hexc(fg), bg and hexc(bg)),
           "logo/wordmark", (600, 1200, 2400), t)
    export("monogram", f"mttm-monogram-{slug}", logo_svg("monogram", hexc(fg), bg and hexc(bg)),
           "logo/monogram", (128, 512, 1024), t)
for slug, fg, bg in CORE_WAYS:
    t = bg is None
    export("monogram", f"mttm-monogram-heavy-{slug}", logo_svg("monogram", hexc(fg), bg and hexc(bg), HEAVY),
           "logo/monogram-heavy", (32, 64, 128, 256), t)
    export("single-line", f"mttm-single-line-{slug}", logo_svg("single-line", hexc(fg), bg and hexc(bg)),
           "logo/single-line", (1200, 2400), t)
    export("single-line", f"mttm-single-line-heavy-{slug}",
           logo_svg("single-line", hexc(fg), bg and hexc(bg), HEAVY), "logo/single-line", (1200, 2400), t)
    export("wordmark", f"mttm-wordmark-heavy-{slug}", logo_svg("wordmark", hexc(fg), bg and hexc(bg), HEAVY),
           "logo/wordmark-heavy", (600, 1200), t)

# Layout variants A and B (the brief's side-by-side), in white-on-black and black-on-white
for lay in ("a", "b"):
    for slug, fg, bg in (("white-on-black", "white", "black"), ("black-on-white", "black", "white")):
        export("wordmark", f"mttm-wordmark-variant-{lay}-{slug}",
               logo_svg("wordmark", hexc(fg), hexc(bg), layout=lay.upper()), "logo/variants", (1200,), False)

# Favicons / app icons: heavy-cut monogram, Bone on Ink, square, clear space 0.75U
fav = logo_svg("monogram", hexc("bone"), hexc("ink"), HEAVY, clear=0.75)
write("logo/favicon/favicon.svg", fav)
for name, s in (("favicon-16", 16), ("favicon-32", 32), ("favicon-48", 48), ("apple-touch-icon", 180),
                ("icon-192", 192), ("icon-512", 512)):
    src = "logo/favicon/favicon.svg" if s <= 64 else write(
        "logo/favicon/_regular.svg", logo_svg("monogram", hexc("bone"), hexc("ink"), REGULAR, clear=0.75))
    png(src, f"logo/favicon/{name}.png", s, s)


# ================================================================ INSTAGRAM
IW, IH = 1080, 1920


def canvas(bg, body, w=IW, h=IH, title="Make Time To Move"):
    ground = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{ground}{body}</svg>')


def path(d, fill):
    return f'<path fill="{fill}" d="{d}"/>'


def mono_at(cx, cy, side, fill, lettering=REGULAR):
    d, _ = placed("monogram", cx, cy, width=side, lettering=lettering)
    return path(d, fill)


def text(t, x, y, cap, fill, face=BRAND, tracking=0.0, anchor="middle"):
    return path(face.path(t, x, y, cap, tracking, anchor), fill)


def live(t, x, y, size, fill, family="MTTM Lettering", spacing=0.0, anchor="middle", weight=400, field=""):
    """Editable text for template files (needs the font installed)."""
    return (f'<text x="{fmt(x)}" y="{fmt(y)}" font-family="{family}, sans-serif" font-size="{size}" '
            f'font-weight="{weight}" letter-spacing="{fmt(size * spacing)}" text-anchor="{anchor}" fill="{fill}"'
            f'{f" data-field={chr(34)}{field}{chr(34)}" if field else ""}>{t}</text>')


def ig(rel_base, svg, transparent=False, w=IW, h=IH):
    rel = write(f"instagram/{rel_base}.svg", svg)
    png(rel, f"instagram/{rel_base}.png", w, h, transparent)


# Avatar: monogram, circle-safe (block diagonal = 76% of the circle)
side = 0.76 * IW / 2 ** 0.5
for slug, fg, bg in (("", "bone", "ink"), ("-white-on-black", "white", "black"), ("-black-on-white", "black", "white")):
    ig(f"avatar/mttm-ig-avatar{slug}", canvas(hexc(bg), mono_at(IW / 2, IW / 2, side, hexc(fg)), IW, IW,
                                               "MTTM profile avatar"), w=IW, h=IW)

# Story highlight covers: pillar ground + monogram inside the centre circle. Instagram shows the name underneath.
for t in THEMES:
    body = mono_at(IW / 2, IH / 2, 0.5 * IW / 2 ** 0.5 * 1.25, hexc(t["fg"]))
    ig(f"highlights/mttm-ig-highlight-{t['id']}", canvas(hexc(t["bg"]), body, title=f"Highlight: {t['pillar']}"))

# Ink & Bone story set: brand cover story frame + highlight cover, primary (Bone on Ink) and inverse
for slug, fg, bg in (("bone-on-ink", "bone", "ink"), ("ink-on-bone", "ink", "bone")):
    f, g, grey = hexc(fg), hexc(bg), hexc("stone")
    wm, _ = placed("wordmark", IW / 2, 900, width=780)
    body = (text("@MAKETIMETOMOVE", IW / 2, 340, 16, grey) + path(wm, f)
            + f'<rect x="{IW / 2 - 40}" y="1190" width="80" height="2" fill="{grey}"/>'
            + text("STRENGTH · MOBILITY · MINDSET", IW / 2, 1278, 17, grey))
    ig(f"stories/mttm-ig-story-brand-cover-{slug}", canvas(g, body, title="Make Time To Move story cover"))
    ig(f"highlights/mttm-ig-highlight-cover-{slug}",
       canvas(g, mono_at(IW / 2, IH / 2, 0.5 * IW / 2 ** 0.5 * 1.25, f), title="MTTM highlight cover"))

# Interview series title card (Moss) and template
moss, chalk, lichen = hexc("moss"), hexc("chalk"), hexc("lichen")
Q = ("WHY DO YOU", "MAKE TIME", "TO MOVE?")


def interview_card(number="NO. 01", editable=False):
    b = [mono_at(IW / 2, 330, 132, chalk),
         text("INTERVIEW SERIES", IW / 2, 560, 17, lichen)]
    for i, line in enumerate(Q):
        b.append(text(line, IW / 2, 860 + i * 132, 44, chalk))
    b.append(f'<rect x="{IW / 2 - 40}" y="1238" width="80" height="2" fill="{lichen}"/>')
    if editable:
        b.append(live(number, IW / 2, 1322, 31, chalk, field="episode"))
    else:
        b.append(text(number, IW / 2, 1322, 22, chalk))
    b.append(text("@MAKETIMETOMOVE", IW / 2, 1560, 15, lichen))
    return canvas(moss, "".join(b), title="Why do you make time to move? Interview title card")


ig("interview/mttm-ig-interview-title", interview_card())
write("instagram/interview/mttm-ig-interview-title-template.svg", interview_card("NO. 01", editable=True))


# Lower third (transparent, sits above the bottom Instagram UI)
def lower_third(name="NAME SURNAME", caption="Occupation · Neighbourhood", editable=False):
    x, y, h = 72, 1340, 168
    b = [f'<rect x="{x}" y="{y}" width="660" height="{h}" fill="{moss}"/>',
         f'<rect x="{x}" y="{y}" width="6" height="{h}" fill="{chalk}"/>']
    if editable:
        b.append(live(name, x + 44, y + 74, 34, chalk, anchor="start", field="name"))
        b.append(live(caption, x + 44, y + 124, 26, lichen, family="Manrope", spacing=0.02, anchor="start",
                      weight=500, field="caption"))
    else:
        b.append(text(name, x + 44, y + 72, 24, chalk, anchor="start"))
        b.append(text(caption, x + 44, y + 122, 19, lichen, face=MANROPE, tracking=0.02, anchor="start"))
    return canvas(None, "".join(b), title="Interview lower third")


ig("interview/mttm-ig-lower-third", lower_third(), transparent=True)
write("instagram/interview/mttm-ig-lower-third-template.svg", lower_third(editable=True))

# Reel covers, one per pillar theme. Safe zones: centre 1080x1080 (square crops) inside 1080x1440 (3:4 grid).
SQ_TOP, SQ_BOT = (IH - IW) / 2, (IH + IW) / 2  # 420 .. 1500


def reel(t, title=("YOUR TITLE", "GOES HERE"), editable=False, guide=False):
    fg, bg, grey = hexc(t["fg"]), hexc(t["bg"]), hexc(t["grey"])
    b = [text(t["pillar"].upper(), IW / 2, SQ_TOP + 170, 17, grey)]
    for i, line in enumerate(title):
        y = 920 + (i - (len(title) - 1) / 2) * 112
        b.append(live(line, IW / 2, y, 63, fg, field=f"title{i + 1}") if editable
                 else text(line, IW / 2, y, 44, fg))
    b.append(mono_at(IW / 2, SQ_BOT - 190, 96, fg))
    if guide:
        g = ['<g fill="none" stroke-width="3" stroke-dasharray="16 12">',
             f'<rect x="1.5" y="{(IH - 1440) / 2}" width="{IW - 3}" height="1440" stroke="#d14"/>',
             f'<rect x="60" y="{SQ_TOP + 60}" width="{IW - 120}" height="{IW - 120}" stroke="#18f"/></g>']
        g.append(text("3:4 PROFILE GRID CROP", 30, (IH - 1440) / 2 - 24, 16, "#d14", anchor="start"))
        g.append(text("SAFE ZONE FOR TEXT", 90, SQ_TOP + 40, 16, "#18f", anchor="start"))
        b.append("".join(g))
    return canvas(bg, "".join(b), title=f"Reel cover: {t['pillar']}")


for t in THEMES:
    ig(f"reels/mttm-ig-reel-cover-{t['id']}", reel(t))
    write(f"instagram/reels/mttm-ig-reel-cover-{t['id']}-template.svg", reel(t, editable=True))
ig("reels/mttm-ig-reel-cover-safe-zone-guide", reel(THEMES[1], guide=True))

# ================================================================ MERCH (print-ready, transparent, 300 dpi)
MERCH_INKS = ("bone", "ink", "white", "black")
for slug, kind, L, inches, use in MERCH:
    for ink in MERCH_INKS:
        svg = logo_svg(kind, hexc(ink), None, L, clear=0)
        rel = write(f"merch/{slug}/mttm-merch-{slug}-{ink}.svg", svg)
        vw, vh = vb_size(svg)
        w = round(inches * DPI)
        png(rel, f"merch/{slug}/mttm-merch-{slug}-{ink}.png", w, round(w * vh / vw), transparent=True)

# ================================================================ DESIGN TOKENS
tokens = {
    "brand": {"name": "Make Time To Move", "short": "MTTM", "handle": "@maketimetomove", "file_prefix": "mttm-"},
    "color": {k: {"value": v[0], "role": v[1]} for k, v in COLORS.items()},
    "theme": {t["id"]: {"pillar": t["pillar"], "foreground": hexc(t["fg"]), "background": hexc(t["bg"]),
                        "muted": hexc(t["grey"])} for t in THEMES},
    "font": {
        "display": {"family": "MTTM Lettering", "fallback": "sans-serif (generic keyword only; never substitute another typeface)", "case": "uppercase",
                    "letterSpacing": "0 (brand spacing is built into the font)", "weights": {"Regular": 400, "Heavy": 800},
                    "files": ["fonts/mttm-lettering-regular.woff2", "fonts/mttm-lettering-heavy.woff2"]},
        "body": {"family": "Manrope", "fallback": "system-ui, sans-serif", "weights": [400, 500, 600],
                 "source": "https://fonts.google.com/specimen/Manrope"},
    },
    "space": {"unit": "8px", "scale": [4, 8, 16, 24, 32, 48, 64, 96, 128]},
    "radius": {"none": "0", "subtle": "2px"},
    "rule": {"hairline": "1px"},
}
write("tokens/mttm-tokens.json", json.dumps(tokens, indent=2) + "\n")
css = [":root {", "  /* Make Time To Move: design tokens. Master theme = Ink & Bone. */"]
for k, (v, role) in COLORS.items():
    css.append(f"  --mttm-{k}: {v}; /* {role} */")
css += ["", "  /* Active theme (defaults to master: Bone lettering on Ink) */",
        "  --mttm-fg: var(--mttm-bone);", "  --mttm-bg: var(--mttm-ink);", "  --mttm-muted: var(--mttm-stone);", "",
        "  --mttm-font-display: 'MTTM Lettering', sans-serif; /* never substitute another typeface */",
        "  --mttm-font-body: 'Manrope', system-ui, sans-serif;",
        "  --mttm-tracking-display: 0; /* spacing is built into MTTM Lettering */", "",
        "  --mttm-space-1: 4px; --mttm-space-2: 8px; --mttm-space-3: 16px; --mttm-space-4: 24px;",
        "  --mttm-space-5: 32px; --mttm-space-6: 48px; --mttm-space-7: 64px; --mttm-space-8: 96px;",
        "  --mttm-radius: 0; --mttm-rule: 1px solid var(--mttm-muted);", "}", ""]
for t in THEMES:
    css.append(f'[data-mttm-theme="{t["id"]}"] {{ --mttm-fg: var(--mttm-{t["fg"]}); '
               f'--mttm-bg: var(--mttm-{t["bg"]}); --mttm-muted: var(--mttm-{t["grey"]}); }}')
css += ["", "/* Brand display font (self-hosted; paths relative to this file) */",
        "@font-face { font-family: 'MTTM Lettering'; font-weight: 400; font-display: swap; src: url('../fonts/mttm-lettering-regular.woff2') format('woff2'); }",
        "@font-face { font-family: 'MTTM Lettering'; font-weight: 800; font-display: swap; src: url('../fonts/mttm-lettering-heavy.woff2') format('woff2'); }",
        "/* Body font from Google Fonts: */",
        "/* @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap'); */",
        "", "body { background: var(--mttm-bg); color: var(--mttm-fg); font-family: var(--mttm-font-body); }",
        ".mttm-display { font-family: var(--mttm-font-display); text-transform: uppercase; "
        "letter-spacing: var(--mttm-tracking-display); font-weight: 400; }",
        ".mttm-label { font-family: var(--mttm-font-display); text-transform: uppercase; "
        "letter-spacing: 0; font-size: 0.75rem; color: var(--mttm-muted); }", ""]
write("tokens/mttm-tokens.css", "\n".join(css))


def _b64font(fn):
    import base64
    return base64.b64encode(open(os.path.join(ROOT, "fonts", fn), "rb").read()).decode()


embedded = [
    "/* Make Time To Move: self-contained brand stylesheet.",
    "   Includes the MTTM Lettering font itself (embedded), colour tokens, themes and type classes.",
    "   Drop this one file into any website. No other font files are needed for MTTM Lettering.",
    "   Body font Manrope loads from Google Fonts (see @import below). */",
    "@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap');",
    f"@font-face {{ font-family: 'MTTM Lettering'; font-weight: 400; font-style: normal; font-display: swap; "
    f"src: url('data:font/woff2;base64,{_b64font('mttm-lettering-regular.woff2')}') format('woff2'); }}",
    f"@font-face {{ font-family: 'MTTM Lettering'; font-weight: 800; font-style: normal; font-display: swap; "
    f"src: url('data:font/woff2;base64,{_b64font('mttm-lettering-heavy.woff2')}') format('woff2'); }}",
    "",
] + [l for l in css if "@font-face" not in l and "Brand display font" not in l and "fonts.googleapis" not in l
     and "Body font from Google" not in l]
write("tokens/mttm-brand.css", "\n".join(embedded))

# ================================================================ RENDER
jf = os.path.join(ROOT, "_jobs.json")
with open(jf, "w") as fh:
    json.dump(jobs, fh)
subprocess.run(["node", os.path.join(HERE, "render.mjs"), jf], check=True)
os.remove(jf)
os.remove(os.path.join(ROOT, "logo/favicon/_regular.svg"))
fv = os.path.join(ROOT, "logo/favicon")
subprocess.run(["convert", f"{fv}/favicon-16.png", f"{fv}/favicon-32.png", f"{fv}/favicon-48.png",
                f"{fv}/favicon.ico"], check=True)
print(f"ok: {len(jobs)} PNGs")
