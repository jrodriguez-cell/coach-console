"""Round 4 (for review): lower, more extended letters; one spacing rule shared by wordmark and monogram.

Spacing rule (letter height H = 100, letter width W):
  gap between letters = W   (one letter width)
  gap between lines   = H   (one letter height)
The monogram M T / T M uses exactly the same two gaps.

Writes brand/exploration/r4-*.svg and brand/preview.html (small-size tests embedded).
"""
import os

from lettering import EqualLettering
from mttm import WordmarkSpec, bbox_of, fmt, svg_doc, wordmark_glyphs
from pagekit import CSS, FONT_LINK, Embedder, aspect, contrast, monogram_svg, sized

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXP = os.path.join(ROOT, "exploration")
EMB = Embedder(os.path.join(EXP, "_r4tmp"))
W_, B_ = "#FFFFFF", "#000000"

RATIOS = [
    (1.36, "Round 3 proportions", "The round 3 letters under the new spacing rule, for reference."),
    (1.7, "Lower", "Letters 1.7× as wide as they are tall. A clear step lower, and still compact."),
    (2.0, "Low · 2 : 1", "Every letter exactly twice as wide as it is tall. The whole mark then runs on one unit: "
                         "letters are 2 units wide and 2 apart, and lines are 1 apart. My pick."),
    (2.4, "Very low", "Ultra-extended. Very elegant at large sizes, but the letters start to read as lines, and the mark "
                      "gets long and small in any square format."),
]
PICK = 2.0
WEIGHTS = [("michroma", "Michroma weight", 12, 11, "Stroke 12% of the letter height, the same as Michroma. My pick."),
           ("fine", "Fine", 9, 8.5, "Stroke 9%. Even more delicate. Beautiful large, but fragile below about 300px wide.")]


def lettering(ratio, stem=12, bar=11, slab_i=True):
    return EqualLettering(width=100 * ratio, stem=stem, bar=bar, slab_i=slab_i)


def spec(L, layout):
    return WordmarkSpec(track=L.W, gap1=0, gap2=0, shift=0.5 if layout == "B" else 0.0, leading=100)


def box_overlay(L, glyphs):
    """Outline each letter's box, so equal widths and equal gaps are visible."""
    out = ['<g class="grid" fill="none" stroke="#9a9a9a" stroke-width="3" stroke-dasharray="10 8">']
    for _, cx, b in glyphs:
        out.append(f'<rect x="{fmt(cx - L.W / 2)}" y="{fmt(b - 100)}" width="{fmt(L.W)}" height="100"/>')
    out.append("</g>")
    return "".join(out)


def wordmark(L, layout, fg=W_, bg=B_, pad=None, overlay=False):
    glyphs, _ = wordmark_glyphs(L, spec(L, layout))
    d = " ".join(L.path(c, x, b) for c, x, b in glyphs)
    pad = 100 if pad is None else pad
    return svg_doc(d, bbox_of(L, glyphs), pad, fg, bg, "Make Time To Move",
                   post=box_overlay(L, glyphs) if overlay else "")


def mono(L, fg=W_, bg=B_):
    return monogram_svg(L, L.W, 100, fg, bg)


def save(name, svg):
    with open(os.path.join(EXP, name), "w") as f:
        f.write(svg)


img = Embedder.img

# ------------------------------------------------------------------ 01 letter height
ratio_cards = []
for r, label, note in RATIOS:
    L = lettering(r)
    a, b = wordmark(L, "A", overlay=True), wordmark(L, "B", overlay=True)
    m = mono(L)
    tag = str(r).replace(".", "")
    save(f"r4-ratio{tag}-a.svg", wordmark(L, "A"))
    save(f"r4-ratio{tag}-b.svg", wordmark(L, "B"))
    save(f"r4-ratio{tag}-monogram.svg", m)
    tight = wordmark(L, "A", pad=40)
    h = round(160 * aspect(tight))
    k = EMB.add(tight, 160, h, f"ratio{tag}-160")
    ratio_cards.append((r, label, note, a, b, m, tight, k, h))

