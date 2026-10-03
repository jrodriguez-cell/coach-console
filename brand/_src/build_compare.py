"""Decision aid: 1 : 1 vs 1.25 : 1 lettering, shown in real brand contexts.

Writes brand/exploration/compare-1-vs-125.html (self-contained).
"""
import math
import os

from lettering import EqualLettering
from mttm import fmt
from pagekit import Embedder
from system import U, bbox, glyphs_for, hexc, logo_svg, placed

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EMB = Embedder(os.path.join(ROOT, "exploration", "_cmptmp"))
img = Embedder.img
INK, BONE, STONE = hexc("ink"), hexc("bone"), hexc("stone")


def L(w, heavy=False):
    return EqualLettering(width=w, stem=22 if heavy else 12, bar=20 if heavy else 11, slab_i=False,
                          o_style="ellipse", k_style="simple")


OPTS = [("1 : 1", L(100), L(100, True)), ("1.25 : 1", L(125), L(125, True))]


def size(kind, lt):
    x0, y0, x1, y1 = bbox(lt, glyphs_for(kind, lt))
    return x1 - x0, y1 - y0


def avatar(lt, px=1080, fg=BONE, bg=INK):
    w, h = size("monogram", lt)
    side = 0.76 * px / math.hypot(w, h) * w  # block diagonal = 76% of the circle
    d, _ = placed("monogram", px / 2, px / 2, width=side, lettering=lt)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {px} {px}"><circle cx="{px / 2}" cy="{px / 2}" '
            f'r="{px / 2}" fill="{bg}"/><path fill="{fg}" d="{d}"/></svg>')


def cap(lt, fg=BONE, bg=INK):
    crown = "M78,206 C78,112 128,62 200,62 C272,62 322,112 322,206 Q200,196 78,206 Z"
    brim = "M108,204 Q200,192 292,204 Q306,236 286,252 Q200,238 114,252 Q94,236 108,204 Z"
    seams = "M200,62 L200,200 M200,62 C160,90 140,140 136,202 M200,62 C240,90 260,140 264,202"
    w, h = size("monogram", lt)
    d, _ = placed("monogram", 200, 146, height=72 * h / max(w, h) * (w / h if w < h else 1), lettering=lt)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><path d="{crown}" fill="{bg}"/>'
            f'<path d="{seams}" fill="none" stroke="#ffffff14" stroke-width="2"/><circle cx="200" cy="62" r="7" fill="{bg}"/>'
            f'<path d="{brim}" fill="{bg}" stroke="#ffffff22" stroke-width="2"/><path fill="{fg}" d="{d}"/></svg>')


def cap_same_height(lt):
    """Embroidery is limited by height on a cap front: both monograms get the same height (2.25 in panel)."""
    crown = "M78,206 C78,112 128,62 200,62 C272,62 322,112 322,206 Q200,196 78,206 Z"
    brim = "M108,204 Q200,192 292,204 Q306,236 286,252 Q200,238 114,252 Q94,236 108,204 Z"
    d, _ = placed("monogram", 200, 146, height=70, lettering=lt)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><path d="{crown}" fill="{INK}"/>'
            f'<circle cx="200" cy="62" r="7" fill="{INK}"/><path d="{brim}" fill="{INK}" stroke="#ffffff22" '
            f'stroke-width="2"/><path fill="{BONE}" d="{d}"/></svg>')


def header(lt):
    d, _ = placed("single-line", 40 + 150, 36, width=300, lettering=lt)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 72"><rect width="760" height="72" fill="{INK}"/>'
            f'<path fill="{BONE}" d="{d}"/><g font-family="Michroma, sans-serif" font-size="10" letter-spacing="2.4" '
            f'fill="{STONE}"><text x="470" y="40">TRAIN</text><text x="550" y="40">INTERVIEWS</text>'
            f'<text x="680" y="40">START</text></g></svg>')


def story(lt, title):
    d, _ = placed("wordmark", 540, 960, width=760, lettering=lt)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" '
            f'fill="{INK}"/><path fill="{BONE}" d="{d}"/></svg>')


def letters(lt, chars="MOKE"):
    g = [(c, i * (lt.W + 50), U) for i, c in enumerate(chars)]
    from mttm import svg_doc, bbox_of
    return svg_doc(" ".join(lt.path(c, x, b) for c, x, b in g), bbox_of(lt, g), 30, INK, BONE, chars)


