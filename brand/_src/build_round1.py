"""Round 1 (for review): wordmark layout variants, word-break test, typeface comparison.

Writes:
  brand/exploration/*.svg + small-size 1x PNG tests
  brand/type-exploration.html
  brand/preview.html
"""
import json
import math
import os
import subprocess

from mttm import FONTS, Font, MonogramSpec, WordmarkSpec, bbox_of, fmt, monogram_glyphs, wordmark_svg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXP = os.path.join(ROOT, "exploration")
os.makedirs(EXP, exist_ok=True)

BASE_FONT = "syncopate"  # layout tests are drawn in the recommended face
W, B = "#FFFFFF", "#000000"

A = dict(gap1=0.5, gap2=0.5, shift=0.0)
B_ = dict(gap1=0.5, gap2=0.5, shift=0.5)

GAP_TESTS = [
    # id, label, spec kwargs, verdict
    ("a-g0", "A · no word gap (0 / 0)", dict(gap1=0, gap2=0, shift=0),
     "Fails. Reads “MAKETIME / TOMOVE”; at small sizes it becomes one block of letters."),
    ("a-g05", "A · half-cell gap (½ / ½)", dict(gap1=0.5, gap2=0.5, shift=0),
     "Recommended. Both word breaks read at 120px, the lines stay on one shared grid, and the lock-up stays compact."),
    ("a-g1", "A · full-cell gap (1 / 1)", dict(gap1=1, gap2=1, shift=0),
     "Reads, but the words drift apart and the mark looks like four separate blocks. Too loose."),
    ("a-g05-0", "A · gap on line 1 only (½ / 0)", dict(gap1=0.5, gap2=0, shift=0),
     "“TOMOVE” reads as one word, and line 2 falls off the grid by a quarter step. Line 2 needs the gap too."),
    ("b-g0", "B · no word gap (0 / 0), offset ½", dict(gap1=0, gap2=0, shift=0.5),
     "Fails for the same reason as A. The stagger also makes the run of letters harder to parse."),
    ("b-g05", "B · half-cell gap (½ / ½), offset ½", dict(gap1=0.5, gap2=0.5, shift=0.5),
     "Every letter of line 2 sits in a gap of line 1. Line 2 is half a step right of centre, so it reads as slightly off-balance."),
    ("b-g1", "B · full-cell gap (1 / 1), offset ½", dict(gap1=1, gap2=1, shift=0.5),
     "Too loose, and the half-step stagger makes the gap look accidental."),
    ("b-sym", "B · symmetric nest (1 / 0)", dict(gap1=1, gap2=0, shift=0),
     "The only gap combination where the nest is also perfectly centred. The cost is “TOMOVE” with no break. Not recommended."),
]

FONT_NOTES = {
    "syncopate": ("Round 1 recommendation",
                  "The widest and blockiest of the four. Even stroke, true geometric O, no quirks. "
                  "It still reads at 120px and has the quiet, high-end feel. The bold weight keeps the "
                  "monogram solid at 32px."),
    "archivo": ("Strong alternative",
                "Very neutral and engineered, with slightly narrower letters, so the mark is more compact. "
                "The variable family (width and weight) is useful for supporting type. Slightly less "
                "distinctive than Syncopate."),
    "michroma": ("Chosen (round 2)",
                 "The most refined look, but the hairline-ish stroke fades at small sizes and in the monogram "
                 "at 32px and 16px. It would need a heavier cut, which doesn't exist."),
    "unbounded": ("Not recommended",
                  "Wide and heavy, but the ink-trap notches on K and E read as ornamental at display "
                  "sizes. The rounder, friendlier tone pulls away from quiet and premium."),
}

FONT_ORDER = ["syncopate", "archivo", "michroma", "unbounded"]


def save(name, svg):
    with open(os.path.join(EXP, name), "w") as f:
        f.write(svg)
    return f"exploration/{name}"


def sized(svg, width, cls=""):
    return svg.replace("<svg ", f'<svg width="{width}" class="{cls}" ', 1)


