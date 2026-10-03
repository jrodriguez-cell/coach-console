"""MAKE TIME TO MOVE — final brand system: lettering, spacing rule, colours, and geometry helpers.

Spacing rule (the whole identity runs on one unit U = the letter height):
  letter box      = 1U x 1U (every letter the same width and height)
  letter gap      = 1U
  line gap        = 1U
  clear space     = 1U around any logo
  monogram        = M T / T M on the same gaps -> a 3U x 3U square
  single line     = MAKETIME, one empty box, TOMOVE -> 29U x 1U
"""
from __future__ import annotations

import os

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

from lettering import EqualLettering
from mttm import FONT_DIR, MonogramSpec, WordmarkSpec, fmt, monogram_glyphs, wordmark_glyphs

U = 100.0
REGULAR = EqualLettering(width=U, stem=12, bar=11, slab_i=False, o_style="ellipse", k_style="simple",
                         name="MTTM Lettering Regular")
HEAVY = EqualLettering(width=U, stem=22, bar=20, slab_i=False, o_style="ellipse", k_style="simple",
                       name="MTTM Lettering Heavy cut")

COLORS = {
    # name: (hex, role)
    "ink": ("#0E0E0D", "Master dark"),
    "bone": ("#EFEBE3", "Master light"),
    "stone": ("#8F8B83", "Grey for secondary text on Ink or Bone"),
    "moss": ("#1E2A23", "Interviews ground"),
    "chalk": ("#E8E6DD", "Light on Moss"),
    "lichen": ("#8C948D", "Grey on Moss"),
    "midnight": ("#121A26", "Mindset ground"),
    "mist": ("#E3E7EC", "Light on Midnight"),
    "slate": ("#87909C", "Grey on Midnight"),
    "sage": ("#B7C0AE", "Mobility ground (light)"),
    "fern": ("#5F665A", "Grey on Sage"),
    "black": ("#000000", "Utility: one-colour reproduction"),
    "white": ("#FFFFFF", "Utility: one-colour reproduction"),
}


def hexc(name):
    return COLORS[name][0]


# Themes: pillar -> (lettering colour, ground colour, grey)
THEMES = [
    dict(id="start-here", pillar="Start Here", theme="Ink & Bone (light)", fg="ink", bg="bone", grey="stone"),
    dict(id="strength", pillar="Strength", theme="Ink", fg="bone", bg="ink", grey="stone"),
    dict(id="mobility", pillar="Mobility", theme="Sage", fg="ink", bg="sage", grey="fern"),
    dict(id="mindset", pillar="Mindset", theme="Midnight", fg="mist", bg="midnight", grey="slate"),
    dict(id="interviews", pillar="Interviews", theme="Moss", fg="chalk", bg="moss", grey="lichen"),
]

# Colourways for logo exports: (slug, lettering, ground or None for transparent)
COLORWAYS = [
    ("white-on-black", "white", "black"),
    ("black-on-white", "black", "white"),
    ("bone-on-ink", "bone", "ink"),
    ("ink-on-bone", "ink", "bone"),
    ("chalk-on-moss", "chalk", "moss"),
    ("mist-on-midnight", "mist", "midnight"),
    ("ink-on-sage", "ink", "sage"),
    ("white", "white", None),
    ("black", "black", None),
    ("bone", "bone", None),
    ("ink", "ink", None),
]
CORE_WAYS = [c for c in COLORWAYS if c[0] in
             ("white-on-black", "black-on-white", "bone-on-ink", "ink-on-bone", "white", "black", "bone", "ink")]


# ---------------------------------------------------------------- merch print files
DPI = 300
MERCH = [
    # (slug, kind, lettering, print width in inches, use)
    ("front-wordmark", "wordmark", REGULAR, 11.0, "Tee / hoodie full front"),
    ("back-wordmark", "wordmark", REGULAR, 12.0, "Tee / hoodie full back"),
    ("chest-monogram", "monogram", REGULAR, 3.5, "Left chest print"),
    ("chest-monogram-embroidery", "monogram", HEAVY, 3.0, "Left chest embroidery"),
    ("hat-monogram-embroidery", "monogram", HEAVY, 2.25, "Cap / beanie front embroidery"),
    ("yoke-single-line", "single-line", REGULAR, 10.0, "Back yoke / across shoulders"),
    ("sleeve-single-line", "single-line", HEAVY, 3.5, "Sleeve or hem (heavy cut)"),
]

