"""Brand guidelines (guidelines.md + self-contained guidelines.html) and the final preview page.

Content is written once below and rendered to both Markdown and HTML.
Run after build_final.py:  python3 brand/_src/build_guidelines.py
"""
import html as H
import os
import re

from lettering import EqualLettering
from mttm import fmt
from system import (COLORS, DPI, HEAVY, MERCH, REGULAR, THEMES, U, bbox, cmyk_approx, contrast, glyphs_for, hexc,
                    logo_svg, placed, rgb)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRATCH = os.environ.get("MTTM_ARTIFACT_OUT")  # optional: also write a skeleton-less copy for publishing


def read(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return f.read()


def inline(svg, width=None, cls=""):
    attrs = (f' width="{width}"' if width else "") + (f' class="{cls}"' if cls else "")
    return svg.replace("<svg ", f"<svg{attrs} ", 1)


# ---------------------------------------------------------------- content model
class Doc:
    def __init__(self):
        self.md, self.html = [], []

    @staticmethod
    def _h(text):
        t = H.escape(text, quote=False)
        t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
        return re.sub(r"`(.+?)`", r"<code>\1</code>", t)

    def section(self, sid, num, title, lede=None):
        self.md.append(f"\n## {num}. {title}\n")
        if self.html:
            self.html.append("</section>")
        self.html.append(f'<section id="{sid}"><div class="sec-head"><span class="num">{num}</span>'
                         f"<h2>{H.escape(title)}</h2></div>")
        if lede:
            self.p(lede, cls="lede")

    def sub(self, title):
        self.md.append(f"\n### {title}\n")
        self.html.append(f"<h3>{H.escape(title)}</h3>")

    def p(self, text, cls=None):
        self.md.append(text + "\n")
        self.html.append(f'<p{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{self._h(text)}</p>')

    def ul(self, items):
        self.md.append("\n".join(f"- {i}" for i in items) + "\n")
        self.html.append("<ul>" + "".join(f"<li>{self._h(i)}</li>" for i in items) + "</ul>")

    def table(self, head, rows):
        self.md.append("| " + " | ".join(head) + " |\n|" + "---|" * len(head))
        self.md.extend("| " + " | ".join(str(c) for c in r) + " |" for r in rows)
        self.md.append("")
        th = "".join(f"<th>{H.escape(h)}</th>" for h in head)
        trs = "".join("<tr>" + "".join(f"<td>{self._h(str(c))}</td>" for c in r) + "</tr>" for r in rows)
        self.html.append(f'<div class="tbl"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>')

    def visual(self, html_block, md_images=()):
        self.html.append(html_block)
        for alt, rel in md_images:
            self.md.append(f"![{alt}]({rel})\n")

    def raw_md(self, text):
        self.md.append(text)


# ---------------------------------------------------------------- visuals
INK, BONE, STONE = hexc("ink"), hexc("bone"), hexc("stone")
wm_primary = read("logo/wordmark/svg/mttm-wordmark-bone-on-ink.svg")
mono_primary = read("logo/monogram/svg/mttm-monogram-bone-on-ink.svg")


def construction_svg():
    g = glyphs_for("wordmark")
    x0, y0, x1, y1 = bbox(REGULAR, g)
    p = U
    d = " ".join(REGULAR.path(c, x, b) for c, x, b in g)
    boxes = "".join(f'<rect x="{fmt(cx - U / 2)}" y="{fmt(b - U)}" width="{U}" height="{U}"/>' for _, cx, b in g)
    gaps = ""
    # dimension marks: one letter gap and one line gap
    gx = g[0][1] + U / 2
    gaps += (f'<line x1="{gx}" y1="{y0 - 38}" x2="{gx + U}" y2="{y0 - 38}"/>'
             f'<line x1="{gx}" y1="{y0 - 50}" x2="{gx}" y2="{y0 - 26}"/><line x1="{gx + U}" y1="{y0 - 50}" x2="{gx + U}" y2="{y0 - 26}"/>')
    lx = x1 + 38
    gaps += (f'<line x1="{lx}" y1="{y0 + U}" x2="{lx}" y2="{y0 + 2 * U}"/>'
             f'<line x1="{lx - 12}" y1="{y0 + U}" x2="{lx + 12}" y2="{y0 + U}"/><line x1="{lx - 12}" y1="{y0 + 2 * U}" x2="{lx + 12}" y2="{y0 + 2 * U}"/>')
    labels = (f'<text x="{gx + U / 2}" y="{y0 - 62}" text-anchor="middle">1 U</text>'
              f'<text x="{lx + 20}" y="{y0 + 1.5 * U + 10}">1 U</text>')
    vx, vy, vw, vh = x0 - p, y0 - p, x1 - x0 + 2 * p + 60, y1 - y0 + 2 * p
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(vw)} {fmt(vh)}" role="img" '
            f'aria-label="Wordmark construction grid"><rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(vw)}" height="{fmt(vh)}" fill="{BONE}"/>'
            f'<g fill="none" stroke="{STONE}" stroke-width="2" stroke-dasharray="8 6">{boxes}</g>'
            f'<path fill="{INK}" d="{d}"/><g stroke="{INK}" stroke-width="3">{gaps}</g>'
            f'<g font-family="IBM Plex Mono, monospace" font-size="34" fill="{INK}">{labels}</g></svg>')


def clearspace_svg(kind):
    g = glyphs_for(kind)
    x0, y0, x1, y1 = bbox(REGULAR, g)
    p = U
    d = " ".join(REGULAR.path(c, x, b) for c, x, b in g)
    vx, vy, vw, vh = x0 - p * 1.4, y0 - p * 1.4, x1 - x0 + 2.8 * p, y1 - y0 + 2.8 * p
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(vw)} {fmt(vh)}" role="img" '
            f'aria-label="Clear space">'
            f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(vw)}" height="{fmt(vh)}" fill="{BONE}"/>'
            f'<rect x="{fmt(x0 - p)}" y="{fmt(y0 - p)}" width="{fmt(x1 - x0 + 2 * p)}" height="{fmt(y1 - y0 + 2 * p)}" '
            f'fill="#E2DCD0" stroke="{STONE}" stroke-width="2" stroke-dasharray="8 6"/>'
            f'<rect x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(x1 - x0)}" height="{fmt(y1 - y0)}" fill="{BONE}"/>'
            f'<path fill="{INK}" d="{d}"/></svg>')


def tee_svg(side, fg, bg, logo_kind, logo_w, cx, cy, lettering=REGULAR, stroke="#00000022"):
    shirt = ("M120,22 L162,10 Q200,42 238,10 L280,22 L382,74 L352,154 L312,134 L312,432 L88,432 L88,134 "
             "L48,154 L18,74 Z")
    d, _ = placed(logo_kind, cx, cy, width=logo_w, lettering=lettering)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 446" role="img" aria-label="Tee {side}">'
            f'<path d="{shirt}" fill="{bg}" stroke="{stroke}" stroke-width="2"/>'
            f'<path fill="{fg}" d="{d}"/></svg>')