def monogram_circle_svg(font, fg=W, bg=B, overlay_circle=True):
    """Monogram centred in a square canvas; the 2x2 block's diagonal fits within a
    circle of 82% canvas diameter so it survives a circular crop."""
    g, _ = monogram_glyphs(font, MonogramSpec())
    x0, y0, x1, y1 = bbox_of(font, g)
    w, h = x1 - x0, y1 - y0
    diag = math.hypot(w, h)
    side = diag / 0.82
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vx, vy = cx - side / 2, cy - side / 2
    d = " ".join(font.path(c, x, b) for c, x, b in g)
    circle = (f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(side/2)}" fill="{bg}"/>' if overlay_circle
              else f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(side)}" height="{fmt(side)}" fill="{bg}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(side)} {fmt(side)}">'
            f'{circle}<path fill="{fg}" d="{d}"/></svg>')


# ---------------------------------------------------------------- render jobs
jobs = []


def png_1x(svg_rel, width, height, out_name):
    out = os.path.join(EXP, out_name)
    jobs.append({"src": os.path.join(ROOT, svg_rel), "out": out, "width": width, "height": height})
    return f"exploration/{out_name}"


def svg_aspect(svg):
    vb = svg.split('viewBox="')[1].split('"')[0].split()
    return float(vb[3]) / float(vb[2])


def small_test(svg_rel, svg, width):
    h = max(1, round(width * svg_aspect(svg)))
    base = os.path.splitext(os.path.basename(svg_rel))[0]
    return png_1x(svg_rel, width, h, f"{base}-{width}px-1x.png"), h


# ---------------------------------------------------------------- build
base = Font(BASE_FONT)

layout = {}
for vid, kw in (("A", A), ("B", B_)):
    spec = WordmarkSpec(**kw)
    for tone, fg, bg in (("white-on-black", W, B), ("black-on-white", B, W)):
        svg = wordmark_svg(base, spec, fg, bg, overlay=True)
        layout[(vid, tone)] = svg
        save(f"mttm-wordmark-variant-{vid.lower()}-{tone}.svg", wordmark_svg(base, spec, fg, bg))

gap_cards = []
for gid, label, kw, verdict in GAP_TESTS:
    spec = WordmarkSpec(**kw)
    big = wordmark_svg(base, spec, W, B, overlay=True)
    tight = wordmark_svg(base, spec, W, B, pad=40)
    rel = save(f"gaptest-{gid}.svg", tight)
    p120, h120 = small_test(rel, tight, 120)
    gap_cards.append((gid, label, verdict, big, tight, p120, h120))

fonts = {k: Font(k) for k in FONT_ORDER}
font_cards = []
for k in FONT_ORDER:
    f = fonts[k]
    spec = WordmarkSpec(**A)
    wob = wordmark_svg(f, spec, W, B)
    bow = wordmark_svg(f, spec, B, W)
    tight = wordmark_svg(f, spec, W, B, pad=40)
    rel = save(f"type-{k}-wordmark.svg", wob)
    save(f"type-{k}-wordmark-black-on-white.svg", bow)
    trel = save(f"type-{k}-wordmark-tight.svg", tight)
    p120, h120 = small_test(trel, tight, 120)
    mono = monogram_circle_svg(f)
    mrel = save(f"type-{k}-monogram-circle.svg", mono)
    m32 = png_1x(mrel, 32, 32, f"type-{k}-monogram-32px-1x.png")
    m16 = png_1x(mrel, 16, 16, f"type-{k}-monogram-16px-1x.png")
    font_cards.append((k, f.name, wob, bow, tight, p120, h120, mono, m32, m16))

jf = os.path.join(EXP, "_jobs.json")
with open(jf, "w") as fh:
    json.dump(jobs, fh)
subprocess.run(["node", os.path.join(os.path.dirname(__file__), "render.mjs"), jf], check=True)
os.remove(jf)

