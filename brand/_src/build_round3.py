"""Round 3 (for review): equal-width lettering, equal gaps, square monogram grid, four-theme colour system.

Writes brand/exploration/r3-*.svg and brand/preview.html (small-size PNG tests are embedded
as data URIs so the page works when opened on its own).
"""
import base64
import json
import math
import os
import subprocess

from lettering import EqualLettering
from mttm import Font, MonogramSpec, WordmarkSpec, bbox_of, fmt, monogram_glyphs, wordmark_svg
from pagekit import CSS, FONT_LINK

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXP = os.path.join(ROOT, "exploration")
TMP = os.path.join(EXP, "_r3tmp")
os.makedirs(TMP, exist_ok=True)

REG = EqualLettering(stem=12, bar=11, name="Regular (Michroma weight)")
HVY = EqualLettering(stem=15.5, bar=14, name="Heavy (+30%)")
CUT = EqualLettering(stem=21, bar=19, name="Small cut")  # favicon-only drawing
PLAIN_I = EqualLettering(stem=12, bar=11, slab_i=False)
MICHROMA = Font("michroma")

GAP = 140                      # equal gap between every pair of letters (cap height = 100)
LEADING = 80 + 0.5 * (GAP - 55)  # 122.5, carried over from round 2
W_, B_ = "#FFFFFF", "#000000"


def spec(layout):
    return WordmarkSpec(track=GAP, gap1=0, gap2=0, shift=0.5 if layout == "B" else 0.0, leading=LEADING)


THEMES = [
    dict(id="ink-bone", name="Ink & Bone", role="Master", dark="#0E0E0D", light="#EFEBE3", grey="#8F8B83",
         ground="dark",
         note="The brand’s default for the logo, profile, Start Here and anything general. It has the restraint of "
              "black and white with a warmer, printed finish."),
    dict(id="moss", name="Moss", role="Interviews", dark="#1E2A23", light="#E8E6DD", grey="#8C948D", ground="dark",
         note="A deep green that looks almost black. Out in the world and among people, so it suits the "
              "stranger-interview series."),
    dict(id="midnight", name="Midnight", role="Mindset", dark="#121A26", light="#E3E7EC", grey="#87909C",
         ground="dark",
         note="A blue-black with a mist white. Calm, inward and focused, so it suits mindset content."),
    dict(id="sage", name="Sage", role="Mobility", dark="#0E0E0D", light="#B7C0AE", grey="#5F665A", ground="light",
         note="The only light ground: ink lettering on muted sage. Soft and restorative, so it suits mobility and "
              "recovery. It reads as a different temperature in the highlight row."),
]
PILLARS = [  # highlight name, theme id, dark ground?
    ("START HERE", "#EFEBE3", "#0E0E0D", "Bone"),
    ("STRENGTH", "#0E0E0D", "#EFEBE3", "Ink"),
    ("MOBILITY", "#B7C0AE", "#0E0E0D", "Sage"),
    ("MINDSET", "#121A26", "#E3E7EC", "Midnight"),
    ("INTERVIEWS", "#1E2A23", "#E8E6DD", "Moss"),
]


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def save(name, svg, d=EXP):
    path = os.path.join(d, name)
    with open(path, "w") as f:
        f.write(svg)
    return path


def sized(svg, width):
    return svg.replace("<svg ", f'<svg width="{width}" ', 1)


def aspect(svg):
    vb = svg.split('viewBox="')[1].split('"')[0].split()
    return float(vb[3]) / float(vb[2])


jobs, embeds = [], {}


def raster(svg, w, h, key):
    src = save(f"{key}.svg", svg, TMP)
    out = os.path.join(TMP, f"{key}.png")
    jobs.append({"src": src, "out": out, "width": w, "height": h})
    embeds[key] = out
    return key


def img(key, w, h, cls="", disp_w=None, disp_h=None):
    return (f'<img class="{cls}" src="@@{key}@@" width="{disp_w or w}" height="{disp_h or h}" alt="">')


def monogram_svg(lettering, gap, leading, fg=W_, bg=B_, ring=True):
    """M T / T M centred so the block's diagonal sits inside 82% of the circle's
    diameter (survives the Instagram crop)."""
    g, _ = monogram_glyphs(lettering, MonogramSpec(track=gap, leading=leading))
    x0, y0, x1, y1 = bbox_of(lettering, g)
    side = math.hypot(x1 - x0, y1 - y0) / 0.82
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vx, vy = cx - side / 2, cy - side / 2
    d = " ".join(lettering.path(c, x, b) for c, x, b in g)
    ground = (f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(side / 2)}" fill="{bg}"/>' if ring else
              f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(side)}" height="{fmt(side)}" fill="{bg}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(side)} {fmt(side)}" '
            f'role="img" aria-label="MTTM monogram"><title>MTTM monogram</title>{ground}'
            f'<path fill="{fg}" d="{d}"/></svg>')