def sized(svg, w):
    return svg.replace("<svg ", f'<svg width="{w}" ', 1)


# ---------------------------------------------------------------- measurements
w1, h1 = size("wordmark", OPTS[0][1])
w2, h2 = size("wordmark", OPTS[1][1])
m1 = math.hypot(*size("monogram", OPTS[0][1]))
m2 = math.hypot(*size("monogram", OPTS[1][1]))
wm_gain = (w2 / w1 - 1) * 100       # how much larger 1:1 letters are at the same wordmark width
av_gain = (m2 / m1 - 1) * 100       # how much larger 1:1 letters are in the avatar circle
sl1, sl2 = size("single-line", OPTS[0][1])[0], size("single-line", OPTS[1][1])[0]

cols = []
for name, lt, hv in OPTS:
    tag = name.split()[0].replace(".", "")
    wm = logo_svg("wordmark", BONE, INK, lt)
    tight = logo_svg("wordmark", BONE, INK, lt, clear=0.4)
    av = avatar(lt)
    ww, hh = size("wordmark", lt)
    k160 = EMB.add(tight, 160, round(160 * (hh + 80) / (ww + 80)), f"wm160-{tag}")
    k110 = EMB.add(av, 110, 110, f"av110-{tag}")
    k40 = EMB.add(av, 40, 40, f"av40-{tag}")
    mono_h = logo_svg("monogram", BONE, INK, hv, clear=0.75)
    mw, mh = size("monogram", hv)
    k32 = EMB.add(mono_h, 32, round(32 * (mh + 150) / (mw + 150)), f"m32-{tag}")
    hl = "".join(f'<span class="hl">{img(EMB.add(avatar(lt, fg=hexc(fg), bg=hexc(bg)), 64, 64, f"hl-{tag}-{bg}"), 64, 64)}</span>'
                 for fg, bg in (("ink", "bone"), ("bone", "ink"), ("ink", "sage"), ("mist", "midnight"), ("chalk", "moss")))
    cols.append(dict(name=name, wm=wm, av=av, k160=k160, h160=round(160 * (hh + 80) / (ww + 80)), k110=k110, k40=k40,
                     k32=k32, h32=round(32 * (mh + 150) / (mw + 150)), hl=hl, cap=cap_same_height(hv),
                     header=header(lt), story=story(lt, name), letters=letters(lt)))


def row(title, note, key, fmt_cell=lambda c, v: v):
    cells = "".join(f'<div class="cell"><div class="tag">{c["name"]}</div>{fmt_cell(c, c[key])}</div>' for c in cols)
    return f'<section><h2>{title}</h2><p class="note">{note}</p><div class="pair">{cells}</div></section>'


rows = [
    row("Wordmark", "Same artwork width. Here the only differences are letter shape and length.", "wm"),
    row("Letter shapes", "The O is the clearest difference: a true circle against a soft ellipse. M, K and E relax a "
        "little at 1.25.", "letters"),
    row("Instagram avatar", f"Same circle and the same safe-crop rule. The 1 : 1 monogram is a perfect square, so its "
        f"letters are about <b>{av_gain:.0f}% larger</b> in the circle.", "av",
        lambda c, v: f'<span class="round">{sized(v, 220)}</span>'),
    row("Profile and feed size, true 1× pixels", "110 px (profile page) and 40 px (feed and comments).", "k110",
        lambda c, v: f'<div class="smalls">{img(c["k110"], 110, 110, "rimg")}{img(c["k40"], 40, 40, "rimg")}</div>'),
    row("Highlight row", "How the five pillar covers sit together at their real size.", "hl",
        lambda c, v: f'<div class="smalls">{v}</div>'),
    row("Story / poster", "The wordmark at the same width on a 9:16 story. 1.25 runs longer, so its letters are smaller.",
        "story", lambda c, v: f'<div class="story">{v}</div>'),
    row("Cap front embroidery", "A cap panel limits the height, so both monograms get the same height. The 1.25 version "
        "is 25% wider.", "cap"),
    row("Website header", f"The single-line logo at 300 px wide. At the same width, 1 : 1 letters are "
        f"<b>{(sl2 / sl1 - 1) * 100:.0f}% taller</b>.", "header"),
    row("Smallest sizes, true 1× pixels", "The wordmark at 160 px wide, and the heavy-cut monogram at 32 px.", "k160",
        lambda c, v: f'<div class="smalls">{img(c["k160"], 160, c["h160"])}{img(c["k32"], 32, c["h32"])}</div>'),
]

