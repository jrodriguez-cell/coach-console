"""MTTM custom lettering — equal-width caps drawn in the manner of Michroma.

Every letter has the same ink width (W) and the same cap height (100), so with a
fixed letter-step every gap between letters is identical, and the M T / T M
monogram forms a true square grid.

Traits carried over from Michroma: monoline weight (vertical stems ~12% of cap
height, horizontals slightly lighter), flat-cut apex/vertex on A, M and V, a
rounded-square O, and K's arms springing from a short horizontal stub.

Exposes the same interface as mttm.Font (ink_width, path, widest, name) so the
wordmark/monogram layout code is shared.
"""
from __future__ import annotations

import math

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from pathops import Path, PathOp, op

from mttm import fmt

K_CIRCLE = 0.5523


def _poly(pts) -> Path:
    p = Path()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    return p


def _rect(x0, y0, x1, y1) -> Path:
    return _poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def _stroke(p, q, t, ext=40) -> Path:
    """Straight stroke of perpendicular thickness t along p->q, extended past both
    ends (later clipped to the cap box for flat-cut terminals)."""
    (x0, y0), (x1, y1) = p, q
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy * t / 2, ux * t / 2
    a = (x0 - ux * ext, y0 - uy * ext)
    b = (x1 + ux * ext, y1 + uy * ext)
    return _poly([(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)])


def _rrect(x0, y0, x1, y1, rx, ry) -> Path:
    kx, ky = rx * K_CIRCLE, ry * K_CIRCLE
    p = Path()
    p.moveTo(x0 + rx, y0)
    p.lineTo(x1 - rx, y0)
    p.cubicTo(x1 - rx + kx, y0, x1, y0 + ry - ky, x1, y0 + ry)
    p.lineTo(x1, y1 - ry)
    p.cubicTo(x1, y1 - ry + ky, x1 - rx + kx, y1, x1 - rx, y1)
    p.lineTo(x0 + rx, y1)
    p.cubicTo(x0 + rx - kx, y1, x0, y1 - ry + ky, x0, y1 - ry)
    p.lineTo(x0, y0 + ry)
    p.cubicTo(x0, y0 + ry - ky, x0 + rx - kx, y0, x0 + rx, y0)
    p.close()
    return p


def _union(paths) -> Path:
    acc = Path()
    for p in paths:
        acc = op(acc, p, PathOp.UNION)
    return acc


class EqualLettering:
    def __init__(self, width=136.0, stem=12.0, bar=11.0, name="MTTM Equal (Michroma weight)", slab_i=True):
        self.W, self.sv, self.sh = width, stem, bar
        self.name = name
        self.slab_i = slab_i
        self.widest = width
        self._cache = {}

    # --- glyph construction (y up, x in [0, W], y in [0, 100])
    def _build(self, ch) -> Path:
        W, sv, sh = self.W, self.sv, self.sh
        box = _rect(0, 0, W, 100)
        clip = lambda p: op(p, box, PathOp.INTERSECTION)
        if ch == "E":
            return _union([_rect(0, 0, sv, 100), _rect(0, 100 - sh, W, 100), _rect(0, 0, W, sh),
                           _rect(0, 50 - sh / 2, W * 0.92, 50 + sh / 2)])
        if ch == "T":
            return _union([_rect(0, 100 - sh, W, 100), _rect(W / 2 - sv / 2, 0, W / 2 + sv / 2, 100)])
        if ch == "I":
            parts = [_rect(W / 2 - sv / 2, 0, W / 2 + sv / 2, 100)]
            if self.slab_i:
                parts += [_rect(0, 100 - sh, W, 100), _rect(0, 0, W, sh)]
            return _union(parts)
        if ch == "O":
            outer = _rrect(0, 0, W, 100, 40, 44)
            inner = _rrect(sv, sh, W - sv, 100 - sh, 40 - sv, 44 - sh)
            return op(outer, inner, PathOp.DIFFERENCE)
        if ch == "M":
            v = 9.0  # height of the flat vertex
            d1 = _stroke((sv * 0.5, 100 + sv * 0.55), (W / 2, v - sv * 0.2), sv)
            d2 = _stroke((W - sv * 0.5, 100 + sv * 0.55), (W / 2, v - sv * 0.2), sv)
            body = clip(_union([d1, d2]))
            body = op(body, _rect(0, v, W, 100), PathOp.INTERSECTION)
            return _union([_rect(0, 0, sv, 100), _rect(W - sv, 0, W, 100), body])
        if ch == "V":
            flat = 15.0
            d1 = _stroke((sv * 0.55, 100), (W / 2 - flat / 2 + sv * 0.55, 0), sv)
            d2 = _stroke((W - sv * 0.55, 100), (W / 2 + flat / 2 - sv * 0.55, 0), sv)
            return clip(_union([d1, d2]))
        if ch == "A":
            flat = 15.0
            d1 = _stroke((sv * 0.55, 0), (W / 2 - flat / 2 + sv * 0.55, 100), sv)
            d2 = _stroke((W - sv * 0.55, 0), (W / 2 + flat / 2 - sv * 0.55, 100), sv)
            legs = clip(_union([d1, d2]))
            # crossbar only between the legs
            bar = op(_rect(0, 24, W, 24 + sh), _poly([(0, 0), (W, 0), (W / 2, 100)]), PathOp.INTERSECTION)
            return _union([legs, bar])
        if ch == "K":
            j = sv + W * 0.11  # end of the horizontal stub
            t = sv * 1.05
            tip = (W - sv * 0.6, 100)
            # stub height = the arms' vertical thickness where they leave it, so the join is flush
            half = t / 2 / math.cos(math.atan2(tip[1] - 50, tip[0] - j))
            stub = _rect(0, 50 - half, j, 50 + half)
            arm = _stroke((j, 50), tip, t)
            leg = _stroke((j, 50), (tip[0], 0), t)
            arms = op(clip(_union([arm, leg])), _rect(j, 0, W, 100), PathOp.INTERSECTION)
            return _union([_rect(0, 0, sv, 100), stub, arms])
        raise KeyError(ch)

    def glyph(self, ch) -> Path:
        if ch not in self._cache:
            self._cache[ch] = self._build(ch)
        return self._cache[ch]

    # --- mttm.Font-compatible interface
    def ink_width(self, ch) -> float:
        return self.W

    def path(self, ch, cx, baseline, size=100.0) -> str:
        k = size / 100.0
        pen = SVGPathPen(None, ntos=fmt)
        tp = TransformPen(pen, (k, 0, 0, -k, cx - k * self.W / 2, baseline))
        self.glyph(ch).draw(tp)
        return pen.getCommands()