# ---------------------------------------------------------------- HTML
CSS = """
:root{--bg:#f3f3f1;--ink:#0a0a0a;--mute:#6b6b6b;--line:#d9d9d6;--card:#ffffff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:48px 24px 96px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:1px solid var(--ink);padding-bottom:20px;margin-bottom:40px;flex-wrap:wrap}
h1{font-size:13px;letter-spacing:.32em;font-weight:600;margin:0;text-transform:uppercase}
.status{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
h2{font-size:12px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;margin:64px 0 6px}
h2 span{color:var(--mute);margin-right:14px}
.lede{color:var(--mute);max-width:760px;margin:0 0 24px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--line);padding:20px}
.card h3{font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 4px;font-weight:600}
.card p{margin:6px 0 0;color:var(--mute);font-size:14px}
.card.pick{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.tag{display:inline-block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;border:1px solid var(--ink);padding:2px 8px;margin-left:8px;vertical-align:2px}
.tag.mute{border-color:var(--line);color:var(--mute)}
svg{display:block;max-width:100%;height:auto}
.stack>*+*{margin-top:12px}
.row{display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap;margin-top:14px}
.row figure{margin:0}
figcaption{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-top:6px}
.px{image-rendering:pixelated}
.grid{display:none}
body.show-grid .grid{display:inline}
.toggle{font:inherit;font-size:12px;letter-spacing:.16em;text-transform:uppercase;background:none;border:1px solid var(--ink);padding:8px 14px;cursor:pointer}
body.show-grid .toggle{background:var(--ink);color:#fff}
.summary{background:var(--ink);color:#fff;padding:28px;margin-bottom:8px}
.summary h3{font-size:12px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 12px}
.summary ul{margin:0;padding-left:18px}
.summary li{margin:4px 0}
.summary .q{margin-top:18px;border-top:1px solid #333;padding-top:16px}
.fontrow{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1fr);gap:20px;align-items:start}
@media (max-width:760px){.fontrow{grid-template-columns:1fr}}
.circle{border-radius:50%;overflow:hidden;display:inline-block;line-height:0}
footer{margin-top:72px;font-size:12px;color:var(--mute);border-top:1px solid var(--line);padding-top:16px}
"""

FONT_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">')


def page(title, body):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>{FONT_LINK}<style>{CSS}</style></head>
<body><div class="wrap">{body}</div>
<script>document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('show-grid')));</script>
</body></html>"""


def type_section(heading_num="03"):
    cards = []
    for k, name, wob, bow, tight, p120, h120, mono, m32, m16 in font_cards:
        tag, note = FONT_NOTES[k]
        pick = " pick" if k == "michroma" else ""
        tagcls = "tag" if k in ("michroma",) else "tag mute"
        cards.append(f"""
<div class="card{pick}">
  <h3>{name}<span class="{tagcls}">{tag}</span></h3>
  <p>{note}</p>
  <div class="fontrow" style="margin-top:16px">
    <div class="stack">{wob}{bow}</div>
    <div>
      <div class="row">
        <figure>{sized(tight, 200)}<figcaption>200px</figcaption></figure>
        <figure><img class="px" src="{p120}" width="120" height="{h120}" alt=""><figcaption>120px · 1×</figcaption></figure>
      </div>
      <div class="row">
        <figure><span class="circle">{sized(mono, 120)}</span><figcaption>Monogram · circle</figcaption></figure>
        <figure><img src="{m32}" width="32" height="32" alt=""><figcaption>32</figcaption></figure>
        <figure><img src="{m16}" width="16" height="16" alt=""><figcaption>16</figcaption></figure>
        <figure><img class="px" src="{m32}" width="96" height="96" alt=""><figcaption>32 · zoom 3×</figcaption></figure>
      </div>
    </div>
  </div>
</div>""")
    return f"""
<h2><span>{heading_num}</span>Typeface comparison</h2>
<p class="lede">The four candidates, set in the recommended layout (A, centred, half-cell word gaps) with identical
grid, tracking and leading. Cap heights are normalised, so only the letterforms differ. Small-size images are
rendered at true 1× pixels, which is harsher than a retina screen. The monogram here is a first pass
(M T / T M on the wordmark grid), included only so you can judge each face at 32px and 16px.</p>
<div class="stack">{''.join(cards)}</div>"""


# --- type-exploration.html
type_body = f"""
<header><h1>Make Time To Move · Type exploration</h1><div class="status">Round 1 · for review</div></header>
{type_section("01")}
<footer>All letterforms are outlined paths generated from the font files in <code>brand/_src/fonts</code>
(SIL OFL / Apache 2.0). Source: <code>brand/_src/build_round1.py</code>.</footer>"""
with open(os.path.join(ROOT, "type-exploration.html"), "w") as fh:
    fh.write(page("MTTM Type Exploration", type_body))

# --- preview.html
def layout_card(vid, title, desc, pick):
    return f"""