def letter_sheet(lettering, fg=B_, bg=W_):
    g = [(c, i * (lettering.widest + 50), 100) for i, c in enumerate("MAKETIOV")]
    d = " ".join(lettering.path(c, x, b) for c, x, b in g)
    x0, y0, x1, y1 = bbox_of(lettering, g)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x0 - 30)} {fmt(y0 - 30)} '
            f'{fmt(x1 - x0 + 60)} {fmt(y1 - y0 + 60)}"><rect x="{fmt(x0 - 30)}" y="{fmt(y0 - 30)}" '
            f'width="{fmt(x1 - x0 + 60)}" height="{fmt(y1 - y0 + 60)}" fill="{bg}"/><path fill="{fg}" d="{d}"/></svg>')


# ------------------------------------------------------------------ 01 lettering
sheets = [("Michroma, as in round 2", "Proportional widths: M is 1.6× wider than E, and I is a single stem.",
           letter_sheet(MICHROMA)),
          ("Equal width · Regular", "Every letter is 1.36× the cap height wide, at Michroma’s weight. My pick.",
           letter_sheet(REG)),
          ("Equal width · Heavy", "The same drawing about 30% heavier. Holds up better small, but less airy.",
           letter_sheet(HVY))]
for i, (_, _, svg) in enumerate(sheets):
    save(f"r3-letters-{i}.svg", svg)


def time_word(lettering):
    sp = WordmarkSpec(track=GAP, gap1=0, gap2=0, lines=(("TIME",), ("",)))
    g = [(c, i * (lettering.widest + GAP), 100) for i, c in enumerate("TIME")]
    d = " ".join(lettering.path(c, x, b) for c, x, b in g)
    from mttm import svg_doc
    return svg_doc(d, bbox_of(lettering, g), 60, W_, B_, "TIME")


i_slab, i_plain = time_word(REG), time_word(PLAIN_I)

# ------------------------------------------------------------------ 02 wordmark A / B
wm = {}
for lay in ("A", "B"):
    for tone, fg, bg in (("white-on-black", W_, B_), ("black-on-white", B_, W_)):
        wm[(lay, tone)] = wordmark_svg(REG, spec(lay), fg, bg, overlay=True)
        save(f"r3-wordmark-{lay.lower()}-{tone}.svg", wordmark_svg(REG, spec(lay), fg, bg))
small = {}
for lay in ("A", "B"):
    for wt, L in (("reg", REG), ("hvy", HVY)):
        tight = wordmark_svg(L, spec(lay), W_, B_, pad=40)
        h = round(160 * aspect(tight))
        small[(lay, wt)] = (tight, raster(tight, 160, h, f"wm-{lay}-{wt}-160"), h)

# ------------------------------------------------------------------ 03 monogram
MONO_OPTS = [
    ("wordmark", "Wordmark spacing", GAP, LEADING,
     "Exactly the wordmark’s gaps (140 across, 122.5 between lines). An open, airy block that gets small in the circle."),
    ("even", "Even gutter", 60, 60,
     "The same 60-unit gap horizontally and vertically, so all four letters sit in a perfect square. My pick."),
    ("tight", "Tight", 36, 36,
     "The same even-gutter logic, tighter. Largest letters for the crop, and reads like a seal."),
]
mono = []
for mid, label, gap, lead, note in MONO_OPTS:
    svg = monogram_svg(REG, gap, lead)
    save(f"r3-monogram-{mid}.svg", svg)
    cut = monogram_svg(CUT, gap, lead)
    save(f"r3-monogram-{mid}-smallcut.svg", cut)
    mono.append(dict(id=mid, label=label, note=note, svg=svg,
                     r32=raster(svg, 32, 32, f"mo-{mid}-32"), r16=raster(svg, 16, 16, f"mo-{mid}-16"),
                     c32=raster(cut, 32, 32, f"mo-{mid}-cut-32"), c16=raster(cut, 16, 16, f"mo-{mid}-cut-16")))