def cap_svg(fg, bg):
    crown = "M78,206 C78,112 128,62 200,62 C272,62 322,112 322,206 Q200,196 78,206 Z"
    brim = "M108,204 Q200,192 292,204 Q306,236 286,252 Q200,238 114,252 Q94,236 108,204 Z"
    seams = "M200,62 L200,200 M200,62 C160,90 140,140 136,202 M200,62 C240,90 260,140 264,202"
    d, _ = placed("monogram", 200, 146, width=72, lettering=HEAVY)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="Cap front">'
            f'<path d="{crown}" fill="{bg}" stroke="#00000026" stroke-width="2"/>'
            f'<path d="{seams}" fill="none" stroke="#00000018" stroke-width="2"/>'
            f'<circle cx="200" cy="62" r="7" fill="{bg}" stroke="#00000030" stroke-width="2"/>'
            f'<path d="{brim}" fill="{bg}" stroke="#00000033" stroke-width="2"/><path fill="{fg}" d="{d}"/></svg>')


# body width on the drawing = 224px ~ 20in garment => 11.2 px/in
PXIN = 224 / 20
merch_visual = f"""
<div class="merch">
 <figure>{tee_svg('front', BONE, INK, 'wordmark', 11 * PXIN, 200, 170)}<figcaption>Tee front · Ink tee, Bone print · wordmark 11 in</figcaption></figure>
 <figure>{tee_svg('front', INK, BONE, 'monogram', 3.5 * PXIN, 250, 130)}<figcaption>Tee front · Bone tee, Ink print · left-chest monogram 3.5 in</figcaption></figure>
 <figure>{tee_svg('back', hexc('chalk'), hexc('moss'), 'single-line', 10 * PXIN, 200, 70)}<figcaption>Hoodie / tee back · Moss, Chalk print · single line 10 in</figcaption></figure>
 <figure>{cap_svg(BONE, INK)}<figcaption>Cap front · heavy-cut monogram embroidery 2.25 in</figcaption></figure>
 <figure>{cap_svg(INK, hexc('sage'))}<figcaption>Cap front · Sage cap, Ink thread</figcaption></figure>
</div>"""


def swatch_html(name):
    h, role = COLORS[name]
    r, g, b = rgb(h)
    c, m, y, k = cmyk_approx(h)
    dark = contrast(h, "#FFFFFF") > contrast(h, "#000000")
    fg = "#FFFFFF" if dark else "#0E0E0D"
    return (f'<div class="sw"><div class="chip" style="background:{h};color:{fg}"><span>{name.title()}</span></div>'
            f'<dl><dt>HEX</dt><dd>{h}</dd><dt>RGB</dt><dd>{r} {g} {b}</dd><dt>CMYK*</dt><dd>{c} {m} {y} {k}</dd></dl>'
            f'<p>{H.escape(role)}</p></div>')


def theme_block(t):
    fg, bg, grey = hexc(t["fg"]), hexc(t["bg"]), hexc(t["grey"])
    wm = logo_svg("wordmark", fg, bg)
    mono = logo_svg("monogram", fg, bg)
    return (f'<div class="theme" style="background:{bg};color:{fg}"><div class="theme-top">'
            f'<span class="lbl" style="color:{grey}">{H.escape(t["pillar"])}</span>'
            f'<span class="lbl" style="color:{grey}">{H.escape(t["theme"])}</span></div>'
            f'<div class="theme-art">{inline(wm, cls="t-wm")}{inline(mono, cls="t-mono")}</div>'
            f'<div class="theme-codes" style="color:{grey}">{fg} on {bg} · {contrast(fg, bg):.1f}:1</div></div>')


def ig_tile(rel, cap, ratio="story"):
    return f'<figure class="ig {ratio}">{inline(read(rel))}<figcaption>{H.escape(cap)}</figcaption></figure>'


# ---------------------------------------------------------------- write the content
D = Doc()

BRIEF = """MAKE TIME TO MOVE (MTTM) · @maketimetomove
Personal training brand and healthy-living movement. The name is a command that answers the most common reason for not exercising: "I don't have time."
Pillars: Strength, Mobility, Mindset. Signature series: stranger interviews asking "Why do you make time to move?"
Feel: minimalist, clean, confident, high-end, quiet. Restraint over loudness. Never gym-floor aggressive.

LOGO: custom equal-width capitals, thin monoline (stroke = 12% of letter height). Every letter sits in a 1x1 square box. Letter gap = 1 letter, line gap = 1 letter.
  Wordmark (primary): MAKETIME over TOMOVE, centred, no word gap. 15 x 3 units.
  Monogram: M T over T M, same spacing, a 3 x 3 square. Used for avatar, favicon, labels, small merch.
  Single line: MAKETIMETOMOVE in one run, no word gap. For hats, sleeves, website header, narrow spaces.
  Heavy cut: same letters with a thicker stroke, for favicons and embroidery only.
  Clear space = 1 letter height on all sides. Always use the supplied files. Never retype the logo in a font.

COLOUR (two colours per layout, plus one grey for secondary text):
  Master: Ink #0E0E0D + Bone #EFEBE3 (grey Stone #8F8B83).
  Strength: Bone on Ink. Start Here: Ink on Bone.
  Mobility: Ink #0E0E0D on Sage #B7C0AE (grey Fern #5F665A).
  Mindset: Mist #E3E7EC on Midnight #121A26 (grey Slate #87909C).
  Interviews: Chalk #E8E6DD on Moss #1E2A23 (grey Lichen #8C948D).
  Utility: pure Black #000000 and White #FFFFFF for one-colour reproduction.
  No gradients, effects, shadows, outlines or extra colours.

TYPE: MTTM Lettering is the brand's own custom font (capitals only, spacing built in, so leave letter-spacing at 0). Use it for headlines, labels, title cards and slogans. Regular for general use; Heavy only for small sizes and embroidery. Font files: fonts/mttm-lettering-regular.woff2 / .otf and -heavy. For websites it is embedded in tokens/mttm-brand.css and in Appendix 13 of the guidelines. Never substitute another typeface (no Michroma, no lookalikes). Manrope (Google Fonts) for body text and anything read as sentences (400/500/600).

VOICE: short, direct, imperative, calm. No hype, no fitness clichés, no exclamation marks. Examples: "Make time to move." "Start where you are." "Why do you make time to move?"

IMAGERY: natural light, real people, honest movement, muted or black-and-white colour, generous negative space. No stock gym imagery, no neon, no flexing for the camera.

RULES FOR AI ASSISTANTS AND DESIGNERS
  1. Use the supplied logo files (SVG or PNG). Never draw, retype or approximate the logo. The single line is always MAKETIMETOMOVE in one run: never add a space or word gap between MAKETIME and TOMOVE.
  2. Headlines and labels: MTTM Lettering only, capitals, letter-spacing 0. It is a custom font that exists only in the brand files: fonts/mttm-lettering-regular.woff2 / .otf (and -heavy), tokens/mttm-brand.css (font embedded), or the embed code in Appendix 13 of these guidelines. Never substitute Michroma or any other typeface. If you cannot access the font, ask for the files before producing work.
  3. Body text: Manrope. Never use any other typeface.
  4. One theme per layout. Default to Ink & Bone unless the content belongs to a pillar.
  5. Keep on-image text to 8 words or fewer, in the brand voice.
  6. Instagram stories and reels (1080 x 1920): keep text out of the top 250 px and bottom 340 px; keep reel cover text inside the centre 1080 x 1080.
  7. Keep 1 letter height of clear space around every logo. No gradients, shadows, outlines, effects or extra colours.
  8. When unsure, choose less: more space, fewer elements, one message."""

