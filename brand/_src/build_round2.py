"""Round 2 (for review): Michroma, no word gap, wider tracking; monogram study; colour schemes.

Writes brand/exploration/r2-*.svg|png and brand/preview.html.
"""
import json
import math
import os
import subprocess

from mttm import Font, MonogramSpec, WordmarkSpec, bbox_of, fmt, monogram_glyphs, wordmark_svg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXP = os.path.join(ROOT, "exploration")
os.makedirs(EXP, exist_ok=True)

FONT = Font("michroma")
W, B = "#FFFFFF", "#000000"

# Tracking = space added to the widest letter (M) to make one grid step, in cap-height units (H = 100).
TRACKS = [
    (55, "Round 1 reference", "The spacing from round 1, shown for comparison."),
    (100, "Open", "Letter gap is about 1× the cap height. Noticeably airier than round 1 and still reads as words."),
    (140, "Wide", "Letter gap is about 1.4× the cap height. The tracking becomes the signature of the mark while the letters still hold together as words. My pick."),
    (180, "Extra wide", "Letter gap is about 1.8× the cap height. Very airy and editorial, but Michroma’s thin strokes start to read as separate marks, and the mark gets very long."),
]
PICK_TRACK = 140


def leading_for(track):
    # Wider tracking needs more line space, or letters start pairing into vertical columns.
    return 80 + 0.5 * (track - 55)


def spec(track, layout):
    return WordmarkSpec(track=track, gap1=0, gap2=0, shift=0.5 if layout == "B" else 0.0,
                        leading=leading_for(track))


PALETTES = [
    dict(id="mono", name="Mono", dark="#000000", light="#FFFFFF", grey="#8A8A8A",
         note="The baseline: pure black and white at maximum contrast. Nothing to manage, and always correct."),
    dict(id="ink-bone", name="Ink & Bone", dark="#0E0E0D", light="#EFEBE3", grey="#8F8B83",
         note="A near-black ink with a warm, paper-like off-white. It reads like a printed object, softer and more "
              "premium than pure white on screen. The lowest-risk upgrade from Mono."),
    dict(id="moss", name="Moss", dark="#1E2A23", light="#E8E6DD", grey="#8C948D",
         note="A deep green that looks almost black at a glance and shows its colour on a large field. It quietly "
              "signals healthy living and the outdoors."),
    dict(id="midnight", name="Midnight", dark="#121A26", light="#E3E7EC", grey="#87909C",
         note="A blue-black with a cool mist white. Focused and calm, with a clinical-premium feel. It suits the "
              "mindset and interview content."),
    dict(id="sage", name="Sage", dark="#0E0E0D", light="#B7C0AE", grey="#6E7568",
         note="Ink paired with a muted sage instead of white. Restorative and recovery-minded. The softest of the "
              "five; it works best as a secondary or pillar colour rather than the master."),
]


# ---------------------------------------------------------------- helpers
def lum(hexc):
    c = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def save(name, svg):
    with open(os.path.join(EXP, name), "w") as f:
        f.write(svg)
    return f"exploration/{name}"


def sized(svg, width):
    return svg.replace("<svg ", f'<svg width="{width}" ', 1)


def aspect(svg):
    vb = svg.split('viewBox="')[1].split('"')[0].split()
    return float(vb[3]) / float(vb[2])


jobs = []


def png_1x(rel, w, h, name):
    jobs.append({"src": os.path.join(ROOT, rel), "out": os.path.join(EXP, name), "width": w, "height": h})
    return f"exploration/{name}"


def monogram_svg(track, fg=W, bg=B, circle=True, boost=0.0):
    """M T / T M on the wordmark grid logic, centred so the block's diagonal sits
    inside 82% of a circle's diameter (survives the Instagram crop)."""
    ms = MonogramSpec(track=track, leading=leading_for(track))
    g, _ = monogram_glyphs(FONT, ms)
    x0, y0, x1, y1 = bbox_of(FONT, g)
    side = math.hypot(x1 - x0 + boost, y1 - y0 + boost) / 0.82
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vx, vy = cx - side / 2, cy - side / 2
    d = " ".join(FONT.path(c, x, b) for c, x, b in g)
    ground = (f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(side / 2)}" fill="{bg}"/>' if circle else
              f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(side)}" height="{fmt(side)}" fill="{bg}"/>')
    stroke = (f' stroke="{fg}" stroke-width="{fmt(boost)}" stroke-linejoin="miter"' if boost else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(side)} {fmt(side)}" '
            f'role="img" aria-label="MTTM monogram"><title>MTTM monogram</title>{ground}'
            f'<path fill="{fg}"{stroke} d="{d}"/></svg>')


