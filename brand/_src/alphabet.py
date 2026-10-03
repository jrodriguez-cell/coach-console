"""MTTM Lettering — the full brand alphabet.

Extends the logo lettering (square 1U boxes, thin monoline, circular O) to A–Z, 0–9 and the
punctuation the brand needs. Letters and figures share one box width; punctuation is narrower.

Spacing (same rule as the logo):
  gap between characters = 1 U        space between words = 3 U (gap + empty box + gap)
"""
from __future__ import annotations

import math

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from pathops import Path, PathOp, op, simplify

from lettering import EqualLettering, _poly, _rect, _rrect, _stroke, _union
from mttm import fmt

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FIGURES = "0123456789"
# punctuation: char -> ink box width (in U/100 units)
PUNCT = {".": 13, ",": 13, ":": 13, "!": 13, "?": 80, "'": 12, "’": 12, '"': 40, "-": 44, "–": 70, "—": 100,
         "/": 62, "·": 13, "@": 100, "+": 64, "#": 84, "(": 34, ")": 34, "&": 100}
CHARSET = LETTERS + FIGURES + "".join(PUNCT)


def ring(x0, y0, x1, y1, sv, sh):
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    return op(_rrect(x0, y0, x1, y1, rx, ry), _rrect(x0 + sv, y0 + sh, x1 - sv, y1 - sh, rx - sv, ry - sh),
              PathOp.DIFFERENCE)


def dshape(x0, y0, x1, y1, rx):
    """Straight left side, elliptical right side."""
    ry = (y1 - y0) / 2
    k = 0.5523
    p = Path()
    p.moveTo(x0, y0)
    p.lineTo(x1 - rx, y0)
    p.cubicTo(x1 - rx + k * rx, y0, x1, y0 + ry - k * ry, x1, y0 + ry)
    p.cubicTo(x1, y0 + ry + k * ry, x1 - rx + k * rx, y1, x1 - rx, y1)
    p.lineTo(x0, y1)
    p.close()
    return p


def dring(x0, y0, x1, y1, rx, sv, sh, open_left=False):
    inner_x0 = x0 - 20 if open_left else x0 + sv
    return op(dshape(x0, y0, x1, y1, rx), dshape(inner_x0, y0 + sh, x1 - sv, y1 - sh, rx - sv), PathOp.DIFFERENCE)


def wedge(cx, cy, a0, a1, r=200):
    pts = [(cx, cy)] + [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
                        for a in (a0, (a0 + a1) / 2, a1)]
    return _poly(pts)


def xform(path, m):
    p = Path()
    path.draw(TransformPen(p.getPen(), m))
    return p


