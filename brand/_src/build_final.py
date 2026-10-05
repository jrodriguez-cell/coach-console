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
for d in ("logo", "merch", "tokens"):  # instagram/ is built by build_social.py
    shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)

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

# Favicons / app icons: heavy-cut monogram, Ink on Sage (as in the Coach Console app), clear space 1U
fav = logo_svg("monogram", hexc("ink"), hexc("sage"), HEAVY, clear=1.0)
write("logo/favicon/favicon.svg", fav)
for name, s in (("favicon-16", 16), ("favicon-32", 32), ("favicon-48", 48), ("apple-touch-icon", 180),
                ("icon-192", 192), ("icon-512", 512)):
    src = "logo/favicon/favicon.svg" if s <= 64 else write(
        "logo/favicon/_regular.svg", logo_svg("monogram", hexc("ink"), hexc("sage"), HEAVY, clear=1.0))
    png(src, f"logo/favicon/{name}.png", s, s)


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
    "tint": {"hairline": "fg at 20%", "rule-strong": "fg at 40%", "fill": "fg at 5%", "button-border": "fg at 35%"},
    "type": {"label": "Manrope 500, 11px, uppercase, letter-spacing 0.12em, muted", "title": "Manrope 600, 24-28px, tight", "display": "MTTM Lettering, capitals, letter-spacing 0"},
    "radius": {"none": "0", "subtle": "2px"},
    "rule": {"hairline": "1px"},
}
write("tokens/mttm-tokens.json", json.dumps(tokens, indent=2) + "\n")
css = [":root {", "  /* Make Time To Move: design tokens v2.0. Master theme = Ink on Sage (Coach Console app). */"]
for k, (v, role) in COLORS.items():
    css.append(f"  --mttm-{k}: {v}; /* {role} */")
css += ["", "  /* Active theme (defaults to master: Ink on Sage). Tints of --mttm-fg only for hairlines, fills, hover. */",
        "  --mttm-fg: var(--mttm-ink);", "  --mttm-bg: var(--mttm-sage);", "  --mttm-muted: var(--mttm-fern);",
        "  --mttm-hairline: color-mix(in srgb, var(--mttm-fg) 20%, transparent);",
        "  --mttm-fill: color-mix(in srgb, var(--mttm-fg) 5%, transparent);", "",
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
        "/* Small UI labels (under ~14px cap): Manrope spaced capitals, as in the app. Larger labels: .mttm-display */",
        ".mttm-caps { font-family: var(--mttm-font-body); font-size: 11px; font-weight: 500; text-transform: uppercase; "
        "letter-spacing: 0.12em; line-height: 1; color: var(--mttm-muted); }",
        ".mttm-title { font-family: var(--mttm-font-body); font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }",
        ".mttm-section { border-top: 1px solid var(--mttm-hairline); padding-top: 20px; }",
        ".mttm-panel { background: var(--mttm-fill); padding: 16px; }",
        ".mttm-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 16px; "
        "border: 1px solid color-mix(in srgb, var(--mttm-fg) 35%, transparent); background: transparent; color: var(--mttm-fg); "
        "font: 600 14px/1.3 var(--mttm-font-body); border-radius: 0; text-decoration: none; }",
        ".mttm-btn:hover { border-color: var(--mttm-fg); }",
        ".mttm-btn-primary { background: var(--mttm-fg); border-color: var(--mttm-fg); color: var(--mttm-bg); }",
        ".mttm-input { border: 1px solid color-mix(in srgb, var(--mttm-fg) 30%, transparent); background: var(--mttm-bg); "
        "color: var(--mttm-fg); padding: 8px 12px; font: 16px var(--mttm-font-body); border-radius: 0; }",
        ".mttm-note-alert { background: var(--mttm-fg); color: var(--mttm-bg); } /* blocking */",
        ".mttm-note-warn { border: 1px solid var(--mttm-fg); } /* warning */",
        ".mttm-note-info { background: var(--mttm-fill); } /* info */", ""]
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