# ------------------------------------------------------------------ 02 pick, A vs B, both tones
P_L = lettering(PICK)
pick = {}
for lay in ("A", "B"):
    for tone, fg, bg in (("white-on-black", W_, B_), ("black-on-white", B_, W_)):
        pick[(lay, tone)] = wordmark(P_L, lay, fg, bg, overlay=True)
        save(f"r4-wordmark-{lay.lower()}-{tone}.svg", wordmark(P_L, lay, fg, bg))

# ------------------------------------------------------------------ 03 weight
weight_cards = []
for wid, label, st, bar, note in WEIGHTS:
    L = lettering(PICK, st, bar)
    big = wordmark(L, "A")
    tight = wordmark(L, "A", pad=40)
    save(f"r4-weight-{wid}.svg", big)
    sizes = []
    for w in (300, 200):
        h = round(w * aspect(tight))
        sizes.append((w, h, EMB.add(tight, w, h, f"w-{wid}-{w}")))
    weight_cards.append((wid, label, note, big, sizes))

# ------------------------------------------------------------------ 04 monogram
CUT = lettering(PICK, 24, 22)
m_main = mono(P_L)
m_cut = mono(CUT)
save("r4-monogram-white-on-black.svg", m_main)
save("r4-monogram-black-on-white.svg", mono(P_L, B_, W_))
save("r4-monogram-smallcut.svg", m_cut)
m_keys = {s: EMB.add(m_main, s, s, f"m-{s}") for s in (180, 64, 32, 16)}
c_keys = {s: EMB.add(m_cut, s, s, f"c-{s}") for s in (64, 32, 16)}
mg_plain = monogram_svg(P_L, P_L.W, 100, ring=False)
# Monogram square with the spacing rule visualised
from mttm import MonogramSpec, monogram_glyphs  # noqa: E402
mg_glyphs, _ = monogram_glyphs(P_L, MonogramSpec(track=P_L.W, leading=100))
mg_rule = svg_doc(" ".join(P_L.path(c, x, b) for c, x, b in mg_glyphs), bbox_of(P_L, mg_glyphs), 100, W_, B_,
                  "MTTM monogram", post=box_overlay(P_L, mg_glyphs))

# ------------------------------------------------------------------ 05 colour themes
THEMES = [
    ("Ink & Bone", "Master · Start Here", "#0E0E0D", "#EFEBE3", "#8F8B83", "dark"),
    ("Ink", "Strength", "#0E0E0D", "#EFEBE3", "#8F8B83", "dark"),
    ("Sage", "Mobility", "#0E0E0D", "#B7C0AE", "#5F665A", "light"),
    ("Midnight", "Mindset", "#121A26", "#E3E7EC", "#87909C", "dark"),
    ("Moss", "Interviews", "#1E2A23", "#E8E6DD", "#8C948D", "dark"),
]
theme_cards = []
for i, (name, role, dark, light, grey, ground) in enumerate(THEMES):
    fg, bg = (light, dark) if ground == "dark" else (dark, light)
    if i == 0:  # Start Here = the bone ground
        fg, bg = dark, light
    theme_cards.append((name, role, fg, bg, grey, wordmark(P_L, "A", fg, bg), mono(P_L, fg, bg)))
    save(f"r4-theme-{name.lower().replace(' & ', '-')}-{role.split(' ')[0].lower()}.svg", wordmark(P_L, "A", fg, bg))