class BrandAlphabet(EqualLettering):
    def __init__(self, stem=12.0, bar=11.0, name="MTTM Lettering"):
        super().__init__(width=100, stem=stem, bar=bar, name=name, slab_i=False, o_style="ellipse",
                         k_style="simple")

    def box(self, ch):
        return PUNCT.get(ch, 100)

    def _build(self, ch):  # noqa: C901 - one branch per glyph
        W, sv, sh = self.W, self.sv, self.sh
        box = _rect(0, 0, W, 100)

        def clip(p, b=box):
            return op(p, b, PathOp.INTERSECTION)

        def minus(a, b):
            return op(a, b, PathOp.DIFFERENCE)

        def dot(x, y, s=None):
            s = s or max(sv, 13)
            return _rect(x, y, x + s, y + s)

        if ch in "AEIKMOTV":
            return super()._build(ch)
        if ch == "B":
            return _union([_rect(0, 0, sv, 100), dring(0, 50 - sh / 2, W * 0.9, 100, 30, sv, sh),
                           dring(0, 0, W, 50 + sh / 2, 32, sv, sh)])
        if ch == "C":
            return minus(ring(0, 0, W, 100, sv, sh), wedge(50, 50, -32, 32))
        if ch == "D":
            return _union([_rect(0, 0, sv, 100), dring(0, 0, W, 100, 46, sv, sh)])
        if ch == "F":
            return _union([_rect(0, 0, sv, 100), _rect(0, 100 - sh, W, 100), _rect(0, 50 - sh / 2, W * 0.86, 50 + sh / 2)])
        if ch == "G":
            return _union([minus(ring(0, 0, W, 100, sv, sh), wedge(50, 50, 0, 38)),
                           _rect(54, 50 - sh / 2, W, 50 + sh / 2)])
        if ch == "H":
            return _union([_rect(0, 0, sv, 100), _rect(W - sv, 0, W, 100), _rect(0, 50 - sh / 2, W, 50 + sh / 2)])
        if ch == "J":
            return minus(self._build("U"), _rect(-1, 34, W / 2, 101))
        if ch == "L":
            return _union([_rect(0, 0, sv, 100), _rect(0, 0, W, sh)])
        if ch == "N":
            d = clip(_stroke((sv * 0.5, 100 + sv * 0.4), (W - sv * 0.5, -sv * 0.4), sv * 1.05))
            return _union([_rect(0, 0, sv, 100), _rect(W - sv, 0, W, 100), d])
        if ch == "P":
            return _union([_rect(0, 0, sv, 100), dring(0, 44, W, 100, 30, sv, sh)])
        if ch == "Q":
            tail = clip(_stroke((70, 24), (W + 10, -12), sv))
            return _union([self._build("O"), tail])
        if ch == "R":
            leg = op(clip(_stroke((42, 50), (W - sv * 0.55, 0), sv * 1.05)), _rect(0, 0, W, 50), PathOp.INTERSECTION)
            return _union([self._build("P"), leg])
        if ch == "S":
            cu, cl = (50 - sh / 2 + 100) / 2, (50 + sh / 2) / 2
            up = minus(ring(0, 50 - sh / 2, W, 100, sv, sh), _rect(W / 2, -1, W + 1, cu))
            lo = minus(ring(0, 0, W, 50 + sh / 2, sv, sh), _rect(-1, cl, W / 2, 101))
            return _union([up, lo])
        if ch == "U":
            return _union([_rect(0, 50, sv, 100), _rect(W - sv, 50, W, 100),
                           op(ring(0, 0, W, 100, sv, sh), _rect(0, 0, W, 50), PathOp.INTERSECTION)])
        if ch == "W":
            return xform(super()._build("M"), (1, 0, 0, -1, 0, 100))
        if ch == "X":
            return clip(_union([_stroke((sv * 0.55, 100), (W - sv * 0.55, 0), sv * 1.05),
                                _stroke((W - sv * 0.55, 100), (sv * 0.55, 0), sv * 1.05)]))
        if ch == "Y":
            arms = clip(_union([_stroke((sv * 0.55, 100), (50, 46), sv * 1.05), _stroke((W - sv * 0.55, 100), (50, 46), sv * 1.05)]))
            arms = op(arms, _rect(0, 44, W, 100), PathOp.INTERSECTION)
            return _union([arms, _rect(50 - sv / 2, 0, 50 + sv / 2, 50)])
        if ch == "Z":
            d = op(_stroke((W - sv * 0.6, 100 - sh), (sv * 0.6, sh), sv * 1.05), _rect(0, sh / 2, W, 100 - sh / 2),
                   PathOp.INTERSECTION)
            return _union([_rect(0, 100 - sh, W, 100), _rect(0, 0, W, sh), d])
        # figures
        if ch == "0":
            return op(_rrect(0, 0, W, 100, 30, 32), _rrect(sv, sh, W - sv, 100 - sh, 30 - sv, 32 - sh), PathOp.DIFFERENCE)
        if ch == "1":
            flag = clip(_stroke((50, 100 - sh * 0.5), (24, 78), sv))
            return _union([_rect(50 - sv / 2, 0, 50 + sv / 2, 100), flag])
        if ch == "2":
            cy = 72
            arc = op(ring(0, 44, W, 100, sv, sh), _rect(0, cy, W, 101), PathOp.INTERSECTION)
            diag = op(_stroke((W - sv / 2, cy), (sv * 0.6, sh / 2), sv * 1.05), _rect(0, sh / 2, W, cy), PathOp.INTERSECTION)
            return _union([arc, diag, _rect(0, 0, W, sh)])
        if ch == "3":
            return _union([dring(6, 50 - sh / 2, W * 0.92, 100, 30, sv, sh, open_left=True),
                           dring(0, 0, W, 50 + sh / 2, 32, sv, sh, open_left=True)])
        if ch == "4":
            x = 66
            diag = op(_stroke((x + sv / 2, 100), (sv * 0.5, 26 + sh / 2), sv * 1.05), _rect(0, 26, W, 100), PathOp.INTERSECTION)
            return _union([_rect(x, 0, x + sv, 100), _rect(0, 26, W, 26 + sh), diag])
        if ch == "5":
            return _union([_rect(0, 100 - sh, W, 100), _rect(0, 52, sv, 100),
                           dring(0, 0, W, 60, 34, sv, sh, open_left=True)])
        if ch == "6":
            tail = op(_stroke((sv * 0.5, 30), (W * 0.64, 100 + 8), sv * 1.05), _rect(0, 30, W, 100), PathOp.INTERSECTION)
            return _union([ring(0, 0, W, 62, sv, sh), tail])
        if ch == "7":
            d = op(_stroke((W - sv * 0.55, 100), (W * 0.3, -4), sv * 1.05), _rect(0, 0, W, 100 - sh / 2), PathOp.INTERSECTION)
            return _union([_rect(0, 100 - sh, W, 100), d])
        if ch == "8":
            return _union([ring(7, 50 - sh / 2, W - 7, 100, sv, sh), ring(0, 0, W, 50 + sh / 2, sv, sh)])
        if ch == "9":
            return xform(self._build("6"), (-1, 0, 0, -1, W, 100))
        # punctuation (ink drawn from x = 0)
        d = max(sv, 13)
        if ch == ".":
            return dot(0, 0)
        if ch == ",":
            return _union([dot(0, 0), clip(_stroke((d * 0.75, d * 0.5), (0, -16), sv * 0.8), _rect(-6, -18, d, d))])
        if ch == ":":
            return _union([dot(0, 0), dot(0, 44)])
        if ch == "·":
            return dot(0, 50 - d / 2)
        if ch == "!":
            return _union([_rect(0.5, 28, 0.5 + sv, 100), dot(0, 0)])
        if ch == "?":
            cy = 73
            r = ring(0, 46, 80, 100, sv, sh)
            arc = _union([op(r, _rect(0, cy, 80, 101), PathOp.INTERSECTION),
                          op(r, _rect(40, 0, 81, cy), PathOp.INTERSECTION)])
            return _union([arc, _rect(40 - sv / 2, 28, 40 + sv / 2, 52), dot(40 - d / 2, 0)])
        if ch in "'’":
            return _rect(0, 72, sv, 100)
        if ch == '"':
            return _union([_rect(0, 72, sv, 100), _rect(40 - sv, 72, 40, 100)])
        if ch in "-–—":
            return _rect(0, 50 - sh / 2, self.box(ch), 50 + sh / 2)
        if ch == "/":
            return op(_stroke((sv * 0.5, -4), (62 - sv * 0.5, 104), sv * 1.05), _rect(0, 0, 62, 100), PathOp.INTERSECTION)
        if ch == "+":
            return _union([_rect(0, 50 - sh / 2, 64, 50 + sh / 2), _rect(32 - sv / 2, 18, 32 + sv / 2, 82)])
        if ch == "#":
            return _union([_rect(26 - sv / 2, 8, 26 + sv / 2, 92), _rect(58 - sv / 2, 8, 58 + sv / 2, 92),
                           _rect(0, 32, 84, 32 + sh), _rect(0, 68 - sh, 84, 68)])
        if ch == "@":
            inner = ring(26, 26, 74, 74, sv, sh)
            return _union([ring(0, 0, W, 100, sv, sh), inner, _rect(74 - sv, 34, 74, 74), _rect(62, 34, W - 2, 34 + sh)])
        if ch == "&":
            top = ring(14, 50, 70, 100, sv, sh)
            low = minus(ring(0, 0, 82, 62, sv, sh), wedge(41, 31, -10, 75))
            leg = op(_stroke((24, 62), (W - sv * 0.55, 0), sv * 1.05), _rect(0, 0, W, 64), PathOp.INTERSECTION)
            arm = _rect(70, 30 - sh / 2, W, 30 + sh / 2)
            return _union([minus(top, _rect(14, 50, 42, 66)), low, leg, arm])
        if ch == "(":
            return op(ring(0, -8, 120, 108, sv, sh), _rect(0, -8, 34, 108), PathOp.INTERSECTION)
        if ch == ")":
            return xform(self._build("("), (-1, 0, 0, 1, 34, 0))
        raise KeyError(ch)

    def glyph(self, ch):
        if ch not in self._cache:
            self._cache[ch] = simplify(self._build(ch), clockwise=False)
        return self._cache[ch]