# ---------------------------------------------------------------- 01 tracking study
track_rows = []
for tr, label, note in TRACKS:
    cells = []
    for lay in ("A", "B"):
        sp = spec(tr, lay)
        big = wordmark_svg(FONT, sp, W, B, overlay=True)
        tight = wordmark_svg(FONT, sp, W, B, pad=40)
        rel = save(f"r2-track{tr}-{lay.lower()}-tight.svg", tight)
        save(f"r2-track{tr}-{lay.lower()}-white-on-black.svg", wordmark_svg(FONT, sp, W, B))
        h = round(160 * aspect(tight))
        p160 = png_1x(rel, 160, h, f"r2-track{tr}-{lay.lower()}-160px-1x.png")
        cells.append((lay, big, tight, p160, h))
    track_rows.append((tr, label, note, cells))

# ---------------------------------------------------------------- 02 recommended lock-up both tones
lockups = {}
for lay in ("A", "B"):
    sp = spec(PICK_TRACK, lay)
    for tone, fg, bg in (("white-on-black", W, B), ("black-on-white", B, W)):
        svg = wordmark_svg(FONT, sp, fg, bg, overlay=True)
        lockups[(lay, tone)] = svg
        save(f"r2-wordmark-{lay.lower()}-{tone}.svg", wordmark_svg(FONT, sp, fg, bg))

# ---------------------------------------------------------------- 03 monogram study
MONO_TRACKS = [
    (PICK_TRACK, "Same tracking as the wordmark", "A strict match to the wordmark. Very open, so the letters get small inside the circle."),
    (80, "Medium", "The same grid logic with the spacing reduced. A balanced square block."),
    (40, "Tight", "Largest letters for the crop. Reads as a compact seal."),
]
BOOST = 9  # extra stroke for the small-size cut (~ +75% stem weight on Michroma's 12-unit stem)
mono_rows = []
for tr, label, note in MONO_TRACKS:
    svg = monogram_svg(tr)
    rel = save(f"r2-monogram-track{tr}-circle.svg", svg)
    svgb = monogram_svg(tr, boost=BOOST)
    relb = save(f"r2-monogram-track{tr}-circle-smallcut.svg", svgb)
    r = dict(tr=tr, label=label, note=note, svg=svg,
             p32=png_1x(rel, 32, 32, f"r2-monogram-track{tr}-32px-1x.png"),
             p16=png_1x(rel, 16, 16, f"r2-monogram-track{tr}-16px-1x.png"),
             b32=png_1x(relb, 32, 32, f"r2-monogram-track{tr}-smallcut-32px-1x.png"),
             b16=png_1x(relb, 16, 16, f"r2-monogram-track{tr}-smallcut-16px-1x.png"))
    mono_rows.append(r)

# ---------------------------------------------------------------- 04 colour schemes
pal_cards = []
for p in PALETTES:
    sp = spec(PICK_TRACK, "A")
    prim = wordmark_svg(FONT, sp, p["light"], p["dark"])
    inv = wordmark_svg(FONT, sp, p["dark"], p["light"])
    save(f"r2-palette-{p['id']}-wordmark-primary.svg", prim)
    save(f"r2-palette-{p['id']}-wordmark-inverted.svg", inv)
    mono = monogram_svg(80, p["light"], p["dark"])
    pal_cards.append((p, prim, inv, mono, contrast(p["light"], p["dark"]), contrast(p["grey"], p["dark"]),
                      contrast(p["grey"], p["light"])))

jf = os.path.join(EXP, "_jobs.json")
with open(jf, "w") as fh:
    json.dump(jobs, fh)