# ------------------------------------------------------------------ HTML
EXTRA = """
.ratio{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 170px;gap:16px;align-items:center;margin-top:14px}
@media (max-width:900px){.ratio{grid-template-columns:1fr}}
.themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:16px}
.tcard{display:grid;grid-template-columns:minmax(0,1fr) 84px;gap:12px;align-items:center}
.rule{font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#fff;border:1px solid var(--line);padding:14px 16px;line-height:1.8}
"""
P = []
P.append("""
<header><h1>Make Time To Move · Brand preview</h1><div class="status">Round 4 · lower letters · one spacing rule</div></header>
<div class="summary">
  <h3>What changed from your feedback</h3>
  <ul>
    <li><b>Lower letters:</b> the letters are less tall relative to their width. Section 01 shows four steps. My pick is <b>2 : 1</b>: every letter is exactly twice as wide as it is tall.</li>
    <li><b>Same height, same width, equal spacing:</b> every letter is the same box, and every gap between letters is exactly <b>one letter width</b>. The two lines are <b>one letter height</b> apart.</li>
    <li><b>The monogram uses the same spacing:</b> M T / T M has exactly those gaps, one letter width across and one letter height between rows.</li>
    <li><b>Thin, like Michroma:</b> the stroke stays at Michroma’s 12% of the letter height. A finer 9% version is in section 03.</li>
  </ul>
  <div class="q"><b>Still open:</b> (1) A centred or B nested. With this rule, B becomes a perfect checkerboard: every letter of TOMOVE sits exactly under a gap. (2) Letter proportion. (3) Weight. Turn on <i>Show letter boxes</i> to see the equal boxes and gaps.</div>
</div>
<div class="rule" style="margin-top:20px">
  SPACING RULE &nbsp;·&nbsp; letter = W × H &nbsp;·&nbsp; gap between letters = W &nbsp;·&nbsp; gap between lines = H &nbsp;·&nbsp; monogram uses the same gaps<br>
  At 2 : 1 &nbsp;→&nbsp; W = 2 units, H = 1 unit: letters 2 wide, 2 apart; lines 1 apart.
</div>""")

rc = []
for r, label, note, a, b, m, tight, k, h in ratio_cards:
    is_pick = r == PICK
    rc.append(f"""<div class="card{' pick' if is_pick else ''}"><h3>{label} · {r} : 1{'<span class="tag">My pick</span>' if is_pick else ''}</h3>
<p>{note}</p>
<div class="ratio"><div><div class="lab">A · centred</div>{a}</div><div><div class="lab">B · nested</div>{b}</div>
<div><div class="lab">Monogram</div><span class="circle">{sized(m, 150)}</span></div></div>
<div class="row"><figure>{sized(tight, 240)}<figcaption>240px</figcaption></figure>
<figure>{img(k, 160, h, 'px')}<figcaption>160px · 1×</figcaption></figure></div></div>""")
P.append(f"""
<h2><span>01</span>Letter height</h2>
<p class="lede">Each step keeps the letter width and makes the letters lower. Every version follows the same rule:
equal boxes, gaps one letter width, lines one letter height apart, and the same for the monogram.</p>
<p><button class="toggle">Show letter boxes</button></p>
<div class="stack">{''.join(rc)}</div>""")


def pcard(lay, title, desc):
    return f"""<div class="card"><h3>{title}</h3><p>{desc}</p><div class="stack" style="margin-top:14px">
{pick[(lay, 'white-on-black')]}{pick[(lay, 'black-on-white')]}</div></div>"""


P.append(f"""
<h2><span>02</span>2 : 1 · A vs B</h2>
<p class="lede">The pick from 01, large and in both tones.</p>
<p><button class="toggle">Show letter boxes</button></p>
<div class="grid2">
{pcard('A', 'A · centred', 'TOMOVE sits on the same columns as MAKETIME, centred. Calm, symmetric and architectural.')}
{pcard('B', 'B · nested / checkerboard', 'TOMOVE shifts by one letter width, so every letter sits exactly under a gap. It forms a perfect checkerboard, but sits off-centre.')}
</div>""")