# ------------------------------------------------------------------ 04 themes
themes = []
for t in THEMES:
    if t["ground"] == "dark":
        primary = (t["light"], t["dark"])
    else:
        primary = (t["dark"], t["light"])
    alt = (primary[1], primary[0])
    p_svg = wordmark_svg(REG, spec("A"), *primary)
    a_svg = wordmark_svg(REG, spec("A"), *alt)
    save(f"r3-theme-{t['id']}-wordmark-primary.svg", p_svg)
    save(f"r3-theme-{t['id']}-wordmark-alternate.svg", a_svg)
    m_svg = monogram_svg(REG, 60, 60, primary[0], primary[1])
    themes.append((t, primary, p_svg, a_svg, m_svg))

# ------------------------------------------------------------------ render small tests
jf = os.path.join(TMP, "jobs.json")
with open(jf, "w") as fh:
    json.dump(jobs, fh)
subprocess.run(["node", os.path.join(os.path.dirname(__file__), "render.mjs"), jf], check=True)
data = {k: "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode() for k, p in embeds.items()}
for f in os.listdir(TMP):
    os.remove(os.path.join(TMP, f))
os.rmdir(TMP)

# ------------------------------------------------------------------ HTML
EXTRA_CSS = """
.sheet{margin-top:12px}
.ibox{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px;margin-top:12px}
.theme-tag{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin-left:10px}
.pill{width:104px;height:104px}
"""
P = []
P.append("""
<header><h1>Make Time To Move · Brand preview</h1><div class="status">Round 3 · equal-width lettering · colour system</div></header>
<div class="summary">
  <h3>What changed from your feedback</h3>
  <ul>
    <li><b>Equal-width letters:</b> I redrew M A K E T I O V as custom lettering in Michroma’s style: the same weight, flat-cut points, rounded-square O and K’s arm stub. Every letter is now exactly the same width and the same height.</li>
    <li><b>Equal spacing:</b> every gap between letters is identical, at the Wide setting you liked (1.4× the cap height). There’s no word gap, as before.</li>
    <li><b>Monogram:</b> because M and T are now the same width, M T / T M is a true square grid.</li>
    <li><b>Colour system:</b> Ink &amp; Bone is the master, and Moss, Midnight and Sage are theme colours, one per content pillar. Pure black and white stays as a utility for one-colour printing such as embroidery or stamps.</li>
  </ul>
  <div class="q"><b>To finalise, I need:</b> (1) A or B, (2) Regular or Heavy weight, (3) monogram spacing, (4) slab I or plain I,
  (5) a thumbs-up on the pillar colours. Then I build the full logo, Instagram and guidelines set.</div>
</div>""")

rows = "".join(f"""<div class="card{' pick' if i == 1 else ''}"><h3>{t}{'<span class="tag">My pick</span>' if i == 1 else ''}</h3><p>{n}</p>
<div class="sheet">{s}</div></div>""" for i, (t, n, s) in enumerate(sheets))
P.append(f"""
<h2><span>01</span>Lettering · equal width</h2>
<p class="lede">To make every letter the same width without stretching (which would thicken some strokes and not
others), the letters are redrawn on one width with a constant stroke. Most change subtly: M narrows, E and T widen.
<b>I is the one real decision:</b> a single stem can’t be as wide as an M, so to match it gains top and bottom bars,
the same width as T’s bar. The plain-I option keeps it as a stem in an equal-width cell, so its spacing is still
on the grid but it looks narrower.</p>
<div class="stack">{rows}</div>
<div class="ibox">
 <div class="card pick"><h3>Slab I<span class="tag">My pick</span></h3><p>Truly equal width, and echoes T. The most consistent with “every letter the same width”.</p><div class="sheet">{i_slab}</div></div>
 <div class="card"><h3>Plain I</h3><p>Closer to Michroma, but it reads as a gap in TIME, which is what we’re removing.</p><div class="sheet">{i_plain}</div></div>
</div>""")


def wmcard(lay, title, desc):
    smalls = "".join(
        f"""<figure>{sized(small[(lay, wt)][0], 220)}<figcaption>220px · {name}</figcaption></figure>
<figure>{img(small[(lay, wt)][1], 160, small[(lay, wt)][2], 'px')}<figcaption>160px 1× · {name}</figcaption></figure>"""
        for wt, name in (("reg", "Regular"), ("hvy", "Heavy")))
    return f"""<div class="card"><h3>{title}</h3><p>{desc}</p><div class="stack" style="margin-top:14px">
{wm[(lay, 'white-on-black')]}{wm[(lay, 'black-on-white')]}</div><div class="row">{smalls}</div></div>"""


P.append(f"""
<h2><span>02</span>Wordmark · equal letters, equal gaps</h2>
<p class="lede">MAKETIME / TOMOVE, with every gap 1.4× the cap height and lines 1.225× apart. Turn on the grid to see
that every letter now fills its column exactly. You picked the Wide spacing without choosing A or B, so both are here.</p>
<p><button class="toggle">Show letter grid</button></p>
<div class="grid2">
{wmcard('A', 'A · centred', 'TOMOVE is centred under MAKETIME, column for column. Symmetric, calm and architectural.')}
{wmcard('B', 'B · nested', 'TOMOVE is offset half a step, so each letter sits under a gap. Woven and more distinctive, but off-centre by half a step.')}
</div>""")

mcards = "".join(f"""<div class="card{' pick' if m['id'] == 'even' else ''}"><h3>{m['label']}{'<span class="tag">My pick</span>' if m['id'] == 'even' else ''}</h3><p>{m['note']}</p>
<div class="row"><figure><span class="circle">{sized(m['svg'], 150)}</span><figcaption>Avatar crop</figcaption></figure></div>
<div class="row">
 <figure>{img(m['r32'], 32, 32)}<figcaption>32</figcaption></figure>
 <figure>{img(m['r16'], 16, 16)}<figcaption>16</figcaption></figure>
 <figure>{img(m['c32'], 32, 32)}<figcaption>32 cut</figcaption></figure>
 <figure>{img(m['c16'], 16, 16)}<figcaption>16 cut</figcaption></figure>
 <figure>{img(m['c32'], 32, 32, 'px', 64, 64)}<figcaption>32 cut · 2×</figcaption></figure>
</div></div>""" for m in mono)
P.append(f"""
<h2><span>03</span>Monogram · square grid</h2>
<p class="lede">M T / T M with identical letter widths, so the columns line up exactly. The <b>small cut</b> is a heavier
drawing of the same letters, used only for favicons and app icons at 48px and below. At 16px no four-letter mark stays
readable as letters, but the cut keeps it a crisp, recognisable square.</p>
<div class="grid3">{mcards}</div>""")

tcards = []
for t, primary, p_svg, a_svg, m_svg in themes:
    sw = "".join(f'<div><i style="background:{v}"></i><span>{k}<br>{v}</span></div>'
                 for k, v in (("Dark", t["dark"]), ("Light", t["light"]), ("Grey · secondary", t["grey"])))
    tcards.append(f"""<div class="card{' pick' if t['id'] == 'ink-bone' else ''}"><h3>{t['name']}<span class="theme-tag">{t['role']}</span></h3>
<p>{t['note']}</p><div class="sw">{sw}</div>
<small class="ok">Contrast: lettering {contrast(t['dark'], t['light']):.1f}:1 · grey on its ground {contrast(t['grey'], primary[1]):.1f}:1</small>
<div class="palrow"><div class="stack">{p_svg}{a_svg}</div>
<div><div class="story" style="background:{primary[1]};color:{primary[0]}">
<span class="circle" style="width:60px">{sized(m_svg, 60)}</span>
<div class="q">WHY DO YOU MAKE TIME TO MOVE?</div>
<div class="c" style="color:{t['grey']}">@maketimetomove</div></div></div></div></div>""")
pills = "".join(f"""<figure><div class="pill" style="background:{bg};color:{fg};{'border:1px solid #d9d9d6' if bg == '#EFEBE3' else ''}">{n}</div>
<figcaption>{c}</figcaption></figure>""" for n, bg, fg, c in PILLARS)
P.append(f"""
<h2><span>04</span>Colour system · master + three themes</h2>
<p class="lede">Each theme is still just two colours plus one grey for secondary text, with no gradients or effects.
The logo always appears in a single colour on a single ground. Themes signal a content pillar; they never mix in one
layout. Pure black and white remains the fallback for one-colour reproduction. Story question text here uses live
Michroma for preview only; final templates will be outlined.</p>
<div class="card"><h3>Highlight row · how the pillars sit together</h3><div class="pillars">{pills}</div></div>
<div class="stack" style="margin-top:20px">{''.join(tcards)}</div>""")

P.append("""<footer>Round 3. Earlier rounds: <a href="exploration/round-2.html">round 2</a> ·
<a href="exploration/round-1.html">round 1</a> · <a href="type-exploration.html">type exploration</a>.
All logo artwork is outlined paths. Rebuild with <code>python3 brand/_src/build_round3.py</code>.</footer>""")

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM Brand Preview</title>{FONT_LINK}<style>{CSS}{EXTRA_CSS}</style></head><body><div class="wrap">{''.join(P)}</div>
<script>document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('show-grid')));</script>
</body></html>"""
for k, uri in data.items():
    html = html.replace(f"@@{k}@@", uri)
with open(os.path.join(ROOT, "preview.html"), "w") as fh:
    fh.write(html)
print("ok")