subprocess.run(["node", os.path.join(os.path.dirname(__file__), "render.mjs"), jf], check=True)
os.remove(jf)

# ---------------------------------------------------------------- HTML
CSS = """
:root{--bg:#f3f3f1;--ink:#0a0a0a;--mute:#6b6b6b;--line:#d9d9d6;--card:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:48px 16px 96px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:1px solid var(--ink);padding-bottom:20px;margin-bottom:40px;flex-wrap:wrap}
h1{font-size:13px;letter-spacing:.32em;font-weight:600;margin:0;text-transform:uppercase}
.status{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
h2{font-size:12px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;margin:64px 0 6px}
h2 span{color:var(--mute);margin-right:14px}
.lede{color:var(--mute);max-width:780px;margin:0 0 24px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:20px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--line);padding:20px;min-width:0}
.card h3{font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 4px;font-weight:600}
.card p{margin:6px 0 0;color:var(--mute);font-size:14px}
.card.pick{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.tag{display:inline-block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;border:1px solid var(--ink);padding:2px 8px;margin-left:8px;vertical-align:2px}
svg{display:block;max-width:100%;height:auto}
.stack>*+*{margin-top:12px}
.row{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;margin-top:14px}
.row figure{margin:0}
figcaption{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-top:6px}
.px{image-rendering:pixelated}
.grid{display:none}
body.show-grid .grid{display:inline}
.toggle{font:inherit;font-size:12px;letter-spacing:.16em;text-transform:uppercase;background:none;border:1px solid var(--ink);color:var(--ink);padding:8px 14px;cursor:pointer}
body.show-grid .toggle{background:var(--ink);color:#fff}
.summary{background:var(--ink);color:#fff;padding:28px}
.summary h3{font-size:12px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 12px}
.summary ul{margin:0;padding-left:18px}.summary li{margin:6px 0}
.summary .q{margin-top:18px;border-top:1px solid #333;padding-top:16px}
.trow{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:20px;margin-top:14px}
.lab{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin-bottom:8px}
.circle{border-radius:50%;overflow:hidden;display:inline-block;line-height:0}
.sw{display:flex;gap:8px;margin:12px 0 4px;flex-wrap:wrap}
.sw div{flex:1;min-width:90px;border:1px solid var(--line);font-size:11px;letter-spacing:.08em}
.sw i{display:block;height:44px}
.sw span{display:block;padding:6px 8px;text-transform:uppercase}
.palrow{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:16px;align-items:start;margin-top:14px}
@media (max-width:640px){.palrow{grid-template-columns:1fr}}
.story{aspect-ratio:9/16;width:150px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:18px 12px;text-align:center}
.story .q{font-family:"Michroma",sans-serif;font-size:10.5px;line-height:1.7;letter-spacing:.22em}
.story .c{font-size:8px;letter-spacing:.24em;text-transform:uppercase}
.pillars{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px}
.pillars figure{margin:0;text-align:center}
.pill{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:"Michroma",sans-serif;font-size:9px;letter-spacing:.24em}
small.ok{color:var(--mute)}
footer{margin-top:72px;font-size:12px;color:var(--mute);border-top:1px solid var(--line);padding-top:16px}
code{font-size:13px}
"""
FONT_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Michroma&display=swap" rel="stylesheet">')

parts = []
parts.append("""
<header><h1>Make Time To Move · Brand preview</h1><div class="status">Round 2 · Michroma · no word gap · wider tracking</div></header>
<div class="summary">
  <h3>What changed from your feedback</h3>
  <ul>
    <li><b>Typeface:</b> Michroma, outlined to paths.</li>
    <li><b>Word break:</b> no word gap. Both lines are one continuous run of letters, and the line break does the separating.</li>
    <li><b>Letter spacing:</b> opened up. Section 01 shows four steps. My pick is <b>Wide</b>, a letter gap of about 1.4× the cap height. Line spacing grows with the tracking, so the mark still reads in rows rather than columns.</li>
    <li><b>“Option 2”:</b> I wasn’t sure whether you meant the centred no-gap version (A) or the second no-gap card, the nested one (B). Both are shown side by side at every spacing.</li>
    <li><b>Colour:</b> five schemes that keep the approved format: light lettering on a dark ground as primary, dark on light as the inverse, grey only for secondary text. None of them uses the retired colours.</li>
  </ul>
  <div class="q"><b>Your call:</b> (1) A or B, (2) which spacing, (3) which monogram spacing, (4) Mono or one of the colour schemes. After that I build the full asset set.</div>
</div>""")