wc = []
for wid, label, note, big, sizes in weight_cards:
    is_pick = wid == "michroma"
    smalls = "".join(f'<figure>{img(k, w, h, "px")}<figcaption>{w}px · 1×</figcaption></figure>' for w, h, k in sizes)
    wc.append(f"""<div class="card{' pick' if is_pick else ''}"><h3>{label}{'<span class="tag">My pick</span>' if is_pick else ''}</h3><p>{note}</p>
<div style="margin-top:12px">{big}</div><div class="row">{smalls}</div></div>""")
P.append(f"""
<h2><span>03</span>Weight · thin, like Michroma</h2>
<p class="lede">Both weights are drawn for 2 : 1 letters. The small tests are true 1× pixels.</p>
<div class="grid2">{''.join(wc)}</div>""")

P.append(f"""
<h2><span>04</span>Monogram · same spacing</h2>
<p class="lede">M T / T M with the wordmark’s exact gaps: one letter width between columns and one letter height
between rows. Like the wordmark, it is wide rather than square, so it sits as a band across the circle. That is the
honest cost of matching the spacing exactly. Thin strokes go soft at 32px, so the <b>small cut</b> (heavier strokes,
same letters and spacing) takes over at 64px and below. At 16px, use the small cut and treat it as a texture.</p>
<p><button class="toggle">Show letter boxes</button></p>
<div class="grid2">
 <div class="card pick"><h3>Spacing rule</h3><p>The same boxes and gaps as the wordmark.</p><div style="margin-top:12px">{mg_rule}</div></div>
 <div class="card"><h3>Avatar and small sizes</h3>
  <div class="row"><figure><span class="circle">{img(m_keys[180], 180, 180)}</span><figcaption>Avatar crop</figcaption></figure>
  <figure><span class="circle" style="box-shadow:0 0 0 1px #d9d9d6">{sized(mono(P_L, B_, W_), 120)}</span><figcaption>Inverse</figcaption></figure></div>
  <div class="row">
   <figure>{img(m_keys[64], 64, 64)}<figcaption>64</figcaption></figure>
   <figure>{img(m_keys[32], 32, 32)}<figcaption>32</figcaption></figure>
   <figure>{img(m_keys[16], 16, 16)}<figcaption>16</figcaption></figure>
   <figure>{img(c_keys[64], 64, 64)}<figcaption>64 cut</figcaption></figure>
   <figure>{img(c_keys[32], 32, 32)}<figcaption>32 cut</figcaption></figure>
   <figure>{img(c_keys[16], 16, 16)}<figcaption>16 cut</figcaption></figure>
   <figure>{img(c_keys[32], 32, 32, 'px', 96, 96)}<figcaption>32 cut · 3×</figcaption></figure>
  </div></div>
</div>""")

tc = "".join(f"""<div class="card"><h3>{n}<span class="theme-tag" style="font-size:10px;letter-spacing:.2em;color:var(--mute);margin-left:10px">{role}</span></h3>
<small class="ok">{fg} on {bg} · {contrast(fg, bg):.1f}:1 · grey {grey}</small>
<div class="tcard" style="margin-top:10px">{wm}<span class="circle">{sized(m, 84)}</span></div></div>"""
             for n, role, fg, bg, grey, wm, m in theme_cards)
P.append(f"""
<h2><span>05</span>Colour themes · applied</h2>
<p class="lede">The four themes you chose, unchanged from round 3, now carrying the 2 : 1 wordmark and monogram.
Ink &amp; Bone is the master. Each theme is still two colours plus one grey for secondary text.</p>
<div class="themes">{tc}</div>""")

P.append("""<footer>Round 4. Earlier rounds: <a href="exploration/round-3.html">round 3</a> ·
<a href="exploration/round-2.html">round 2</a> · <a href="exploration/round-1.html">round 1</a> ·
<a href="type-exploration.html">type exploration</a>. All logo artwork is outlined paths.
Rebuild with <code>python3 brand/_src/build_round4.py</code>.</footer>""")

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM Brand Preview</title>{FONT_LINK}<style>{CSS}{EXTRA}</style></head><body><div class="wrap">{''.join(P)}</div>
<script>document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('show-grid')));</script>
</body></html>"""
html = EMB.run_and_fill(html)
with open(os.path.join(ROOT, "preview.html"), "w") as fh:
    fh.write(html)
print("ok")