score = [
    ("Your request: a circular O", "Perfect circle", "Soft ellipse"),
    ("Spacing rule", "One unit both ways: letter, gap and line are all 1 U", "Gaps 1.25 U across, 1 U between lines"),
    ("Monogram shape", "Perfect 3 × 3 square", "3.75 × 3, slightly wide"),
    ("Avatar and highlights", f"Letters about {av_gain:.0f}% larger", "Smaller in the circle"),
    ("Wordmark proportion", "5 : 1", "6.25 : 1, longer"),
    ("Same-width legibility (web, story, hat)", f"Letters about {wm_gain:.0f}% taller", "Smaller"),
    ("Character", "Geometric, architectural, calm", "Closer to Michroma’s extended look, more ‘tech’"),
]
score_html = "".join(f"<tr><th>{a}</th><td>{b}</td><td>{c}</td></tr>" for a, b, c in score)

CSS = """
:root{--ink:#0E0E0D;--bone:#EFEBE3;--paper:#F6F3EE;--stone:#8F8B83;--line:#D9D3C7;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bone);color:var(--ink);font:16px/1.6 "Manrope",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding-inline:clamp(16px,4vw,32px);padding-block:40px 80px}
h1{font:400 clamp(18px,2.4vw,24px)/1.3 "Michroma",sans-serif;letter-spacing:.2em;margin:0 0 8px}
h2{font:400 12px/1.4 "Michroma",sans-serif;letter-spacing:.24em;text-transform:uppercase;margin:0 0 4px}
section{border-top:1px solid var(--ink);padding-top:16px;margin-top:40px}
.note{color:#55534e;margin:0 0 14px;max-width:70ch}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media (max-width:640px){.pair{grid-template-columns:1fr}}
.cell{background:var(--paper);border:1px solid var(--line);padding:16px;min-width:0;display:flex;flex-direction:column;gap:10px}
.tag{font:11px "Michroma",sans-serif;letter-spacing:.2em}
svg{display:block;max-width:100%;height:auto}
.round svg,.rimg{border-radius:50%}
.smalls{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
.hl img{border-radius:50%;display:block;outline:1px solid var(--line)}
.story{max-width:200px}
.rec{background:var(--ink);color:var(--bone);padding:24px;margin-top:24px}
.rec p{margin:6px 0;max-width:72ch}
table{border-collapse:collapse;width:100%;font-size:14px;margin-top:12px}
th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
thead th{font:10px "Michroma",sans-serif;letter-spacing:.2em;border-bottom:1px solid var(--ink)}
tbody th{font-weight:600;width:28%}
.tbl{overflow-x:auto}
"""
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM 1:1 vs 1.25:1</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&family=Manrope:wght@400;600&display=swap">
<style>{CSS}</style></head><body><div class="wrap">
<h1>1 : 1 VS 1.25 : 1</h1><p class="note">The same lettering, spacing rules, monogram rules and colours. Only the letter width changes.</p>
<div class="rec"><p><b>Recommendation: 1 : 1.</b> It is the only version where the O is the true circle you asked for, where
the spacing is the same unit in every direction, and where the monogram is a perfect square. It is also the stronger
performer where the brand appears most: the avatar, highlights, hats and small sizes.</p>
<p>Choose 1.25 if, when you look at the wordmark rows below, the slightly extended, more Michroma-like feel matters
more to you than the circular O and the bigger small-size letters.</p></div>
<section><h2>Scorecard</h2><div class="tbl"><table><thead><tr><th></th><th>1 : 1</th><th>1.25 : 1</th></tr></thead>
<tbody>{score_html}</tbody></table></div></section>
{''.join(rows)}
</div></body></html>"""
html = EMB.run_and_fill(html)
with open(os.path.join(ROOT, "exploration", "compare-1-vs-125.html"), "w") as f:
    f.write(html)
print(f"ok · wordmark gain {wm_gain:.0f}% · avatar gain {av_gain:.0f}% · single-line gain {(sl2 / sl1 - 1) * 100:.0f}%")