# 01
rows = []
for tr, label, note, cells in track_rows:
    pick = tr == PICK_TRACK
    inner = []
    for lay, big, tight, p160, h in cells:
        inner.append(f"""<div><div class="lab">{'A · centred' if lay == 'A' else 'B · nested (offset ½ step)'}</div>{big}
  <div class="row"><figure>{sized(tight, 220)}<figcaption>220px</figcaption></figure>
  <figure><img class="px" src="{p160}" width="160" height="{h}" alt=""><figcaption>160px · 1×</figcaption></figure></div></div>""")
    rows.append(f"""<div class="card{' pick' if pick else ''}"><h3>{label} · tracking {tr}{'<span class="tag">My pick</span>' if pick else ''}</h3>
<p>{note}</p><div class="trow">{''.join(inner)}</div></div>""")
parts.append(f"""
<h2><span>01</span>Tracking study · Michroma · no word gap</h2>
<p class="lede">Every letter is centred in a cell of identical width. The tracking number is the space added to the
widest letter (M), with cap height = 100. Small-size images are true 1× pixels at 160px wide, which is harsher than any
phone screen.</p>
<p><button class="toggle">Show letter grid</button></p>
<div class="stack">{''.join(rows)}</div>""")

# 02
def lockcard(lay, title, desc):
    return f"""<div class="card"><h3>{title}</h3><p>{desc}</p><div class="stack" style="margin-top:14px">
{lockups[(lay, 'white-on-black')]}{lockups[(lay, 'black-on-white')]}</div></div>"""


parts.append(f"""
<h2><span>02</span>Wide tracking · A vs B</h2>
<p class="lede">The pick from 01, large and in both tones, for the layout decision. With no word gap, B’s nest only
works if line 2 sits half a step right of centre, which is the visible stagger. A is symmetric and quieter. B is more
woven and more distinctive. Both are valid; this one is a matter of taste.</p>
<p><button class="toggle">Show letter grid</button></p>
<div class="grid2">
{lockcard('A', 'A · centred', 'Line 2 sits on the same columns as line 1, perfectly centred. Calm and architectural.')}
{lockcard('B', 'B · nested', 'Each letter of TOMOVE drops into a gap in MAKETIME. Reads as an interlocking weave, at the cost of symmetry.')}
</div>""")

# 03
mcards = []
for r in mono_rows:
    pick = r["tr"] == 80
    mcards.append(f"""<div class="card{' pick' if pick else ''}"><h3>{r['label']}{'<span class="tag">My pick</span>' if pick else ''}</h3><p>{r['note']}</p>
<div class="row"><figure><span class="circle">{sized(r['svg'], 150)}</span><figcaption>Avatar crop</figcaption></figure></div>
<div class="row">
 <figure><img src="{r['p32']}" width="32" height="32" alt=""><figcaption>32</figcaption></figure>
 <figure><img src="{r['p16']}" width="16" height="16" alt=""><figcaption>16</figcaption></figure>
 <figure><img class="px" src="{r['p32']}" width="64" height="64" alt=""><figcaption>32 · 2×</figcaption></figure>
 <figure><img src="{r['b32']}" width="32" height="32" alt=""><figcaption>32 small cut</figcaption></figure>
 <figure><img src="{r['b16']}" width="16" height="16" alt=""><figcaption>16 small cut</figcaption></figure>
 <figure><img class="px" src="{r['b32']}" width="64" height="64" alt=""><figcaption>32 cut · 2×</figcaption></figure>
</div></div>""")
parts.append(f"""
<h2><span>03</span>Monogram · M T / T M in Michroma</h2>
<p class="lede">The same letterforms and cell logic as the wordmark, at three spacings, centred to survive the circular
crop. Michroma’s stem is only 12% of the cap height, so at 32px and 16px it fades. The <b>small cut</b> is a
heavier version (stroke +75%), used only at favicon sizes and never above 64px. At 16px, even the small cut is a
texture rather than readable letters. That is a limit of any four-letter mark at that size, and the small cut at 32px
is the realistic floor.</p>
<div class="grid3">{''.join(mcards)}</div>""")