<div class="card{' pick' if pick else ''}">
  <h3>Variant {vid} · {title}{'<span class="tag">Recommended</span>' if pick else ''}</h3>
  <p>{desc}</p>
  <div class="stack" style="margin-top:16px">{layout[(vid,'white-on-black')]}{layout[(vid,'black-on-white')]}</div>
</div>"""


gap_html = []
for gid, label, verdict, big, tight, p120, h120 in gap_cards:
    pick = gid == "a-g05"
    gap_html.append(f"""
<div class="card{' pick' if pick else ''}">
  <h3>{label}{'<span class="tag">Chosen</span>' if pick else ''}</h3>
  <div style="margin-top:12px">{big}</div>
  <div class="row">
    <figure>{sized(tight, 240)}<figcaption>240px</figcaption></figure>
    <figure>{sized(tight, 160)}<figcaption>160px</figcaption></figure>
    <figure><img class="px" src="{p120}" width="120" height="{h120}" alt=""><figcaption>120px · 1×</figcaption></figure>
    <figure><img class="px" src="{p120}" width="240" height="{h120*2}" alt=""><figcaption>120px · zoom 2×</figcaption></figure>
  </div>
  <p>{verdict}</p>
</div>""")

preview_body = f"""
<header><h1>Make Time To Move · Brand preview</h1><div class="status">Round 1 · layout and type · awaiting your choice</div></header>

<div class="summary">
  <h3>Recommendation</h3>
  <ul>
    <li><b>Layout:</b> Variant A (centred), with a half-cell word gap on <i>both</i> lines.</li>
    <li><b>Typeface:</b> Syncopate Bold, outlined to paths. Archivo Expanded SemiBold is the alternative.</li>
    <li><b>Why A over B:</b> B’s nest only works if line 2 sits half a step off-centre (or loses its word gap).
      At small sizes that offset reads as a misalignment rather than a deliberate interlock. A also matches the
      monogram, whose M T / T M grid is column-aligned by definition.</li>
  </ul>
  <div class="q"><b>Your call:</b> (1) A or B, (2) which typeface. After that I’ll build the final wordmark,
  monogram, Instagram set and guidelines.</div>
</div>

<h2><span>01</span>Wordmark layout · A vs B</h2>
<p class="lede">Same face (Syncopate Bold), same letter grid, tracking and leading. Every letter is centred in a
cell of identical width, so the tracking is the grid. Toggle the grid to see how line 2 relates to line 1.</p>
<p><button class="toggle">Show letter grid</button></p>
<div class="grid2">
{layout_card('A', 'Centred', 'Line 2 is centred under line 1. With equal word gaps, every letter of TO MOVE falls on a column of the line-1 grid. Symmetric and calm.', True)}
{layout_card('B', 'Nested', 'Line 2 is offset half a letter-step, so each letter of TO MOVE sits in a gap of MAKE TIME. More woven and distinctive, but line 2 sits half a step right of centre.', False)}
</div>

<h2><span>02</span>Word-break test</h2>
<p class="lede">Gaps are measured in grid cells. Each card shows the mark large, at 240px and 160px (vector), and at
120px wide as a true 1× raster, the worst case for an email signature or a small web header. Line 1 / line 2 gaps
are shown in brackets.</p>
<p><button class="toggle">Show letter grid</button></p>
<div class="grid2">{''.join(gap_html)}</div>

{type_section("03")}

<footer>Round 1. SVG sources are in <code>brand/exploration/</code>. Everything is outlined paths, with no font dependency.
Rebuild with <code>python3 brand/_src/build_round1.py</code>.</footer>
"""
with open(os.path.join(EXP, "round-1.html"), "w") as fh:
    fh.write(page("MTTM Round 1", preview_body.replace('src="exploration/', 'src="')))
print("ok")