D.raw_md("# Make Time To Move · Brand Guidelines\n\n"
         "Version 1.0 · October 2026 · @maketimetomove\n\n"
         "The single reference for the Make Time To Move identity across Instagram, the website, marketing "
         "materials and merchandise. Asset files live alongside this document in `brand/`.\n")

D.section("brief", "00", "Brand brief",
          "Copy this summary into any new chat, brief or design tool so that future work matches the brand.")
D.html.append('<div class="brief"><button class="copy" type="button" id="copy-brief">Copy brief</button>'
              f'<pre id="brief-text">{H.escape(BRIEF)}</pre></div>')
D.md.append("```text\n" + BRIEF + "\n```\n")

D.section("concept", "01", "Concept")
D.p("**Make Time To Move** is a training habit for a healthy way of life. It is a movement first, and a coaching "
    "business second. The name is a command. It answers the most common reason people give for not "
    "exercising, “I don’t have time,” with a calm instruction instead of a pitch.")
D.ul(["**Strength:** training that builds capability for everyday life.",
      "**Mobility:** moving well, recovering well, staying able.",
      "**Mindset:** the habit itself. Its signature format is street interviews with strangers, asking "
      "“Why do you make time to move?”"])
D.p("The identity follows the same idea. One unit of space repeats everywhere: every letter is the same size, and "
    "every gap is the same size. The structure is visible, calm and unhurried. Nothing shouts.")

D.section("logo", "02", "Logo system",
          "Four marks drawn from one set of custom letters. Always use the supplied files and never retype the logo.")
D.visual(f'<div class="logo-hero">{inline(wm_primary)}</div>',
         [("Wordmark, Bone on Ink", "logo/wordmark/png/mttm-wordmark-bone-on-ink-1200.png")])
D.table(["Mark", "Use", "Files"], [
    ["**Wordmark** (primary)", "Default for everything with room: website hero, posters, merch fronts, decks.",
     "`logo/wordmark/`"],
    ["**Monogram** M T / T M", "Instagram avatar, favicon, labels, chest prints, highlight covers, sign-offs.",
     "`logo/monogram/`"],
    ["**Single line**", "Hats, sleeves, back yokes, website header bar, email footers, narrow spaces.",
     "`logo/single-line/`"],
    ["**Heavy cut**", "The same letters with a thicker stroke. Only for favicons (≤ 64 px) and embroidery.",
     "`logo/monogram-heavy/`, `logo/wordmark-heavy/`, `logo/single-line/*-heavy-*`"],
])
single = read("logo/single-line/svg/mttm-single-line-bone-on-ink.svg")
heavy = read("logo/monogram-heavy/svg/mttm-monogram-heavy-bone-on-ink.svg")
D.visual(f"""<div class="marks">
 <figure class="m-mono">{inline(mono_primary)}<figcaption>Monogram</figcaption></figure>
 <figure class="m-heavy">{inline(heavy)}<figcaption>Monogram · heavy cut</figcaption></figure>
 <figure class="m-single">{inline(single)}<figcaption>Single line</figcaption></figure>
</div>""", [("Monogram", "logo/monogram/png/mttm-monogram-bone-on-ink-512.png"),
            ("Single line", "logo/single-line/png/mttm-single-line-bone-on-ink-1200.png")])

D.section("construction", "03", "Construction",
          "The unit **U** is the letter height. Everything in the identity is measured in U.")
D.visual(f'<div class="figure-wide">{construction_svg()}</div>')
D.ul(["Every letter sits in a **1 U × 1 U** square. All letters share that width and height.",
      "Gap between letters: **1 U**. Gap between the two lines: **1 U**. The wordmark is 15 U × 3 U.",
      "Line 2 (TOMOVE) is centred under line 1 (MAKETIME) on the same columns. There is no word gap: the line break separates the words.",
      "Monogram: M T over T M with the same gaps, giving a **3 U × 3 U** square.",
      "Single line: MAKETIMETOMOVE in one run with the same 1 U letter gaps and no word gap, giving 27 U × 1 U.",
      "Stroke: 12% of U for the regular weight, the same as the regular font weight. The heavy cut is 22%.",
      "The letters are custom: square boxes, a circular O, a plain-stroke I, and a K made of two straight diagonals meeting the stem. No font reproduces them, so never retype the logo."])

D.section("clearspace", "04", "Clear space & minimum sizes")
D.p("Keep at least **1 U** (one letter height) clear on every side of any mark. Nothing goes inside that zone: "
    "no text, edges, other logos or busy image detail. All supplied files already include it.")
D.visual(f'<div class="cs">{inline(clearspace_svg("wordmark"))}{inline(clearspace_svg("monogram"))}</div>')
D.table(["Mark", "Digital minimum", "Print (paper)", "Screen print", "Embroidery"], [
    ["Wordmark", "160 px wide", "40 mm wide", "75 mm wide", "Heavy cut, ≥ 100 mm wide"],
    ["Monogram", "64 px (regular) · 16–48 px heavy cut", "15 mm", "20 mm", "Heavy cut, ≥ 25 mm"],
    ["Single line", "300 px wide", "120 mm", "150 mm (heavy cut ≥ 90 mm)", "Heavy cut, ≥ 120 mm"],
])
D.p("Below the wordmark minimum, use the monogram. At 16 px the monogram reads as a recognisable square, not as "
    "letters. That is expected for any four-letter mark.")

D.section("colour", "05", "Colour",
          "Four themes, each made of two colours plus one grey. One theme per layout; never mix themes.")
D.visual('<div class="swatches">' + "".join(swatch_html(n) for n in
                                             ("ink", "bone", "stone", "moss", "chalk", "lichen", "midnight", "mist",
                                              "slate", "sage", "fern", "black", "white")) + "</div>")