# 04
pcards = []
for p, prim, inv, mono, c_main, c_gd, c_gl in pal_cards:
    pick = p["id"] in ("ink-bone",)
    sw = "".join(f'<div><i style="background:{v}"></i><span>{k}<br>{v}</span></div>'
                 for k, v in (("Dark", p["dark"]), ("Light", p["light"]), ("Grey · secondary", p["grey"])))
    pcards.append(f"""<div class="card{' pick' if pick else ''}"><h3>{p['name']}{'<span class="tag">My pick</span>' if pick else ''}</h3>
<p>{p['note']}</p><div class="sw">{sw}</div>
<small class="ok">Contrast: lettering {c_main:.1f}:1 · grey on dark {c_gd:.1f}:1 · grey on light {c_gl:.1f}:1</small>
<div class="palrow"><div class="stack">{prim}{inv}</div>
<div><div class="story" style="background:{p['dark']};color:{p['light']}">
<span class="circle" style="width:56px">{sized(mono, 56)}</span>
<div class="q">WHY DO YOU MAKE TIME TO MOVE?</div>
<div class="c" style="color:{p['grey']}">@maketimetomove</div></div></div></div></div>""")

pillar = f"""<div class="card"><h3>Optional · one pillar per scheme</h3>
<p>If you want a little colour without diluting the master, keep Mono or Ink &amp; Bone as the brand and give each content
pillar one of the quiet grounds. It’s easy to recognise in the highlight row and still feels like one family.</p>
<div class="pillars">
 <figure><div class="pill" style="background:#0E0E0D;color:#EFEBE3">STRENGTH</div><figcaption>Ink</figcaption></figure>
 <figure><div class="pill" style="background:#B7C0AE;color:#0E0E0D">MOBILITY</div><figcaption>Sage</figcaption></figure>
 <figure><div class="pill" style="background:#121A26;color:#E3E7EC">MINDSET</div><figcaption>Midnight</figcaption></figure>
 <figure><div class="pill" style="background:#1E2A23;color:#E8E6DD">INTERVIEWS</div><figcaption>Moss</figcaption></figure>
 <figure><div class="pill" style="background:#EFEBE3;color:#0E0E0D;border:1px solid #d9d9d6">START HERE</div><figcaption>Bone</figcaption></figure>
</div></div>"""

parts.append(f"""
<h2><span>04</span>Colour schemes · suggestions</h2>
<p class="lede">The format stays the same: two colours per scheme, light lettering on a dark ground as primary, the
inverse as the alternative, and a single grey only for secondary text and dividers. No gradients, effects or extra
colours. Every pair stays dark enough to read as near-black and white, so the quiet, high-end feel holds. My pick is
<b>Ink &amp; Bone</b> as the master: the same restraint as Mono, with a warmer and more expensive finish.
The story tile’s question text uses the live Michroma font for preview only; final assets will be outlined.</p>
<div class="stack">{''.join(pcards)}{pillar}</div>""")

parts.append("""<footer>Round 2. Earlier rounds: <a href="exploration/round-1.html">round 1</a> ·
<a href="type-exploration.html">type exploration</a>. All logo artwork is outlined paths. Rebuild with
<code>python3 brand/_src/build_round2.py</code>.</footer>""")

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM Brand Preview</title>{FONT_LINK}<style>{CSS}</style></head><body><div class="wrap">{''.join(parts)}</div>
<script>document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('show-grid')));</script>
</body></html>"""
with open(os.path.join(EXP, "round-2.html"), "w") as fh:
    fh.write(html.replace('src="exploration/', 'src="').replace('href="exploration/round-1.html"', 'href="round-1.html"').replace('href="type-exploration.html"', 'href="../type-exploration.html"'))
print("ok")
