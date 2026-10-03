"""Round 5 (for review): layout A only; circular O, plain I, simple K, narrower letters.

Spacing rule (letter height H = 100, letter width W), unchanged from round 4:
  gap between letters = W, gap between lines = H, monogram uses the same gaps.
At 1 : 1 that becomes one uniform unit in both directions.

Writes brand/exploration/r5-*.svg and brand/preview.html (small-size tests embedded).
"""
import os

from lettering import EqualLettering
from mttm import MonogramSpec, WordmarkSpec, bbox_of, fmt, monogram_glyphs, svg_doc, wordmark_glyphs
from pagekit import CSS, FONT_LINK, Embedder, aspect, contrast, monogram_svg, sized

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXP = os.path.join(ROOT, "exploration")
EMB = Embedder(os.path.join(EXP, "_r5tmp"))
img = Embedder.img
W_, B_ = "#FFFFFF", "#000000"
STEM, BAR = 12, 11  # Michroma weight: 12% of letter height

RATIOS = [
    (1.0, "Square · 1 : 1", "Every letter fits a square, so the O is a perfect circle. The spacing becomes one unit in "
                            "both directions, and the monogram becomes a perfect square. My pick."),
    (1.15, "Slightly wide · 1.15 : 1", "A touch of width keeps a hint of the extended look. The O becomes a soft, "
                                       "slightly wide ellipse."),
    (1.3, "Wide · 1.3 : 1", "Closer to round 3’s proportions. The O is visibly oval again."),
]
PICK = 1.0


def new(ratio, stem=STEM, bar=BAR):
    return EqualLettering(width=100 * ratio, stem=stem, bar=bar, slab_i=False, o_style="ellipse", k_style="simple")


def old_r4():
    return EqualLettering(width=200, stem=STEM, bar=BAR)


def spec(L):
    return WordmarkSpec(track=L.W, gap1=0, gap2=0, shift=0.0, leading=100)


def box_overlay(L, glyphs):
    out = ['<g class="grid" fill="none" stroke="#9a9a9a" stroke-width="3" stroke-dasharray="10 8">']
    for _, cx, b in glyphs:
        out.append(f'<rect x="{fmt(cx - L.W / 2)}" y="{fmt(b - 100)}" width="{fmt(L.W)}" height="100"/>')
    out.append("</g>")
    return "".join(out)


def wordmark(L, fg=W_, bg=B_, pad=None, overlay=False):
    glyphs, _ = wordmark_glyphs(L, spec(L))
    d = " ".join(L.path(c, x, b) for c, x, b in glyphs)
    return svg_doc(d, bbox_of(L, glyphs), 100 if pad is None else pad, fg, bg, "Make Time To Move",
                   post=box_overlay(L, glyphs) if overlay else "")


def mono(L, fg=W_, bg=B_):
    return monogram_svg(L, L.W, 100, fg, bg)


def save(name, svg):
    with open(os.path.join(EXP, name), "w") as f:
        f.write(svg)


def letters(L, chars, fg=W_, bg=B_):
    g = [(c, i * (L.W + 60), 100) for i, c in enumerate(chars)]
    return svg_doc(" ".join(L.path(c, x, b) for c, x, b in g), bbox_of(L, g), 40, fg, bg, chars)


# ------------------------------------------------------------------ 01 letter changes
P_L = new(PICK)
changes = [
    ("O", "Circular", "A true circle instead of Michroma’s rounded square."),
    ("I", "Plain", "Back to a single stroke. It still sits in a box the same width as every other letter, so the spacing stays exact."),
    ("K", "Simpler", "Two straight diagonals meeting the stem at mid-height. No stub."),
]
change_cards = [(ch, t, n, letters(old_r4(), ch), letters(P_L, ch)) for ch, t, n in changes]
alpha_old, alpha_new = letters(old_r4(), "MAKETIOV"), letters(P_L, "MAKETIOV")
save("r5-letters.svg", alpha_new)

# ------------------------------------------------------------------ 02 proportions
ratio_cards = []
for r, label, note in RATIOS:
    L = new(r)
    tag = str(r).replace(".", "")
    wm, m = wordmark(L, overlay=True), mono(L)
    save(f"r5-ratio{tag}-wordmark.svg", wordmark(L))
    save(f"r5-ratio{tag}-monogram.svg", m)
    tight = wordmark(L, pad=40)
    h = round(160 * aspect(tight))
    ratio_cards.append((r, label, note, wm, m, tight, EMB.add(tight, 160, h, f"ratio{tag}-160"), h))