D.table(["Colour", "HEX", "RGB", "CMYK (approx.)", "Role"],
        [[n.title(), v[0], " ".join(map(str, rgb(v[0]))), " ".join(map(str, cmyk_approx(v[0]))), v[1]]
         for n, v in COLORS.items()])
D.p("*CMYK values are mathematical starting points, not colour-managed. For print and merch, ask the printer to "
    "match the HEX values to a physical swatch (Pantone or their own ink system) and approve a proof before a run. "
    "For large solid Ink areas on paper, use a rich black (C60 M40 Y40 K100).")
D.sub("Themes by pillar")
D.visual('<div class="themes">' + "".join(theme_block(t) for t in THEMES) + "</div>")
D.table(["Pillar", "Theme", "Lettering", "Ground", "Grey (secondary)", "Contrast"],
        [[t["pillar"], t["theme"], f"{t['fg'].title()} {hexc(t['fg'])}", f"{t['bg'].title()} {hexc(t['bg'])}",
          f"{t['grey'].title()} {hexc(t['grey'])}", f"{contrast(hexc(t['fg']), hexc(t['bg'])):.1f}:1"]
         for t in THEMES])
D.ul(["**Ink & Bone is the master.** Use it for the profile, the website, general posts and most merch.",
      "Greys are only for secondary text, captions and dividers. They are not for logos or body copy on light grounds.",
      "Black and white are utilities for one-colour jobs: stamps, single-ink prints and partner logos.",
      "Approved logo pairings are exactly the lettering/ground pairs above, plus each pair inverted, plus single-colour logos on photography with enough contrast."])

D.section("type", "06", "Typography")
D.table(["Role", "Typeface", "Setting", "Use"], [
    ["Logo", "MTTM custom lettering", "Supplied artwork only", "Logos. Never typed."],
    ["Display & labels", "MTTM Lettering (brand font, `fonts/`)", "Capitals · letter-spacing 0 (built in) · Regular; Heavy for small sizes",
     "Headlines, story titles, section labels, highlight text, merch slogans"],
    ["Body", "Manrope (Google Fonts)", "Sentence case · 400 / 500 / 600 · line-height 1.6",
     "Captions, website copy, emails, documents"],
])
D.sub("The alphabet · MTTM Lettering")
D.p("This is the brand font. Every character below is drawn from the font files. Letters and figures sit in a 1 U square; "
    "punctuation is narrower. In use, characters are 1 U apart and words are 3 U apart.")


def alphabet_chart(alpha, cols=10):
    from alphabet import CHARSET
    cw, chh = 150, 190
    cells = []
    for i, ch in enumerate(CHARSET):
        cx, cy = (i % cols) * cw, (i // cols) * chh
        bw = alpha.box(ch)
        ox = cx + (cw - bw) / 2
        pen_d = alpha.path(ch, ox + 50, cy + 125)  # glyph ink starts at the box's left edge
        lab = {"’": "’", '"': "&quot;", "&": "&amp;"}.get(ch, ch)
        cells.append(f'<rect x="{ox}" y="{cy + 25}" width="{bw}" height="100" fill="none" stroke="{STONE}" '
                     f'stroke-width="1.5" stroke-dasharray="6 5"/><path fill="{INK}" d="{pen_d}"/>'
                     f'<text x="{cx + cw / 2}" y="{cy + 165}" text-anchor="middle">{lab}</text>')
    rows = (len(CHARSET) + cols - 1) // cols
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cols * cw} {rows * chh}" role="img" '
            f'aria-label="MTTM Lettering character set"><g font-family="Manrope, sans-serif" font-size="22" fill="{STONE}">'
            f'{"".join(cells)}</g></svg>')


from alphabet import CHARSET as _CS, HEAVY_ALPHABET as _HA, REGULAR_ALPHABET as _RA  # noqa: E402
D.visual(f'<div class="alpha"><h4>Regular</h4>{alphabet_chart(_RA)}<h4>Heavy · small sizes and embroidery</h4>{alphabet_chart(_HA)}</div>')
D.md.append("Character set (Regular and Heavy): `" + _CS + "` · lowercase keys type capitals.\n")
D.ul(["Square box for every letter and figure; constant stroke of 12% of the letter height (Heavy: 22%).",
      "O is a perfect circle; 0 (zero) is a rounded square; I is a single stroke; K is two straight diagonals meeting the stem; W is M upside down.",
      "A, M and V have small flat points rather than sharp tips. C, G, S, 2, 3, 5, 6, 8, 9 are built from the same ellipse geometry as the O.",
      "Spacing is part of the font: 1 U between characters, 3 U between words. Always leave letter-spacing at 0."])
D.visual(f"""<div class="specimen">
 <div class="spec-d">WHY DO YOU MAKE TIME TO MOVE?</div>
 <div class="spec-l">STRENGTH · MOBILITY · MINDSET</div>
 <div class="spec-g">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,:!?'&quot;-–—/·@+#()&amp;</div>
 <p class="spec-b">Start where you are. Ten minutes counts. Training is a habit you keep, not a phase you survive. Manrope carries everything you read at length, quietly.</p>
</div>""")
D.ul(["MTTM Lettering is the logo’s alphabet: every character in a square box, a circular O, and 1 U gaps between characters and 3 U between words. The spacing is built into the font, so always leave letter-spacing at 0.",
      "Install `fonts/mttm-lettering-regular.otf` and `-heavy.otf` for Canva, Figma and desktop apps. Use the `.woff2` files on websites.",
      "Capitals only (lowercase keys type capitals). Keep lines short: 2 to 4 words, centred or left-aligned, never justified, never for paragraphs.",
      "Characters: A–Z, 0–9 and . , : ! ? ' \" - – — / · @ + # ( ) &. The zero is a rounded square so it is never confused with the circular O.",
      "Use Heavy only for labels smaller than about 14 px tall on screen and for embroidery.",
      "The logo stays fixed artwork. Never type it, even though the font has the letters.",
      "On websites, load MTTM Lettering from `tokens/mttm-brand.css` (font embedded) or the code in Appendix 13. Never substitute another typeface. The generic `sans-serif` keyword is the only fallback and should never be visible."])

D.section("instagram", "07", "Instagram",
          "Templates live in `instagram/`. Every PNG has a matching SVG; files ending in `-template.svg` keep "
          "editable text (install MTTM Lettering and Manrope).")