# ---------------------------------------------------------------- geometry
def glyphs_for(kind, lettering=REGULAR, layout="A"):
    """Glyph placements (char, cx, baseline) in unit space for a logo kind."""
    if kind == "wordmark":
        g, _ = wordmark_glyphs(lettering, WordmarkSpec(track=lettering.W, gap1=0, gap2=0,
                                                       shift=0.5 if layout == "B" else 0.0, leading=U))
        return g
    if kind == "monogram":
        g, _ = monogram_glyphs(lettering, MonogramSpec(track=lettering.W, leading=U))
        return g
    if kind == "single-line":
        step = lettering.W * 2
        return [(c, i * step, U) for i, c in enumerate("MAKETIME TOMOVE") if c != " "]
    raise KeyError(kind)


def bbox(lettering, glyphs):
    w = lettering.W
    return (min(cx for _, cx, _ in glyphs) - w / 2, min(b for _, _, b in glyphs) - U,
            max(cx for _, cx, _ in glyphs) + w / 2, max(b for _, _, b in glyphs))


def placed(kind, cx, cy, width=None, height=None, lettering=REGULAR, layout="A"):
    """Path data for a logo centred at (cx, cy), scaled to `width` (or `height`)."""
    g = glyphs_for(kind, lettering, layout)
    x0, y0, x1, y1 = bbox(lettering, g)
    s = width / (x1 - x0) if width else height / (y1 - y0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    return " ".join(lettering.path(c, cx + (x - mx) * s, cy + (b - my) * s, U * s) for c, x, b in g), s


def logo_svg(kind, fg, bg=None, lettering=REGULAR, layout="A", clear=1.0, title=None):
    """Standalone logo SVG in unit space with `clear` units of clear space."""
    g = glyphs_for(kind, lettering, layout)
    x0, y0, x1, y1 = bbox(lettering, g)
    p = clear * U
    vx, vy, vw, vh = x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p
    d = " ".join(lettering.path(c, x, b) for c, x, b in g)
    title = title or {"wordmark": "Make Time To Move", "monogram": "MTTM monogram",
                      "single-line": "Make Time To Move"}[kind]
    ground = (f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(vw)}" height="{fmt(vh)}" fill="{bg}"/>' if bg else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(vw)} {fmt(vh)}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{ground}<path fill="{fg}" d="{d}"/></svg>')


# ---------------------------------------------------------------- supporting type, outlined
class TextFace:
    def __init__(self, filename):
        self.tt = TTFont(os.path.join(FONT_DIR, filename))
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.hmtx = self.tt["hmtx"]
        from fontTools.pens.boundsPen import BoundsPen
        bp = BoundsPen(self.gs)
        self.gs[self.cmap[ord("H")]].draw(bp)
        self.H = bp.bounds[3]

    def width(self, text, cap, tracking=0.0):
        k = cap / self.H
        adv = sum(self.hmtx[self.cmap[ord(ch)]][0] for ch in text) * k
        return adv + tracking * cap * (len(text) - 1)

    def path(self, text, x, baseline, cap, tracking=0.0, anchor="start"):
        """Outlined text. tracking is extra space per letter as a fraction of cap height."""
        k = cap / self.H
        w = self.width(text, cap, tracking)
        if anchor == "middle":
            x -= w / 2
        elif anchor == "end":
            x -= w
        pen = SVGPathPen(None, ntos=fmt)
        for ch in text:
            gname = self.cmap[ord(ch)]
            self.gs[gname].draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
            x += self.hmtx[gname][0] * k + tracking * cap
        return pen.getCommands()


MICHROMA = TextFace("Michroma-Regular.ttf")
MANROPE = TextFace("Manrope-Medium.ttf")


# ---------------------------------------------------------------- colour maths for the guidelines
def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def cmyk_approx(h):
    r, g, b = (v / 255 for v in rgb(h))
    k = 1 - max(r, g, b)
    if k >= 1:
        return (0, 0, 0, 100)
    c, m, y = ((1 - v - k) / (1 - k) for v in (r, g, b))
    return tuple(round(v * 100) for v in (c, m, y, k))


def lum(h):
    c = [v / 255 for v in rgb(h)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)