ref_r4 = wordmark(old_r4())

# ------------------------------------------------------------------ 03 pick, both tones
pick_wob = wordmark(P_L, overlay=True)
pick_bow = wordmark(P_L, B_, W_, overlay=True)
save("r5-wordmark-white-on-black.svg", wordmark(P_L))
save("r5-wordmark-black-on-white.svg", wordmark(P_L, B_, W_))
tight = wordmark(P_L, pad=40)
pick_small = []
for w in (240, 160, 120):
    h = round(w * aspect(tight))
    pick_small.append((w, h, EMB.add(tight, w, h, f"pick-{w}")))

# ------------------------------------------------------------------ 04 monogram
CUT = new(PICK, 22, 20)
m_main, m_cut = mono(P_L), mono(CUT)
save("r5-monogram-white-on-black.svg", m_main)
save("r5-monogram-black-on-white.svg", mono(P_L, B_, W_))
save("r5-monogram-smallcut.svg", m_cut)
m_keys = {s: EMB.add(m_main, s, s, f"m-{s}") for s in (180, 64, 32, 16)}
c_keys = {s: EMB.add(m_cut, s, s, f"c-{s}") for s in (64, 32, 16)}
mg, _ = monogram_glyphs(P_L, MonogramSpec(track=P_L.W, leading=100))
mg_rule = svg_doc(" ".join(P_L.path(c, x, b) for c, x, b in mg), bbox_of(P_L, mg), 100, W_, B_, "MTTM monogram",
                  post=box_overlay(P_L, mg))

# ------------------------------------------------------------------ 05 themes
THEMES = [
    ("Ink & Bone", "Master · Start Here", "#0E0E0D", "#EFEBE3", "#8F8B83"),
    ("Ink", "Strength", "#EFEBE3", "#0E0E0D", "#8F8B83"),
    ("Sage", "Mobility", "#0E0E0D", "#B7C0AE", "#5F665A"),
    ("Midnight", "Mindset", "#E3E7EC", "#121A26", "#87909C"),
    ("Moss", "Interviews", "#E8E6DD", "#1E2A23", "#8C948D"),
]  # name, role, lettering, ground, grey
themes = []
for name, role, fg, bg, grey in THEMES:
    slug = name.lower().replace(" & ", "-")
    save(f"r5-theme-{slug}-wordmark.svg", wordmark(P_L, fg, bg))
    themes.append((name, role, fg, bg, grey, wordmark(P_L, fg, bg), mono(P_L, fg, bg)))

# ------------------------------------------------------------------ HTML
EXTRA = """
.ratio{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:20px;align-items:center;margin-top:14px}
@media (max-width:760px){.ratio{grid-template-columns:1fr}}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:16px}
.tcard{display:grid;grid-template-columns:minmax(0,1fr) 84px;gap:12px;align-items:center}
.rule{font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#fff;border:1px solid var(--line);padding:14px 16px;line-height:1.8}
.theme-tag{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin-left:10px}
"""
P = ["""
<header><h1>Make Time To Move · Brand preview</h1><div class="status">Round 5 · centred · circular O · plain I · simple K</div></header>
<div class="summary">
  <h3>What changed from your feedback</h3>
  <ul>
    <li><b>Layout A, centred</b> is now the only layout.</li>
    <li><b>O is circular:</b> a true circle (or ellipse) instead of a rounded rectangle.</li>
    <li><b>I is plain:</b> a single stroke with no top or bottom bars.</li>
    <li><b>K is simpler:</b> two straight diagonals meeting the stem, with no stub.</li>
    <li><b>Letters are less wide:</b> because every letter shares one width, the O can only be a true circle when the letters
      are square. So my pick is <b>1 : 1</b>. Two slightly wider steps are shown too.</li>
    <li><b>Unchanged:</b> thin Michroma-weight strokes, equal letter widths and heights, and the spacing rule: a gap of one
      letter width between letters and one letter height between lines, with the monogram on the same gaps. At 1 : 1 the gaps are the same in both directions, so the monogram is a perfect square.</li>
  </ul>
  <div class="q"><b>Last check:</b> pick a proportion (1 : 1, 1.15 or 1.3). If it looks right, I’ll build the full set
  next: final logos, PNG exports, Instagram avatar, highlights, interview and Reel templates, and the guidelines.</div>
</div>
<div class="rule" style="margin-top:20px">SPACING RULE · letter = W × H · gap between letters = W · gap between lines = H · monogram uses the same gaps<br>
At 1 : 1 → one unit everywhere: letters 1 × 1, 1 apart, lines 1 apart.</div>"""]