D.visual(f"""<div class="ig-row">
 {ig_tile('instagram/avatar/mttm-ig-avatar.svg', 'Profile avatar · 1080 × 1080', 'square circle')}
 {''.join(ig_tile(f"instagram/highlights/mttm-ig-highlight-{t['id']}.svg", f"Highlight · {t['pillar']}") for t in THEMES)}
</div>
<div class="ig-row">
 {ig_tile('instagram/interview/mttm-ig-interview-title.svg', 'Interview title card')}
 <figure class="ig story lt"><div class="lt-bg">{inline(read('instagram/interview/mttm-ig-lower-third.svg'))}</div><figcaption>Lower third (transparent)</figcaption></figure>
 {''.join(ig_tile(f"instagram/reels/mttm-ig-reel-cover-{t['id']}.svg", f"Reel cover · {t['pillar']}") for t in THEMES[1:])}
 {ig_tile('instagram/reels/mttm-ig-reel-cover-safe-zone-guide.svg', 'Reel safe zones')}
</div>""", [("Interview title card", "instagram/interview/mttm-ig-interview-title.png"),
            ("Reel safe zones", "instagram/reels/mttm-ig-reel-cover-safe-zone-guide.png")])
D.table(["Asset", "Size", "Notes"], [
    ["Avatar", "1080 × 1080", "Monogram, Bone on Ink. Its diagonal stays inside the circular crop."],
    ["Highlight covers", "1080 × 1920", "Pillar colour plus monogram. Instagram shows the pillar name underneath, so the cover carries no words."],
    ["Interview title card", "1080 × 1920", "Moss theme. Change the episode number in the template file."],
    ["Lower third", "1080 × 1920, transparent", "Name in MTTM Lettering, caption in Manrope. Sits above the story UI."],
    ["Reel covers", "1080 × 1920", "One per pillar. Keep text inside the centre 1080 × 1080 so it survives the 3:4 grid and square crops."],
])
D.sub("Feed aesthetic")
D.ul(["The grid reads as calm blocks of the five theme colours, interleaved with photography. Don’t chase every trend.",
      "Each post uses one theme, and the theme follows the pillar.",
      "Use typography posts for questions and principles: MTTM Lettering, centred, generous space, at most 8 words.",
      "Captions follow the voice: short, plain, no emoji clusters, few hashtags (3 to 5, at the end).",
      "Interview videos open on the title card, use the lower third for the person’s name, and close on the monogram."])
D.sub("Imagery")
D.ul(["Natural light, real places, real people mid-movement. Honest effort over posed perfection.",
      "Grade toward muted, slightly cool colour, or black and white. Skin looks like skin.",
      "Leave negative space for type. Frame interviews at eye level, subject centred, handheld but steady.",
      "Avoid stock gym imagery, neon, heavy filters, shirtless flexing for the camera, and before/after shots."])

D.section("web", "08", "Website & digital",
          "Design tokens are in `tokens/mttm-tokens.css` and `tokens/mttm-tokens.json`. Use them to theme any site, "
          "app or deck so it matches the brand.")
D.ul(["Default theme: Bone text on Ink. Use Ink on Bone for long reading pages. Pillar pages may switch theme via `data-mttm-theme`.",
      "Header: the single-line logo at 240 to 360 px wide. Footer: the monogram. Favicon set: `logo/favicon/`.",
      "Layout: generous whitespace on an 8 px spacing scale, content up to about 1200 px, centred hero with the wordmark.",
      "UI: square corners (0 to 2 px radius), 1 px hairline rules, no shadows or gradients. Buttons are solid lettering-colour blocks with MTTM Lettering labels.",
      "Body text: Manrope 17 to 18 px, line-height 1.6, at most about 70 characters per line."])
D.html.append("<pre class='code'>" + H.escape(
    '<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="stylesheet" href="mttm-tokens.css">\n'
    "<body data-mttm-theme=\"strength\"> … </body>") + "</pre>")
D.md.append("```html\n<link rel=\"icon\" href=\"/favicon.ico\" sizes=\"any\">\n<link rel=\"icon\" href=\"/favicon.svg\" "
            "type=\"image/svg+xml\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n"
            "<link rel=\"stylesheet\" href=\"mttm-tokens.css\">\n<body data-mttm-theme=\"strength\"> … </body>\n```\n")

D.section("merch", "09", "Merchandise",
          "Print-ready files are in `merch/`: transparent, one colour, as SVG (vector, preferred by printers) and "
          f"PNG at {DPI} dpi.")
D.visual(merch_visual)
D.table(["File", "Mark", "Print width", "Use"],
        [[f"`merch/{s}/`", ("Heavy cut " if L is HEAVY else "") + k.replace("-", " "), f"{w:g} in ({w * 25.4:.0f} mm)", u]
         for s, k, L, w, u in MERCH])
D.table(["Garment", "Print / thread"], [
    ["Ink (black, vintage black)", "Bone"], ["Bone (natural, ecru)", "Ink"], ["Moss (forest, dark green)", "Chalk"],
    ["Midnight (navy)", "Mist"], ["Sage", "Ink"]])
D.ul(["One colour per garment. Use screen print or DTG for prints, and embroidery for caps, beanies and chest marks.",
      "Embroidery always uses the **heavy cut** artwork, because satin stitches need a stroke of about 1 mm or more.",
      "Match garment and ink colours to the palette by physical swatch, and approve a sample before ordering a run.",
      "Set slogans in MTTM Lettering, as one or two short lines, using brand-voice lines only.",
      "Place a small monogram woven label or neck print on garments whose front carries a slogan."])

D.section("voice", "10", "Brand voice",
          "Short, direct, imperative. Calm confidence. Say less, and mean it.")
D.visual('<div class="voice"><span>Make time to move.</span><span>Start where you are.</span>'
         '<span>Why do you make time to move?</span><span>Ten minutes counts.</span>'
         '<span>Strength. Mobility. Mindset.</span></div>')
D.table(["Do", "Don’t"], [
    ["Short sentences. Verbs first.", "Long build-ups, rhetorical hype."],
    ["Plain words a friend would use.", "Fitness clichés: “beast mode”, “no excuses”, “crush it”, “grind”, “shred”."],
    ["Invite: “Start where you are.”", "Shame: “What’s your excuse?”"],
    ["Full stops.", "Exclamation marks, all-caps shouting in body text, emoji strings."],
    ["Real people, real reasons.", "Transformation promises, “summer body”, before/after framing."],
])

D.section("dont", "11", "What not to do")
D.ul(["Don’t add gradients, shadows, glows, outlines, textures or any other effect to the logo.",
      "Don’t stretch, squash, rotate, skew or re-space the letters. The equal spacing is the logo.",
      "Don’t type the logo, not even in MTTM Lettering. Always use the supplied artwork.",
      "Don’t recolour outside the approved pairs, and don’t put two theme colours in one logo.",
      "Don’t add a word gap or a space anywhere in the logo. The single line is always MAKETIMETOMOVE in one run, and in the wordmark TOMOVE stays centred under MAKETIME.",
      "Don’t place the logo on busy photography without enough contrast, or inside its clear space.",
      "Don’t lock the logo up with taglines, icons or other marks. Keep each mark on its own.",
      "Don’t use the heavy cut at large sizes on screen. It exists for small sizes and thread."])

