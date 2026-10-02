"""MAKE TIME TO MOVE — wordmark / monogram geometry engine.

Every letter is converted to outlined paths (no font dependency in output SVGs)
and centred on a fixed letter grid. Units: cap height H = 100.

Grid model
----------
Each letter occupies one cell of width `step` and is centred (by ink bounds) in
it. Word gaps are expressed as extra cells (0, 0.5, 1 ...). Line 2 is placed
relative to line 1 by `shift` (in steps) from its centred position:
  shift = 0   -> centred
  shift = 0.5 -> offset half a letter-step ("nested" when geometry allows)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")

FONTS = {
    "michroma": ("Michroma", "Michroma-Regular.ttf"),
    "syncopate": ("Syncopate Bold", "Syncopate-Bold.ttf"),
    "archivo": ("Archivo Expanded SemiBold", "ArchivoExpanded-SemiBold.ttf"),
    "unbounded": ("Unbounded SemiBold", "Unbounded-SemiBold.ttf"),
}

LETTERS = "MAKETIOV"


def fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class Font:
    def __init__(self, key: str):
        self.key = key
        self.name, fn = FONTS[key]
        self.tt = TTFont(os.path.join(FONT_DIR, fn))
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.H = self._bounds("H")[3]
        self.scale = 100.0 / self.H
        self.widest = max(self.ink_width(c) for c in LETTERS)

    def _bounds(self, ch):
        p = BoundsPen(self.gs)
        self.gs[self.cmap[ord(ch)]].draw(p)
        return p.bounds

    def ink_width(self, ch) -> float:
        b = self._bounds(ch)
        return (b[2] - b[0]) * self.scale

    def path(self, ch: str, cx: float, baseline: float, size: float = 100.0) -> str:
        """SVG path data for `ch` with ink centred on cx, sitting on baseline,
        cap height = size."""
        b = self._bounds(ch)
        k = self.scale * size / 100.0
        ink_cx = (b[0] + b[2]) / 2
        pen = SVGPathPen(None, ntos=fmt)
        # x' = k*(x - ink_cx) + cx ; y' = baseline - k*y
        tp = TransformPen(pen, (k, 0, 0, -k, cx - k * ink_cx, baseline))
        self.gs[self.cmap[ord(ch)]].draw(tp)
        return pen.getCommands()


@dataclass
class WordmarkSpec:
    track: float = 55.0       # space added to the widest glyph to form the step
    gap1: float = 1.0         # extra cells at word break, line 1 (MAKE TIME)
    gap2: float = 1.0         # extra cells at word break, line 2 (TO MOVE)
    shift: float = 0.0        # line-2 offset from centred, in steps
    leading: float = 80.0     # vertical gap between lines (cap-height units)
    lines: tuple = (("MAKE", "TIME"), ("TO", "MOVE"))


def line_positions(words, gap):
    xs, x = [], 0.0
    for wi, w in enumerate(words):
        if wi:
            x += gap
        for ch in w:
            xs.append((ch, x))
            x += 1
    return xs  # positions in steps, first letter at 0


def wordmark_glyphs(font: Font, spec: WordmarkSpec):
    """Return list of (char, cx, baseline) plus bbox (x0, y0, x1, y1)."""
    step = font.widest + spec.track
    l1 = line_positions(spec.lines[0], spec.gap1)
    l2 = line_positions(spec.lines[1], spec.gap2)
    span1 = l1[-1][1]
    span2 = l2[-1][1]
    start2 = (span1 - span2) / 2 + spec.shift
    out = [(c, x * step, 100.0) for c, x in l1]
    out += [(c, (x + start2) * step, 200.0 + spec.leading) for c, x in l2]
    return out, step


def bbox_of(font: Font, glyphs, size=100.0):
    x0 = min(cx - font.ink_width(c) * size / 200 for c, cx, _ in glyphs)
    x1 = max(cx + font.ink_width(c) * size / 200 for c, cx, _ in glyphs)
    y0 = min(b - size for _, _, b in glyphs)
    y1 = max(b for _, _, b in glyphs)
    return x0, y0, x1, y1


def svg_doc(paths: str, bbox, pad, fg, bg, title, pad_y=None, extra="", post="") -> str:
    x0, y0, x1, y1 = bbox
    py = pad if pad_y is None else pad_y
    vx, vy = x0 - pad, y0 - py
    vw, vh = (x1 - x0) + 2 * pad, (y1 - y0) + 2 * py
    bg_rect = (
        f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(vw)}" height="{fmt(vh)}" fill="{bg}"/>'
        if bg
        else ""
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(vw)} {fmt(vh)}" '
        f'role="img" aria-label="{title}">'
        f"<title>{title}</title>{bg_rect}{extra}"
        f'<path fill="{fg}" d="{paths}"/>{post}</svg>'
    )


def grid_overlay(glyphs, bbox, pad):
    """Hairlines through every letter-cell centre (line 1 solid, line 2 dashed)."""
    x0, y0, x1, y1 = bbox
    out = ['<g class="grid" fill="none" stroke="#9a9a9a" stroke-width="4">']
    for c, cx, b in glyphs:
        dash = ' stroke-dasharray="14 10"' if b > 150 else ""
        out.append(
            f'<line x1="{fmt(cx)}" y1="{fmt(y0 - pad * 0.6)}" x2="{fmt(cx)}" y2="{fmt(y1 + pad * 0.6)}"{dash}/>'
        )
    out.append("</g>")
    return "".join(out)


def wordmark_svg(font: Font, spec: WordmarkSpec, fg="#FFFFFF", bg="#000000", pad=None, overlay=False):
    glyphs, step = wordmark_glyphs(font, spec)
    d = " ".join(font.path(c, cx, b) for c, cx, b in glyphs)
    bb = bbox_of(font, glyphs)
    pad = 100.0 if pad is None else pad  # clear space = 1 cap height
    post = grid_overlay(glyphs, bb, pad) if overlay else ""
    return svg_doc(d, bb, pad, fg, bg, "Make Time To Move", post=post)


@dataclass
class MonogramSpec:
    track: float = 55.0
    leading: float = 80.0
    rows: tuple = ("MT", "TM")


def monogram_glyphs(font: Font, spec: MonogramSpec):
    step = font.widest + spec.track
    out = []
    for r, row in enumerate(spec.rows):
        for i, ch in enumerate(row):
            out.append((ch, i * step, 100.0 + r * (100.0 + spec.leading)))
    return out, step