cc = "".join(f"""<div class="card"><h3>{ch} · {t}</h3><p>{n}</p>
<div class="cmp"><figure style="margin:0">{o}<figcaption>Round 4</figcaption></figure><figure style="margin:0">{nw}<figcaption>Round 5</figcaption></figure></div></div>"""
             for ch, t, n, o, nw in change_cards)
P.append(f"""
<h2><span>01</span>Letter changes</h2>
<p class="lede">The full letter set before and after, then the three letters you asked about, side by side.</p>
<div class="stack"><div class="card"><h3>Round 4</h3><div style="margin-top:10px">{alpha_old}</div></div>
<div class="card pick"><h3>Round 5 · 1 : 1</h3><div style="margin-top:10px">{alpha_new}</div></div></div>
<div class="grid3" style="margin-top:20px">{cc}</div>""")

rc = []
for r, label, note, wm, m, tight_svg, k, h in ratio_cards:
    pk = r == PICK
    rc.append(f"""<div class="card{' pick' if pk else ''}"><h3>{label}{'<span class="tag">My pick</span>' if pk else ''}</h3><p>{note}</p>
<div class="ratio"><div>{wm}</div><div><span class="circle">{sized(m, 150)}</span></div></div>
<div class="row"><figure>{sized(tight_svg, 240)}<figcaption>240px</figcaption></figure>
<figure>{img(k, 160, h, 'px')}<figcaption>160px · 1×</figcaption></figure></div></div>""")
P.append(f"""
<h2><span>02</span>Letter width</h2>
<p class="lede">Narrower letters with the same spacing rule. Turn on the letter boxes to check that every letter has the
same box and every gap is exactly one box wide.</p>
<p><button class="toggle">Show letter boxes</button></p>
<div class="stack">{''.join(rc)}
<div class="card"><h3>Round 4 reference · 2 : 1</h3><div style="margin-top:12px">{ref_r4}</div></div></div>""")

smalls = "".join(f'<figure>{img(k, w, h, "px")}<figcaption>{w}px · 1×</figcaption></figure>' for w, h, k in pick_small)
P.append(f"""
<h2><span>03</span>Wordmark · 1 : 1, centred</h2>
<p class="lede">The pick, large and in both tones, with true 1× small-size tests.</p>
<p><button class="toggle">Show letter boxes</button></p>
<div class="stack"><div class="card pick">{pick_wob}<div style="margin-top:12px">{pick_bow}</div>
<div class="row">{smalls}</div></div></div>""")

P.append(f"""
<h2><span>04</span>Monogram · same spacing, now square</h2>
<p class="lede">M T / T M on the wordmark’s exact gaps. At 1 : 1 this makes a perfect square: three units by three
units. It fills the avatar circle far better than round 4’s wide band. The <b>small cut</b> (heavier strokes, same
letters and spacing) is for 64px and below.</p>
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

tc = "".join(f"""<div class="card"><h3>{n}<span class="theme-tag">{role}</span></h3>
<small class="ok">{fg} on {bg} · {contrast(fg, bg):.1f}:1 · grey {grey}</small>
<div class="tcard" style="margin-top:10px">{wm}<span class="circle">{sized(m, 84)}</span></div></div>"""
             for n, role, fg, bg, grey, wm, m in themes)
P.append(f"""
<h2><span>05</span>Colour themes · applied</h2>
<p class="lede">Your four themes, unchanged, carrying the new wordmark and monogram. Ink &amp; Bone is the master.</p>
<div class="themes">{tc}</div>""")

P.append("""<footer>Round 5. Earlier rounds: <a href="exploration/round-4.html">4</a> · <a href="exploration/round-3.html">3</a> ·
<a href="exploration/round-2.html">2</a> · <a href="exploration/round-1.html">1</a> · <a href="type-exploration.html">type exploration</a>.
All logo artwork is outlined paths. Rebuild with <code>python3 brand/_src/build_round5.py</code>.</footer>""")

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM Brand Preview</title>{FONT_LINK}<style>{CSS}{EXTRA}</style></head><body><div class="wrap">{''.join(P)}</div>
<script>document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('show-grid')));</script>
</body></html>"""
html = EMB.run_and_fill(html)
html = html.replace('href="exploration/', 'href="').replace('href="type-exploration.html"', 'href="../type-exploration.html"')
with open(os.path.join(EXP, "round-5.html"), "w") as fh:
    fh.write(html)
print("ok")