D.section("files", "12", "Files & naming")
D.p("Everything is prefixed `mttm-`, then the mark, then the colourway (`lettering-on-ground`, or a single colour "
    "for transparent files), then the size in pixels for PNGs.")
D.table(["Folder", "Contents"], [
    ["`logo/wordmark/`", "Wordmark: SVG plus PNG at 600, 1200 and 2400 px wide, in 11 colourways"],
    ["`logo/monogram/`", "Monogram: SVG plus PNG at 128, 512 and 1024 px, in 11 colourways"],
    ["`logo/monogram-heavy/`, `logo/wordmark-heavy/`", "Heavy cut for favicons and embroidery"],
    ["`logo/single-line/`", "Single-line logo, regular and heavy"],
    ["`logo/variants/`", "Layout study: variant A (centred, chosen) and B (nested)"],
    ["`logo/favicon/`", "favicon.ico, favicon.svg, 16 / 32 / 48 px, apple-touch-icon, 192 and 512 px icons"],
    ["`instagram/`", "Avatar, highlights, interview title card and lower third, reel covers (+ editable templates)"],
    ["`merch/`", "Print-ready transparent files in Bone, Ink, White and Black"],
    ["`fonts/`", "MTTM Lettering font files: OTF (install for Canva, Figma, desktop) and WOFF2 (websites), Regular and Heavy, plus a specimen page"],
    ["`tokens/`", "`mttm-brand.css` (self-contained: tokens plus the embedded brand font), `mttm-tokens.css` and `.json`"],
    ["`_src/`", "Source fonts and the build scripts that generate every file"],
])
D.p("Typefaces: MTTM Lettering is the brand’s own custom font. Michroma (© Vernon Adams, SIL Open Font License) was the original drawing reference only and is not part of the brand. "
    "Manrope (© Mikhail Sharanda) is free under the SIL Open Font License.")
import base64 as _b64x  # noqa: E402


def _chunked_css(weight, fn, width=76):
    data = _b64x.b64encode(open(os.path.join(ROOT, "fonts", fn), "rb").read()).decode()
    lines = [data[i:i + width] for i in range(0, len(data), width)]
    body = "\\\n".join(lines)
    return (f"@font-face {{\n  font-family: 'MTTM Lettering';\n  font-weight: {weight};\n  font-style: normal;\n"
            f"  font-display: swap;\n  src: url('data:font/woff2;base64,\\\n{body}') format('woff2');\n}}")


FONT_CSS = (_chunked_css(400, "mttm-lettering-regular.woff2") + "\n\n" + _chunked_css(800, "mttm-lettering-heavy.woff2")
            + "\n\n:root { --mttm-font-display: 'MTTM Lettering', sans-serif; }\n"
              ".mttm-display { font-family: var(--mttm-font-display); text-transform: uppercase; letter-spacing: 0; }")
D.section("webfont", "13", "Appendix · web font code",
          "The complete MTTM Lettering font, embedded as code. Paste it into any website’s CSS and the brand font works "
          "with no other files. Use it whenever the font files themselves are not available.")
D.ul(["The same code, on single lines, is in `tokens/mttm-brand.css`. Prefer that file when you have it.",
      "As shown, this is valid CSS: each line inside the data string ends with a backslash, which CSS reads as a line continuation. "
      "If you join the lines, delete the backslashes and line breaks so the base64 data is one unbroken string.",
      "Then set headlines with `font-family: 'MTTM Lettering'`, capitals, `letter-spacing: 0`. Never substitute another typeface."])
D.html.append('<div class="fontcode"><button class="copy" type="button" id="copy-font">Copy code</button>'
              f'<pre id="font-code">{H.escape(FONT_CSS)}</pre></div>')
D.md.append("```css\n" + FONT_CSS + "\n```\n")
D.html.append("</section>")

# ---------------------------------------------------------------- markdown
with open(os.path.join(ROOT, "guidelines.md"), "w") as f:
    f.write("\n".join(D.md).replace("\n\n\n", "\n\n") + "\n")

# ---------------------------------------------------------------- HTML
TOC = [("brief", "Brief"), ("concept", "Concept"), ("logo", "Logo"), ("construction", "Construction"),
       ("clearspace", "Clear space"), ("colour", "Colour"), ("type", "Type"), ("instagram", "Instagram"),
       ("web", "Web"), ("merch", "Merch"), ("voice", "Voice"), ("dont", "Don’ts"), ("files", "Files"), ("webfont", "Font code")]