# ---------------------------------------------------------------- typesetting with the brand rhythm
class BrandFace:
    """Outlined text in MTTM Lettering. Interface matches system.TextFace.

    tracking: extra gap as a fraction of cap height on top of the 1 U rhythm (negative tightens).
    """

    def __init__(self, alphabet: BrandAlphabet):
        self.a = alphabet

    def _norm(self, text):
        return text.upper()

    def _advances(self, text, tracking):
        gap = 100 * (1 + tracking)
        out = []
        for ch in self._norm(text):
            if ch == " ":
                out.append((None, 100 + gap))   # one empty box + its gap -> 3 U between words at tracking 0
            else:
                out.append((ch, self.a.box(ch) + gap))
        return out, gap

    def width(self, text, cap, tracking=0.0):
        adv, gap = self._advances(text, tracking)
        return (sum(a for _, a in adv) - gap) * cap / 100

    def path(self, text, x, baseline, cap, tracking=0.0, anchor="start"):
        k = cap / 100
        w = self.width(text, cap, tracking)
        x -= {"middle": w / 2, "end": w}.get(anchor, 0)
        adv, _ = self._advances(text, tracking)
        pen = SVGPathPen(None, ntos=fmt)
        for ch, a in adv:
            if ch:
                self.a.glyph(ch).draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
            x += a * k
        return pen.getCommands()


REGULAR_ALPHABET = BrandAlphabet(12, 11, "MTTM Lettering")
HEAVY_ALPHABET = BrandAlphabet(22, 20, "MTTM Lettering Heavy")
BRAND = BrandFace(REGULAR_ALPHABET)
BRAND_HEAVY = BrandFace(HEAVY_ALPHABET)