STYLE = """
/* Layout: a single long brand book on Bone paper. Ink cover band, numbered reference sections, wide figures. */
:root{
  --ink:#0E0E0D; --bone:#EFEBE3; --paper:#F6F3EE; --stone:#8F8B83; --line:#D9D3C7; --well:#E7E1D6;
  --f-display:"MTTM Lettering", sans-serif;
  --f-body:"Manrope", system-ui, sans-serif;
  --f-mono:"IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: light;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bone);color:var(--ink);font:16px/1.65 var(--f-body);-webkit-font-smoothing:antialiased}
.wrap{max-width:1160px;margin:0 auto;padding-inline:clamp(16px,4vw,40px);padding-block:0 96px}
svg{display:block;max-width:100%;height:auto}
code,pre{font-family:var(--f-mono);font-size:.86em}
code{background:var(--well);padding:1px 5px}
.cover{background:var(--ink);color:var(--bone)}
.cover .wrap{padding-block:40px 56px}
.cover-top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font:11px/1.4 var(--f-display);text-transform:uppercase;color:var(--stone)}
.cover-mark{max-width:880px;margin:56px auto 40px}
.cover-sub{text-align:center;font:12px/1.8 var(--f-display);text-transform:uppercase;color:var(--stone)}
nav.toc{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bone);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:4px 18px;flex-wrap:wrap;padding-block:12px}
nav.toc a{font:600 10.5px/2 var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);text-decoration:none;opacity:.7}
nav.toc a:hover,nav.toc a:focus-visible{opacity:1;text-decoration:underline;outline:none}
section{padding-top:72px;scroll-margin-top:56px}
.sec-head{display:flex;align-items:baseline;gap:18px;border-top:1px solid var(--ink);padding-top:18px;margin-bottom:12px}
.num{font:12px var(--f-display);color:var(--stone)}
h2{font:400 clamp(15px,2vw,21px)/1.5 var(--f-display);text-transform:uppercase;margin:0;text-wrap:balance}
h3{font:400 13px/1.4 var(--f-display);text-transform:uppercase;margin:40px 0 12px}
p,li{max-width:68ch}
.lede{font-size:18px;color:#3b3a37}
ul{padding-left:20px}
li{margin:6px 0}
.tbl{overflow-x:auto;margin:20px 0}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th{font:600 10.5px/1.4 var(--f-body);letter-spacing:.08em;text-transform:uppercase;text-align:left;color:var(--stone);padding:10px 12px;border-bottom:1px solid var(--ink)}
td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.brief{position:relative;background:var(--ink);color:var(--bone);padding:24px;margin-top:16px}
.brief pre{margin:0;white-space:pre-wrap;font-size:13px;line-height:1.7;color:var(--bone);background:none}
.copy{position:absolute;top:14px;right:14px;font:600 10.5px var(--f-body);letter-spacing:.08em;text-transform:uppercase;background:var(--bone);color:var(--ink);border:0;padding:9px 14px;cursor:pointer}
.copy:focus-visible{outline:2px solid var(--stone);outline-offset:2px}
.logo-hero{margin:24px 0}
.marks{display:grid;grid-template-columns:1fr 1fr 2.4fr;gap:16px;align-items:stretch;margin-top:16px}
@media (max-width:760px){.marks{grid-template-columns:1fr 1fr}.m-single{grid-column:1/-1}}
figure{margin:0}
figcaption{font:600 10.5px/1.6 var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--stone);margin-top:8px}
.marks figure{display:flex;flex-direction:column;justify-content:flex-end}
.figure-wide{margin:20px 0}
.cs{display:grid;grid-template-columns:2.4fr 1fr;gap:16px;margin:16px 0;align-items:center}
@media (max-width:640px){.cs{grid-template-columns:1fr}}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:20px 0}
.sw .chip{aspect-ratio:4/3;max-width:100%;display:flex;align-items:flex-end;padding:10px;border:1px solid var(--line)}
.sw .chip span{font:10px var(--f-display);text-transform:uppercase}
.sw dl{display:grid;grid-template-columns:auto 1fr;gap:0 10px;margin:8px 0 0;font:12px/1.6 var(--f-mono)}
.sw dt{color:var(--stone)} .sw dd{margin:0}
.sw p{font-size:12px;color:#55534e;margin:4px 0 0}
.themes{display:grid;gap:12px;margin:16px 0}
.theme{padding:18px 20px;border:1px solid var(--line)}
.theme-top{display:flex;justify-content:space-between;gap:12px}
.lbl{font:10px var(--f-display);text-transform:uppercase}
.theme-art{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:16px;align-items:center;margin:8px 0}
.theme-codes{font:11px var(--f-mono)}
.specimen{background:var(--paper);border:1px solid var(--line);padding:clamp(20px,4vw,40px);margin:16px 0}
.spec-d{font:clamp(18px,3vw,30px)/1.5 var(--f-display);text-wrap:balance}
.spec-l{font:11px var(--f-display);color:var(--stone);margin:14px 0}
.spec-b{font-size:17px;margin:0}
.ig-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px;margin:18px 0;align-items:end}
.ig svg{outline:1px solid var(--line)}
.ig.story svg{aspect-ratio:9/16}
.ig.circle svg{border-radius:50%}
.lt-bg{background:repeating-linear-gradient(45deg,#cfc8bb 0 10px,#d9d3c7 10px 20px)}
.merch{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;margin:16px 0}
.merch figure{background:var(--paper);border:1px solid var(--line);padding:14px}
.voice{display:flex;flex-direction:column;gap:6px;background:var(--ink);color:var(--bone);padding:clamp(24px,5vw,48px);margin:16px 0}
.voice span{font:clamp(15px,2.2vw,22px)/1.6 var(--f-display);text-transform:uppercase}
pre.code{background:var(--ink);color:var(--bone);padding:18px;overflow-x:auto;font-size:13px}
footer{margin-top:72px;border-top:1px solid var(--line);padding-top:16px;font-size:13px;color:#55534e}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
html{scroll-behavior:smooth}
"""
import base64 as _b64  # noqa: E402


def _face(weight, fn):
    data = _b64.b64encode(open(os.path.join(ROOT, "fonts", fn), "rb").read()).decode()
    return (f'@font-face{{font-family:"MTTM Lettering";font-weight:{weight};font-style:normal;'
            f'src:url(data:font/woff2;base64,{data}) format("woff2")}}')


STYLE = _face(400, "mttm-lettering-regular.woff2") + _face(800, "mttm-lettering-heavy.woff2") + STYLE + """
.alpha{background:var(--paper);border:1px solid var(--line);padding:clamp(14px,3vw,28px);margin:16px 0}
.alpha h4{font:600 10.5px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--stone);margin:0 0 8px}
.alpha svg+h4{margin-top:24px}
.fontcode{position:relative;background:var(--ink);color:var(--bone);padding:24px;margin-top:16px;overflow-x:auto}
.fontcode pre{margin:0;white-space:pre;font-size:11px;line-height:1.45;color:var(--bone)}
.spec-g{font:400 clamp(14px,2vw,20px)/2 var(--f-display);word-break:break-all;margin-top:12px}
"""
SCRIPT = """
document.getElementById('copy-font').addEventListener('click', async (e) => {
  const btn = e.currentTarget, el = document.getElementById('font-code');
  try { await navigator.clipboard.writeText(el.innerText); btn.textContent = 'Copied'; }
  catch (err) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection();
    s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected, press copy'; }
  setTimeout(() => btn.textContent = 'Copy code', 2400);
});
document.getElementById('copy-brief').addEventListener('click', async (e) => {
  const btn = e.currentTarget, text = document.getElementById('brief-text').innerText;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
  catch (err) {
    const r = document.createRange(); r.selectNodeContents(document.getElementById('brief-text'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected, press copy';
  }
  setTimeout(() => btn.textContent = 'Copy brief', 2400);
});
"""
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" '
         'href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Manrope:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap">')
cover = f"""<header class="cover"><div class="wrap">
<div class="cover-top"><span>Brand guidelines · v1.0</span><span>@maketimetomove</span></div>
<div class="cover-mark">{inline(read('logo/wordmark/svg/mttm-wordmark-bone-on-ink.svg'))}</div>
<div class="cover-sub">Strength · Mobility · Mindset</div></div></header>
<nav class="toc" aria-label="Sections"><div class="wrap">{''.join(f'<a href="#{i}">{t}</a>' for i, t in TOC)}</div></nav>"""
body = (f"<title>Make Time To Move Brand Guidelines</title>{FONTS}<style>{STYLE}</style>{cover}"
        f'<main class="wrap">{"".join(D.html)}<footer>Make Time To Move · Brand guidelines v1.0 · October 2026. '
        f"Asset files and the build scripts that generate them live in the <code>brand/</code> folder.</footer></main>"
        f"<script>{SCRIPT}</script>")
full = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" '
        'content="width=device-width,initial-scale=1,viewport-fit=cover">' + body.replace("</style>", "</style></head><body>", 1)
        + "</body></html>")
with open(os.path.join(ROOT, "guidelines.html"), "w") as f:
    f.write(full)
if SCRATCH:
    with open(SCRATCH, "w") as f:
        f.write(body)
print("guidelines ok", round(len(full) / 1024), "KB")


# ================================================================ FINAL PREVIEW PAGE
import base64  # noqa: E402

from system import COLORWAYS  # noqa: E402


def data_png(rel):
    return "data:image/png;base64," + base64.b64encode(open(os.path.join(ROOT, rel), "rb").read()).decode()


def ref_lettering(w):
    return EqualLettering(width=w, stem=12, bar=11, slab_i=False, o_style="ellipse", k_style="simple")


refs = []
for w, label, note in ((100, "1 : 1 · chosen", "Square letters, a circular O, and a square monogram."),
                       (125, "1.25 : 1 · reference", "Slightly extended. The O becomes a soft ellipse."),
                       (150, "1.5 : 1 · reference", "Extended. The O is clearly oval, and the monogram widens.")):
    L = ref_lettering(w)
    wm = logo_svg("wordmark", BONE, INK, L)
    mo = logo_svg("monogram", BONE, INK, L)
    tag = f"{w / 100:g}".replace(".", "")
    with open(os.path.join(ROOT, f"exploration/r6-proportion-{tag}-wordmark.svg"), "w") as f:
        f.write(wm)
    refs.append((label, note, wm, mo, w == 100))

ways = "".join(
    f'<figure class="cw{(" tr" + (" lt" if fg in ("white", "bone") else "")) if bg is None else ""}">{inline(read(f"logo/wordmark/svg/mttm-wordmark-{slug}.svg"))}'
    f"<figcaption>{slug}</figcaption></figure>" for slug, fg, bg in COLORWAYS)
mways = "".join(
    f'<figure class="cw{(" tr" + (" lt" if fg in ("white", "bone") else "")) if bg is None else ""}">{inline(read(f"logo/monogram/svg/mttm-monogram-{slug}.svg"))}'
    f"<figcaption>{slug}</figcaption></figure>" for slug, fg, bg in COLORWAYS)
small = "".join(f'<figure><img src="{data_png(r)}" width="{s}" height="{s}" alt=""><figcaption>{c}</figcaption></figure>'
                for r, s, c in (("logo/monogram-heavy/png/mttm-monogram-heavy-bone-on-ink-64.png", 64, "64 heavy"),
                                ("logo/favicon/favicon-48.png", 48, "48"),
                                ("logo/favicon/favicon-32.png", 32, "32"),
                                ("logo/favicon/favicon-16.png", 16, "16")))
ref_html = "".join(f"""<div class="pcard{' pick' if pk else ''}"><h3>{H.escape(lb)}</h3><p>{H.escape(nt)}</p>
<div class="prow">{inline(wm)}{inline(mo)}</div></div>""" for lb, nt, wm, mo, pk in refs)

PSTYLE = STYLE + """
.pcard{border:1px solid var(--line);padding:18px;margin-top:12px;background:var(--paper)}
.pcard.pick{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.pcard h3{margin:0 0 4px}.pcard p{margin:0 0 12px;color:#55534e}
.prow{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:16px;align-items:center}
.ways{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:12px 0}
.mways{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin:12px 0}
.cw svg{outline:1px solid var(--line)}
.cw.tr svg{background:repeating-conic-gradient(#d9d3c7 0 25%,#ece7de 0 50%) 0 0/16px 16px}
.cw.tr.lt svg{background:#4a4843}
.ab{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;margin:12px 0}
.smalls{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;margin-top:12px}
.done{background:var(--ink);color:var(--bone);padding:24px;margin-top:32px}
.done ul{margin:0}.done a{color:var(--bone)}
"""
pv = f"""<header class="cover"><div class="wrap">
<div class="cover-top"><span>Brand preview · final</span><span>@maketimetomove</span></div>
<div class="cover-mark">{inline(wm_primary)}</div>
<div class="cover-sub">Square 1 : 1 · centred · Ink &amp; Bone</div></div></header>
<main class="wrap">
<div class="done"><ul>
<li>Final: square 1 : 1 custom lettering, layout A (centred), no word gap, gaps of one letter.</li>
<li>Monogram: M T / T M on the same spacing, a 3 × 3 square.</li>
<li>Colour: Ink &amp; Bone master, with Moss, Midnight and Sage themes by pillar.</li>
<li>Full rules: <a href="guidelines.html">guidelines.html</a> · Earlier rounds: <a href="exploration/round-5.html">5</a> ·
<a href="exploration/round-4.html">4</a> · <a href="exploration/round-3.html">3</a> · <a href="exploration/round-2.html">2</a> ·
<a href="exploration/round-1.html">1</a> · <a href="type-exploration.html">type exploration</a></li></ul></div>

<section><div class="sec-head"><span class="num">A</span><h2>Proportion · 1 : 1 vs references</h2></div>{ref_html}</section>

<section><div class="sec-head"><span class="num">B</span><h2>Layout · A vs B</h2></div>
<p class="lede">A, centred, is the chosen layout. B is kept for the record.</p>
<div class="ab">{''.join(f'<figure>{inline(read(f"logo/variants/svg/mttm-wordmark-variant-{v}-{t}.svg"))}<figcaption>Variant {v.upper()} · {t}</figcaption></figure>' for v in ("a", "b") for t in ("white-on-black", "black-on-white"))}</div></section>

<section><div class="sec-head"><span class="num">C</span><h2>Wordmark colourways</h2></div><div class="ways">{ways}</div></section>

<section><div class="sec-head"><span class="num">D</span><h2>Monogram</h2></div><div class="mways">{mways}</div>
<h3>Small sizes · true 1× pixels</h3><div class="smalls">{small}</div></section>

<section><div class="sec-head"><span class="num">E</span><h2>Single line</h2></div>
<div class="stack">{inline(read('logo/single-line/svg/mttm-single-line-bone-on-ink.svg'))}{inline(read('logo/single-line/svg/mttm-single-line-ink-on-bone.svg'))}</div></section>

<section><div class="sec-head"><span class="num">F</span><h2>Instagram</h2></div>
{''.join(h for h in D.html if 'ig-row' in h)}</section>

<section><div class="sec-head"><span class="num">G</span><h2>Merch</h2></div>{merch_visual}</section>
<footer>Make Time To Move · final preview. Rebuild everything with <code>python3 brand/_src/build_final.py &amp;&amp; python3 brand/_src/build_guidelines.py</code>.</footer>
</main>"""
with open(os.path.join(ROOT, "preview.html"), "w") as f:
    f.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" '
            'content="width=device-width,initial-scale=1"><title>MTTM Brand Preview</title>'
            f"{FONTS}<style>{PSTYLE}</style></head><body>{pv}</body></html>")
print("preview ok")
