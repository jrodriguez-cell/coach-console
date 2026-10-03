"""Merchandise mockups for Make Time To Move.

Every garment is drawn in real inches (adult size L) inside an SVG whose
viewBox is in inches, so the supplied merch artwork can be placed at its true
print width. The logo is never redrawn: the supplied file from brand/merch/ is
embedded unchanged as a nested <svg> (same viewBox, same path, same fill),
only given a position and its print width.

usage: python3 build_mockups.py [names...]   (no names = build everything)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

BRAND = Path(__file__).resolve().parent.parent
MERCH = BRAND / "merch"
OUT = MERCH / "mockups"

INK, BONE, STONE = "#0E0E0D", "#EFEBE3", "#8F8B83"
MOSS, CHALK = "#1E2A23", "#E8E6DD"
MIDNIGHT, MIST = "#121A26", "#E3E7EC"
SAGE = "#B7C0AE"

PX_WIDTH = 2400  # every PNG is rendered 2400 px wide


# ---------------------------------------------------------------- helpers
def mix(a, b, t):
    """Blend hex colour a toward b by t (0..1). Used only for garment tones."""
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(pa, pb))


def tones(base):
    """Tonal shades of one garment colour: folds, seams and stitching."""
    dark = base in (INK, MOSS, MIDNIGHT)
    return {
        "base": base,
        "hi": mix(base, "#FFFFFF", 0.07 if dark else 0.22),
        "lo": mix(base, "#000000", 0.45 if dark else 0.10),
        "seam": mix(base, "#000000", 0.6) if dark else mix(base, "#000000", 0.16),
        "stitch": mix(base, "#FFFFFF", 0.13) if dark else mix(base, "#000000", 0.20),
        "inside": mix(base, "#000000", 0.55 if dark else 0.11),
        "edge": mix(base, "#000000", 0.0) if dark else mix(base, "#000000", 0.14),
    }


def logo(placement, colour, x, y, width, fill=None):
    """Embed the supplied merch SVG unchanged, at (x, y) inches, `width` inches wide.

    `fill` swaps only the fill colour, for the approved pairs that have no
    merch file of their own (Chalk on Moss, Mist on Midnight). Geometry is untouched.
    """
    src = MERCH / placement / f"mttm-merch-{placement}-{colour}.svg"
    svg = src.read_text().strip()
    if fill:
        svg = re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{fill}"', svg)
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    height = width * vb[3] / vb[2]
    nested = svg.replace(
        "<svg ", f'<svg x="{x:.4f}" y="{y:.4f}" width="{width:.4f}" height="{height:.4f}" ', 1
    )
    note = f" · fill {fill}" if fill else ""
    return f"<!-- {src.relative_to(BRAND)}{note} · print width {width} in -->\n{nested}", height


def doc(w, h, bg, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" '
        f'aria-label="{title}"><title>{title}</title>\n'
        "<defs>"
        '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%">'
        '<feGaussianBlur stdDeviation="0.35"/></filter>'
        '<filter id="softer" x="-50%" y="-50%" width="200%" height="200%">'
        '<feGaussianBlur stdDeviation="0.18"/></filter>'
        "</defs>\n"
        f'<rect width="{w}" height="{h}" fill="{bg}"/>\n{body}\n</svg>\n'
    )


def stitch(d, t, w=0.035, dash="0.16 0.09", opacity=0.9):
    return (f'<path d="{d}" fill="none" stroke="{t["stitch"]}" stroke-width="{w}" '
            f'stroke-dasharray="{dash}" stroke-linecap="round" opacity="{opacity}"/>')


def line(d, colour, w=0.03, opacity=1.0):
    return (f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round" opacity="{opacity}"/>')


def fold(d, colour, opacity, filt="soft"):
    return f'<path d="{d}" fill="{colour}" opacity="{opacity}" filter="url(#{filt})"/>'


# ---------------------------------------------------------------- t-shirt
TEE_W, TEE_H = 38.0, 36.0


def tee(colour, view):
    """Adult L tee, flat front view. Body 20 in wide, 29 in long from the high point of shoulder."""
    t = tones(colour)
    cx, y0 = TEE_W / 2, 3.0           # centre line, high point of shoulder (HPS)
    half = 10.0                       # half body width (20 in)
    hem = y0 + 29.0
    neck = 3.6                        # half neck width at HPS
    sh_x, sh_y = 9.7, y0 + 1.55       # shoulder point (19.4 in across)
    arm_y = y0 + 9.6                  # underarm
    # sleeve: 8.5 in along the top, opening 7.4 in, angled down ~38 degrees
    sl_top = (sh_x + 6.55, sh_y + 5.35)
    sl_bot = (half + 2.05, arm_y + 2.05)
    front_drop = 3.55 if view == "front" else 0.9  # neckline depth below HPS
    rib = 0.85

    def mirror(pts):
        return [(cx - x, y) for x, y in pts], [(cx + x, y) for x, y in pts]

    L = lambda x: cx - x
    R = lambda x: cx + x

    body = (
        f"M {L(neck)} {y0} "
        f"Q {L(neck) - 3} {y0 + 0.75} {L(sh_x)} {sh_y} "
        f"L {L(sl_top[0])} {sl_top[1]} "
        f"L {L(sl_bot[0])} {sl_bot[1]} "
        f"Q {L(half) - 0.2} {arm_y + 0.6} {L(half)} {arm_y} "
        f"C {L(half) + 0.05} {arm_y + 7} {L(half) - 0.15} {hem - 8} {L(half) - 0.1} {hem} "
        f"Q {cx} {hem + 0.25} {R(half) + 0.1} {hem} "
        f"C {R(half) + 0.15} {hem - 8} {R(half) - 0.05} {arm_y + 7} {R(half)} {arm_y} "
        f"Q {R(half) + 0.2} {arm_y + 0.6} {R(sl_bot[0])} {sl_bot[1]} "
        f"L {R(sl_top[0])} {sl_top[1]} "
        f"L {R(sh_x)} {sh_y} "
        f"Q {R(neck) + 3} {y0 + 0.75} {R(neck)} {y0} Z"
    )
    out = [f'<path d="{body}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.04" stroke-linejoin="round"/>']

    # ---- soft tonal folds (kept well away from the print area), clipped to the garment
    out.append(f'<clipPath id="teeclip"><path d="{body}"/></clipPath><g clip-path="url(#teeclip)">')
    for s in (-1, 1):
        X = lambda x: cx + s * x
        out.append(fold(f"M {X(9.95)} {arm_y + 0.2} Q {X(8.2)} {arm_y + 2.2} {X(6.6)} {arm_y + 4.4} "
                        f"Q {X(8.4)} {arm_y + 2.9} {X(9.95)} {arm_y + 1.6} Z", t["lo"], 0.55))
        out.append(fold(f"M {X(9.9)} {arm_y + 1.9} Q {X(8.9)} {arm_y + 4} {X(8.3)} {arm_y + 6.4} "
                        f"Q {X(9.2)} {arm_y + 4.4} {X(9.95)} {arm_y + 3.2} Z", t["hi"], 0.7))
        out.append(fold(f"M {X(9.9)} {hem - 6.5} Q {X(8.6)} {hem - 3.2} {X(8.9)} {hem - 0.3} "
                        f"Q {X(9.6)} {hem - 3.4} {X(9.95)} {hem - 6.0} Z", t["lo"], 0.45))
        out.append(fold(f"M {X(3.2)} {hem - 0.2} Q {X(3.9)} {hem - 3.6} {X(4.9)} {hem - 6.2} "
                        f"Q {X(4.3)} {hem - 3.2} {X(4.0)} {hem - 0.2} Z", t["hi"], 0.55))
        out.append(fold(f"M {X(sh_x + 1.3)} {sh_y + 1.6} Q {X(sh_x + 3.4)} {sh_y + 3.4} {X(sl_top[0] - 0.7)} {sl_top[1] + 1.4} "
                        f"Q {X(sh_x + 3.2)} {sh_y + 2.5} {X(sh_x + 1.5)} {sh_y + 0.9} Z", t["hi"], 0.6))
        out.append(fold(f"M {X(half + 0.6)} {arm_y + 0.4} Q {X(half + 1.6)} {arm_y} {X(sl_bot[0] + 0.3)} {sl_bot[1] - 1.2} "
                        f"Q {X(half + 1.3)} {arm_y + 1.0} {X(half + 0.4)} {arm_y + 1.2} Z", t["lo"], 0.5))

    out.append("</g>")

    # ---- seams and stitching
    for s in (-1, 1):
        X = lambda x: cx + s * x
        # shoulder seam (sits just behind the top edge in a flat front view)
        out.append(line(f"M {X(neck + 0.15)} {y0 + 0.12} Q {X(neck + 3)} {y0 + 0.85} {X(sh_x)} {sh_y}", t["seam"], 0.03, 0.8))
        # armhole seam
        out.append(line(f"M {X(sh_x)} {sh_y} Q {X(sh_x + 0.45)} {sh_y + 4.6} {X(half)} {arm_y}", t["seam"], 0.035))
        out.append(stitch(f"M {X(sh_x - 0.14)} {sh_y + 0.05} Q {X(sh_x + 0.28)} {sh_y + 4.6} {X(half - 0.15)} {arm_y - 0.05}", t))
        # sleeve hem: double needle 1 in from the opening
        ax, ay = sl_top
        bx, by = sl_bot
        ux, uy = (ax - sh_x), (ay - sh_y)
        n = (ux ** 2 + uy ** 2) ** 0.5
        ux, uy = ux / n, uy / n
        for off in (0.85, 1.0):
            p1 = (ax - ux * off, ay - uy * off)
            p2 = (bx - ux * off * 1.02, by - uy * off * 1.02 + 0.1)
            out.append(stitch(f"M {X(p1[0])} {p1[1]} L {X(p2[0])} {p2[1]}", t))
    # body hem: double needle 1 in from the bottom
    for off in (0.85, 1.0):
        out.append(stitch(f"M {cx - half + 0.05} {hem - off} Q {cx} {hem - off + 0.25} {cx + half - 0.05} {hem - off}", t))

    # ---- collar
    fn = front_drop
    outer = f"M {L(neck)} {y0} C {L(neck) + 0.2} {y0 + fn * 0.75} {L(1.6)} {y0 + fn} {cx} {y0 + fn} C {R(1.6)} {y0 + fn} {R(neck) - 0.2} {y0 + fn * 0.75} {R(neck)} {y0}"
    ir = neck - rib * 0.75
    idrop = fn - rib
    inner = f"M {L(ir)} {y0 + 0.08} C {L(ir) + 0.2} {y0 + idrop * 0.75} {L(1.4)} {y0 + idrop} {cx} {y0 + idrop} C {R(1.4)} {y0 + idrop} {R(ir) - 0.2} {y0 + idrop * 0.75} {R(ir)} {y0 + 0.08}"
    back = f"M {L(ir)} {y0 + 0.08} C {L(ir) - 0.1} {y0 - 0.45} {R(ir) + 0.1} {y0 - 0.45} {R(ir)} {y0 + 0.08}"
    if view == "front":
        # inside of the back (visible through the neck opening), then the back rib, then the front rib
        back_rib_top = f"M {L(neck)} {y0} C {L(neck) - 0.1} {y0 - 0.8} {R(neck) + 0.1} {y0 - 0.8} {R(neck)} {y0}"
        out.append(f'<path d="{back_rib_top} L {R(ir)} {y0 + 0.08} C {R(ir) + 0.1} {y0 - 0.45} {L(ir) - 0.1} {y0 - 0.45} {L(ir)} {y0 + 0.08} Z" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.04"/>')
        hole = (f"M {L(ir)} {y0 + 0.08} C {L(ir) - 0.1} {y0 - 0.45} {R(ir) + 0.1} {y0 - 0.45} {R(ir)} {y0 + 0.08} "
                f"C {R(ir) - 0.2} {y0 + idrop * 0.75} {R(1.4)} {y0 + idrop} {cx} {y0 + idrop} "
                f"C {L(1.4)} {y0 + idrop} {L(ir) + 0.2} {y0 + idrop * 0.75} {L(ir)} {y0 + 0.08} Z")
        out.append(f'<path d="{hole}" fill="{t["inside"]}"/>')
    # front rib band
    band = (outer + f" L {R(ir)} {y0 + 0.08} "
            f"C {R(ir) - 0.2} {y0 + idrop * 0.75} {R(1.4)} {y0 + idrop} {cx} {y0 + idrop} "
            f"C {L(1.4)} {y0 + idrop} {L(ir) + 0.2} {y0 + idrop * 0.75} {L(ir)} {y0 + 0.08} Z")
    out.append(f'<path d="{band}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.04"/>')
    # rib texture: short lines across the band
    ribs = []
    import math
    def bez(p0, p1, p2, p3, u):
        return tuple((1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u ** 2 * c + u ** 3 * d
                     for a, b, c, d in zip(p0, p1, p2, p3))
    o_l = ((L(neck), y0), (L(neck) + 0.2, y0 + fn * 0.75), (L(1.6), y0 + fn), (cx, y0 + fn))
    i_l = ((L(ir), y0 + 0.08), (L(ir) + 0.2, y0 + idrop * 0.75), (L(1.4), y0 + idrop), (cx, y0 + idrop))
    N = 46
    for k in range(1, N):
        u = k / N
        po, pi = bez(*o_l, u), bez(*i_l, u)
        for s in (-1, 1):
            ribs.append(f"M {cx + s * (po[0] - cx):.3f} {po[1]:.3f} L {cx + s * (pi[0] - cx):.3f} {pi[1]:.3f}")
    out.append(line(" ".join(ribs), t["lo"], 0.022, 0.55))
    out.append(line(outer, t["seam"], 0.035))
    # coverstitch below the collar seam
    cs = f"M {L(neck) - 0.25} {y0 + 0.05} C {L(neck) - 0.05} {y0 + fn * 0.8 + 0.3} {L(1.7)} {y0 + fn + 0.28} {cx} {y0 + fn + 0.28} C {R(1.7)} {y0 + fn + 0.28} {R(neck) + 0.05} {y0 + fn * 0.8 + 0.3} {R(neck) + 0.25} {y0 + 0.05}"
    out.append(stitch(cs, t))

    collar_bottom = y0 + fn
    return "\n".join(out), {"cx": cx, "collar": collar_bottom, "y0": y0, "hem": hem}


# ---------------------------------------------------------------- cap
CAP_W, CAP_H = 14.0, 11.0


def cap(colour):
    """Six-panel structured cap, front view. Front panels 5 in tall, crown ~7.8 in wide."""
    t = tones(colour)
    cx = CAP_W / 2
    base_y = 8.0          # crown base at the centre front (top of brim)
    top_y = base_y - 5.0  # 5 in front panel
    hw = 3.95             # half crown width at the base
    side_y = base_y - 0.55

    crown = (f"M {cx - hw} {side_y} "
             f"C {cx - hw - 0.15} {top_y + 1.6} {cx - 2.4} {top_y - 0.05} {cx} {top_y - 0.05} "
             f"C {cx + 2.4} {top_y - 0.05} {cx + hw + 0.15} {top_y + 1.6} {cx + hw} {side_y} "
             f"L {cx + hw} {side_y + 0.35} Q {cx} {base_y + 1.0} {cx - hw} {side_y + 0.35} Z")  # tucked behind the brim
    out = [f'<path d="{crown}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.03" stroke-linejoin="round"/>']

    # soft tonal shaping of the crown (no tone inside the logo's clear space)
    out.append(f'<clipPath id="crownclip"><path d="{crown}"/></clipPath>')
    out.append('<g clip-path="url(#crownclip)">')
    for s in (-1, 1):
        X = lambda x: cx + s * x
        out.append(fold(f"M {X(hw + 0.3)} {side_y + 0.4} C {X(hw - 0.2)} {top_y + 2.4} {X(3.0)} {top_y + 0.7} {X(2.3)} {top_y + 0.4} "
                        f"C {X(3.0)} {top_y + 1.6} {X(3.35)} {top_y + 3.3} {X(3.3)} {side_y + 0.4} Z",
                        t["lo"] if s < 0 else t["hi"], 0.55 if s < 0 else 0.45, "softer"))
    out.append(fold(f"M {cx - 1.6} {top_y + 0.25} Q {cx} {top_y - 0.05} {cx + 1.6} {top_y + 0.25} Q {cx} {top_y + 0.55} {cx - 1.6} {top_y + 0.25} Z", t["hi"], 0.5, "softer"))
    out.append("</g>")

    # panel seams: centre front seam fades out above the logo's clear space
    clear_top = base_y - 0.75 - 2.25 - 0.75
    out.append(f'<linearGradient id="seamfade" x1="0" y1="{top_y}" x2="0" y2="{clear_top}" gradientUnits="userSpaceOnUse">'
               f'<stop offset="0" stop-color="#fff"/><stop offset="0.75" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
               f'<mask id="seammask" maskUnits="userSpaceOnUse" x="0" y="0" width="{CAP_W}" height="{CAP_H}">'
               f'<rect x="0" y="0" width="{CAP_W}" height="{clear_top}" fill="url(#seamfade)"/></mask>')
    out.append(f'<g mask="url(#seammask)">{line(f"M {cx} {top_y + 0.1} L {cx} {base_y}", t["seam"], 0.035)}'
               f'{stitch(f"M {cx - 0.09} {top_y + 0.25} L {cx - 0.09} {base_y}", t, 0.025, "0.1 0.06")}'
               f'{stitch(f"M {cx + 0.09} {top_y + 0.25} L {cx + 0.09} {base_y}", t, 0.025, "0.1 0.06")}</g>')
    for s in (-1, 1):
        X = lambda x: cx + s * x
        d = f"M {X(0.15)} {top_y} C {X(1.7)} {top_y + 0.25} {X(2.85)} {top_y + 2.0} {X(2.95)} {base_y - 0.18}"
        out.append(line(d, t["seam"], 0.035))
        out.append(stitch(f"M {X(0.3)} {top_y + 0.12} C {X(1.75)} {top_y + 0.4} {X(2.72)} {top_y + 2.05} {X(2.8)} {base_y - 0.15}", t, 0.025, "0.1 0.06"))
        out.append(stitch(f"M {X(0.15)} {top_y + 0.2} C {X(1.9)} {top_y + 0.35} {X(3.0)} {top_y + 1.95} {X(3.1)} {base_y - 0.22}", t, 0.025, "0.1 0.06"))
        # eyelet on the side panel
        ex, ey = X(3.05), top_y + 1.75
        out.append(f'<ellipse cx="{ex}" cy="{ey}" rx="0.11" ry="0.13" fill="{t["inside"]}" stroke="{t["stitch"]}" stroke-width="0.035"/>')
    # button
    out.append(f'<ellipse cx="{cx}" cy="{top_y + 0.02}" rx="0.36" ry="0.15" fill="{t["base"]}" stroke="{t["seam"]}" stroke-width="0.03"/>')
    out.append(f'<ellipse cx="{cx}" cy="{top_y - 0.03}" rx="0.22" ry="0.06" fill="{t["hi"]}" opacity="0.8"/>')

    # brim: pre-curved, projecting toward the viewer, seen slightly from above
    bw = hw + 0.35
    back_y = lambda u: side_y + 0.05 + (base_y + 0.08 - side_y - 0.05) * (1 - u * u)
    front_y = base_y + 1.5
    front = lambda u: side_y + 0.15 + (front_y - side_y - 0.15) * (1 - u * u) ** 0.55
    us = [i / 60 * 2 - 1 for i in range(61)]
    pt = lambda u, y: f"{cx + u * bw:.3f} {y:.3f}"
    brim = ("M " + " L ".join(pt(u, back_y(u)) for u in us) + " L "
            + " L ".join(pt(u, front(u)) for u in reversed(us)) + " Z")
    under = ("M " + " L ".join(pt(u, front(u)) for u in us) + " L "
             + " L ".join(pt(u * 0.995, front(u) + 0.15 * (1 - u * u) ** 0.5) for u in reversed(us)) + " Z")
    out.append(f'<path d="{under}" fill="{t["lo"]}" stroke="{t["edge"]}" stroke-width="0.03" stroke-linejoin="round"/>')
    out.append(f'<path d="{brim}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.03" stroke-linejoin="round"/>')
    out.append(f'<clipPath id="brimclip"><path d="{brim}"/></clipPath><g clip-path="url(#brimclip)">')
    out.append(fold(f"M {cx - 2.4} {base_y + 0.55} Q {cx} {base_y + 0.85} {cx + 2.4} {base_y + 0.55} Q {cx} {base_y + 1.15} {cx - 2.4} {base_y + 0.55} Z", t["hi"], 0.55, "softer"))
    out.append(fold(f"M {cx - bw} {side_y} L {cx - bw + 0.9} {side_y} L {cx - bw + 0.6} {base_y + 1.4} L {cx - bw} {base_y + 1.4} Z", t["lo"], 0.5, "softer"))
    out.append("</g>")
    # brim stitch rows (8 rows, as on a classic cap), interpolated between the edges
    for k in range(8):
        f = 0.22 + k * 0.09
        ur = [u * 0.94 for u in us]
        d = "M " + " L ".join(pt(u, back_y(u) + (front(u) - back_y(u)) * f) for u in ur)
        out.append(stitch(d, t, 0.022, "0.09 0.05", 0.85))
    # crown/brim seam
    out.append(line(f"M {cx - hw} {side_y} Q {cx} {base_y + 0.55} {cx + hw} {side_y}", t["seam"], 0.04))

    return "\n".join(out), {"cx": cx, "base": base_y, "top": top_y}


# ---------------------------------------------------------------- hoodie
HOOD_W, HOOD_H = 76.0, 47.0


def rib_lines(x0, y0, x1, y1, t, vertical=True, step=0.28):
    """Fine rib texture inside a rectangle-ish band."""
    d = []
    if vertical:
        x = x0 + step / 2
        while x < x1:
            d.append(f"M {x:.3f} {y0 + 0.08:.3f} L {x:.3f} {y1 - 0.08:.3f}")
            x += step
    else:
        y = y0 + step / 2
        while y < y1:
            d.append(f"M {x0 + 0.08:.3f} {y:.3f} L {x1 - 0.08:.3f} {y:.3f}")
            y += step
    return line(" ".join(d), t["lo"], 0.03, 0.6)


def hoodie(colour, view):
    """Adult L pullover hoodie, laid flat with the sleeves straight out so a
    print can run across the back and into both sleeves. Body 22 in wide,
    28 in long from the high point of shoulder, dropped shoulder seam."""
    t = tones(colour)
    cx, y0 = HOOD_W / 2, 16.0
    neck = 4.3
    # dropped shoulder seam, centred in the letter gap between K and E of the 40 in back print (27 U wide)
    seam_x, seam_y = 20.0 - 5.5 * 40.0 / 27, y0 + 1.3
    half = 11.0
    arm_y = y0 + 11.6                     # underarm
    sl_end = seam_x + 20.5                # start of the cuff
    cuff_len, cuff_h = 3.0, 4.6
    sl_top_end = y0 + 1.75
    band_top, hem = y0 + 25.2, y0 + 28.0

    L = lambda x: cx - x
    R = lambda x: cx + x
    cuff_top = sl_top_end + 0.15
    cuff_bot = cuff_top + cuff_h

    def side(X, rev=False):
        pts = [
            f"{X(neck)} {y0}",
            f"Q {X(neck + 4)} {y0 + 0.75} {X(seam_x)} {seam_y}",
            f"L {X(sl_end)} {sl_top_end}",
            f"L {X(sl_end)} {sl_top_end + 5.6}",
            f"Q {X(seam_x + 6)} {y0 + 9.4} {X(seam_x + 0.6)} {arm_y - 0.2}",
            f"Q {X(half + 0.3)} {arm_y} {X(half)} {arm_y + 0.6}",
            f"C {X(half + 0.1)} {arm_y + 5} {X(half + 0.05)} {band_top - 4} {X(half)} {band_top}",
        ]
        return pts

    l, r = side(L), side(R)
    body = (f"M {l[0]} {l[1]} {l[2]} {l[3]} {l[4]} {l[5]} {l[6]} "
            f"L {R(half)} {band_top} "
            f"C {R(half + 0.05)} {band_top - 4} {R(half + 0.1)} {arm_y + 5} {R(half)} {arm_y + 0.6} "
            f"Q {R(half + 0.3)} {arm_y} {R(seam_x + 0.6)} {arm_y - 0.2} "
            f"Q {R(seam_x + 6)} {y0 + 9.4} {R(sl_end)} {sl_top_end + 5.6} "
            f"L {R(sl_end)} {sl_top_end} L {R(seam_x)} {seam_y} "
            f"Q {R(neck + 4)} {y0 + 0.75} {R(neck)} {y0} Z")
    out = []

    # hood, back view: up, standing behind the head (hood down would cover the back print)
    if view == "back":
        hood = (f"M {L(neck + 0.4)} {y0 + 0.9} C {L(7.2)} {y0 - 3.5} {L(6.6)} {y0 - 12.6} {cx} {y0 - 13.0} "
                f"C {R(6.6)} {y0 - 12.6} {R(7.2)} {y0 - 3.5} {R(neck + 0.4)} {y0 + 0.9} Z")
    else:
        hood = (f"M {L(neck + 0.2)} {y0 + 0.6} C {L(7.6)} {y0 - 0.8} {L(7.0)} {y0 - 5.4} {cx} {y0 - 5.5} "
                f"C {R(7.0)} {y0 - 5.4} {R(7.6)} {y0 - 0.8} {R(neck + 0.2)} {y0 + 0.6} Z")
    out.append(f'<path d="{hood}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.06"/>')

    out.append(f'<path d="{body}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.06" stroke-linejoin="round"/>')

    # cuffs and hem band (rib)
    for X, a, b in ((L, sl_end + cuff_len, sl_end), (R, sl_end, sl_end + cuff_len)):
        x0_, x1_ = sorted((X(a), X(b)))
        cuff = f"M {x0_} {cuff_top - 0.25} L {x1_} {cuff_top - 0.25} L {x1_} {cuff_bot + 0.25} L {x0_} {cuff_bot + 0.25} Z"
        if X is L:
            cuff = f"M {X(sl_end)} {sl_top_end} L {X(sl_end + cuff_len)} {cuff_top} L {X(sl_end + cuff_len)} {cuff_bot} L {X(sl_end)} {sl_top_end + 5.6} Z"
        else:
            cuff = f"M {X(sl_end)} {sl_top_end} L {X(sl_end + cuff_len)} {cuff_top} L {X(sl_end + cuff_len)} {cuff_bot} L {X(sl_end)} {sl_top_end + 5.6} Z"
        out.append(f'<path d="{cuff}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.06" stroke-linejoin="round"/>')
        out.append(rib_lines(x0_, cuff_top + 0.1, x1_, cuff_bot - 0.1, t, vertical=False, step=0.3))
        out.append(line(f"M {X(sl_end)} {sl_top_end} L {X(sl_end)} {sl_top_end + 5.6}", t["seam"], 0.05))
    band = f"M {L(half)} {band_top} L {R(half)} {band_top} L {R(half - 0.35)} {hem} L {L(half - 0.35)} {hem} Z"
    out.append(f'<path d="{band}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.06" stroke-linejoin="round"/>')
    out.append(rib_lines(L(half - 0.3), band_top, R(half - 0.3), hem, t, vertical=True, step=0.3))
    out.append(line(f"M {L(half)} {band_top} L {R(half)} {band_top}", t["seam"], 0.05))

    # soft tonal folds, clipped to the garment
    out.append(f'<clipPath id="hoodclip"><path d="{body}"/></clipPath><g clip-path="url(#hoodclip)">')
    for s in (-1, 1):
        X = lambda x: cx + s * x
        out.append(fold(f"M {X(half)} {arm_y + 0.4} Q {X(half - 1.8)} {arm_y + 2.6} {X(half - 3.4)} {arm_y + 5.2} "
                        f"Q {X(half - 1.6)} {arm_y + 3.4} {X(half)} {arm_y + 1.8} Z", t["lo"], 0.55))
        out.append(fold(f"M {X(half)} {band_top - 5.5} Q {X(half - 1.2)} {band_top - 2.6} {X(half - 0.9)} {band_top} "
                        f"Q {X(half - 0.3)} {band_top - 2.8} {X(half)} {band_top - 4.6} Z", t["lo"], 0.45))
        # sleeve: long soft drag lines toward the cuff
        for px, op in ((seam_x + 7.5, 0.5), (seam_x + 14.0, 0.4)):
            out.append(fold(f"M {X(px)} {y0 + 8.2} Q {X(px + 2.5)} {y0 + 5.2} {X(px + 5.5)} {y0 + 4.0} "
                            f"Q {X(px + 3.0)} {y0 + 6.0} {X(px + 1.0)} {y0 + 8.4} Z", t["lo"], op))
        out.append(fold(f"M {X(seam_x + 0.8)} {seam_y + 7.6} Q {X(seam_x + 6)} {seam_y + 7.2} {X(sl_end - 0.6)} {sl_top_end + 5.2} "
                        f"Q {X(seam_x + 6)} {seam_y + 8.6} {X(seam_x + 0.8)} {seam_y + 9.2} Z", t["hi"], 0.55))
        out.append(fold(f"M {X(half - 1.0)} {band_top - 0.2} Q {X(half - 2.5)} {band_top - 3.0} {X(half - 2.2)} {band_top - 6.4} "
                        f"Q {X(half - 1.8)} {band_top - 3.0} {X(half - 0.5)} {band_top - 0.2} Z", t["hi"], 0.5))
    out.append("</g>")

    # seams and stitching
    for s in (-1, 1):
        X = lambda x: cx + s * x
        out.append(line(f"M {X(seam_x)} {seam_y} Q {X(seam_x + 0.25)} {y0 + 6.5} {X(seam_x + 0.6)} {arm_y - 0.2}", t["seam"], 0.05))
        out.append(stitch(f"M {X(seam_x - 0.2)} {seam_y + 0.05} Q {X(seam_x + 0.05)} {y0 + 6.5} {X(seam_x + 0.4)} {arm_y - 0.25}", t, 0.05, "0.22 0.12"))
        out.append(line(f"M {X(neck + 0.15)} {y0 + 0.15} Q {X(neck + 4)} {y0 + 0.95} {X(seam_x)} {seam_y + 0.05}", t["seam"], 0.04, 0.8))
    out.append(stitch(f"M {L(half - 0.2)} {band_top - 0.25} L {R(half - 0.2)} {band_top - 0.25}", t, 0.05, "0.22 0.12"))

    if view == "front":
        # kangaroo pocket
        pt, pb = y0 + 16.4, band_top
        pocket = (f"M {L(5.6)} {pt} L {R(5.6)} {pt} L {R(8.6)} {pt + 5.0} L {R(8.9)} {pb} "
                  f"L {L(8.9)} {pb} L {L(8.6)} {pt + 5.0} Z")
        out.append(f'<path d="{pocket}" fill="{t["base"]}" stroke="{t["seam"]}" stroke-width="0.05" stroke-linejoin="round"/>')
        out.append(fold(f"M {L(5.2)} {pt + 0.6} Q {cx} {pt + 1.4} {R(5.2)} {pt + 0.6} Q {cx} {pt + 2.0} {L(5.2)} {pt + 0.6} Z", t["lo"], 0.45, "softer"))
        out.append(stitch(f"M {L(5.6)} {pt + 0.3} L {R(5.6)} {pt + 0.3}", t, 0.05, "0.22 0.12"))
        for X in (L, R):
            out.append(stitch(f"M {X(5.85)} {pt + 0.05} L {X(8.85)} {pt + 5.05}", t, 0.05, "0.22 0.12"))
            out.append(stitch(f"M {X(8.6)} {pt + 5.0} L {X(8.65)} {pb - 0.1}", t, 0.05, "0.22 0.12"))
            out.append(line(f"M {X(5.6)} {pt} L {X(8.6)} {pt + 5.0}", t["lo"], 0.09, 0.9))
        # hood: lining visible through the opening, then the crossover front edges
        lining = (f"M {L(neck - 0.2)} {y0 + 0.2} C {L(6.0)} {y0 - 1.2} {L(5.4)} {y0 - 4.4} {cx} {y0 - 4.5} "
                  f"C {R(5.4)} {y0 - 4.4} {R(6.0)} {y0 - 1.2} {R(neck - 0.2)} {y0 + 0.2} L {cx} {y0 + 4.6} Z")
        out.append(f'<path d="{lining}" fill="{t["inside"]}"/>')
        for s in (1, -1):  # wearer's right edge first, then the left edge laps over it
            X = lambda x: cx + s * x
            edge = (f"M {X(neck + 0.3)} {y0 + 0.4} C {X(neck + 0.3)} {y0 + 2.6} {X(1.6)} {y0 + 5.0} {X(-0.9)} {y0 + 5.4} "
                    f"L {X(-0.6)} {y0 + 4.2} C {X(1.2)} {y0 + 3.7} {X(neck - 1.0)} {y0 + 1.8} {X(neck - 1.1)} {y0 - 0.2} "
                    f"C {X(neck - 1.2)} {y0 - 1.6} {X(neck - 0.6)} {y0 - 1.0} {X(neck + 0.3)} {y0 + 0.4} Z")
            out.append(f'<path d="{edge}" fill="{t["base"]}" stroke="{t["edge"]}" stroke-width="0.06" stroke-linejoin="round"/>')
            out.append(stitch(f"M {X(neck - 0.75)} {y0 - 0.2} C {X(neck - 0.65)} {y0 + 1.9} {X(1.2)} {y0 + 4.0} {X(-0.6)} {y0 + 4.5}", t, 0.05, "0.22 0.12"))
            out.append(fold(f"M {X(neck + 0.1)} {y0 + 0.8} C {X(neck)} {y0 + 2.4} {X(2.2)} {y0 + 4.3} {X(0.5)} {y0 + 4.9} "
                            f"C {X(2.0)} {y0 + 3.9} {X(neck - 0.4)} {y0 + 2.4} {X(neck + 0.1)} {y0 + 0.8} Z", t["lo"], 0.5, "softer"))
        neck_bottom = y0 + 5.4
    else:
        # hood back: centre seam and soft volume
        out.append(f'<clipPath id="hoodupclip"><path d="{hood}"/></clipPath><g clip-path="url(#hoodupclip)">')
        out.append(fold(f"M {L(6.8)} {y0} C {L(6.6)} {y0 - 6} {L(5.0)} {y0 - 10.5} {L(2.6)} {y0 - 12} C {L(4.4)} {y0 - 8} {L(5.0)} {y0 - 4} {L(5.0)} {y0} Z", t["lo"], 0.5))
        out.append(fold(f"M {R(6.8)} {y0} C {R(6.6)} {y0 - 6} {R(5.0)} {y0 - 10.5} {R(2.6)} {y0 - 12} C {R(4.4)} {y0 - 8} {R(5.0)} {y0 - 4} {R(5.0)} {y0} Z", t["hi"], 0.5))
        out.append("</g>")
        out.append(line(f"M {cx} {y0 - 12.95} C {cx + 0.1} {y0 - 8} {cx} {y0 - 3} {cx} {y0 + 0.9}", t["seam"], 0.05))
        out.append(stitch(f"M {cx + 0.22} {y0 - 12.85} C {cx + 0.32} {y0 - 8} {cx + 0.22} {y0 - 3} {cx + 0.22} {y0 + 0.8}", t, 0.05, "0.22 0.12"))
        out.append(line(f"M {L(neck + 0.4)} {y0 + 0.9} Q {cx} {y0 + 1.5} {R(neck + 0.4)} {y0 + 0.9}", t["seam"], 0.05))
        neck_bottom = y0 + 1.2

    return "\n".join(out), {"cx": cx, "y0": y0, "neck": neck_bottom, "seam_x": seam_x}


# ---------------------------------------------------------------- builds
THEMES = {
    # name: (garment, merch file colour, fill swap for pairs with no merch file, mockup background)
    "ink": (INK, "bone", None, BONE),
    "bone": (BONE, "ink", None, INK),
    "moss": (MOSS, "bone", CHALK, CHALK),
    "midnight": (MIDNIGHT, "bone", MIST, MIST),
    "sage": (SAGE, "ink", None, BONE),
}
PRINT = {INK: "Bone", BONE: "Ink", MOSS: "Chalk", MIDNIGHT: "Mist", SAGE: "Ink"}


def build_tee(theme, view, placement, width, where):
    garment, ink, fill, bg = THEMES[theme]
    body, g = tee(garment, "back" if view == "back" else "front")
    if where == "front":
        x, y = g["cx"] - width / 2, g["collar"] + 3.5
    elif where == "chest":   # wearer's left chest = viewer's right
        x, y = g["cx"] + 2.4, g["y0"] + 6.2
    else:                    # back yoke, 2 in below the collar
        x, y = g["cx"] - width / 2, g["collar"] + 2.0
    art, _ = logo(placement, ink, x, y, width, fill)
    title = f"MTTM mockup · tee · {theme} · {view}"
    return doc(TEE_W, TEE_H, bg, body + "\n" + art, title), TEE_W, TEE_H


def build_hoodie(theme, view):
    garment, ink, fill, bg = THEMES[theme]
    body, g = hoodie(garment, view)
    if view == "front":   # monogram centred on the chest
        w = 3.5
        art, _ = logo("chest-monogram", ink, g["cx"] - w / 2, g["y0"] + 7.4, w, fill)
    else:                 # single line across the back and into both sleeves
        w = 40.0
        art, _ = logo("yoke-single-line", ink, g["cx"] - w / 2, g["y0"] + 3.2, w, fill)
    title = f"MTTM mockup · hoodie · {theme} · {view}"
    return doc(HOOD_W, HOOD_H, bg, body + "\n" + art, title), HOOD_W, HOOD_H


def build_cap(theme):
    garment, ink, fill, bg = THEMES[theme]
    body, g = cap(garment)
    w = 2.25
    art, _ = logo("hat-monogram-embroidery", ink, g["cx"] - w / 2, g["base"] - 0.75 - w, w, fill)
    title = f"MTTM mockup · cap · {theme} · front"
    return doc(CAP_W, CAP_H, bg, body + "\n" + art, title), CAP_W, CAP_H


JOBS = {}
for _t in THEMES:
    JOBS[f"tee-{_t}-front"] = (lambda t=_t: build_tee(t, "front", "front-wordmark", 11.0, "front"))
    JOBS[f"tee-{_t}-front-chest"] = (lambda t=_t: build_tee(t, "front-chest", "chest-monogram", 3.5, "chest"))
    JOBS[f"tee-{_t}-back"] = (lambda t=_t: build_tee(t, "back", "yoke-single-line", 10.0, "back"))
    JOBS[f"hoodie-{_t}-front"] = (lambda t=_t: build_hoodie(t, "front"))
    JOBS[f"hoodie-{_t}-back"] = (lambda t=_t: build_hoodie(t, "back"))
    JOBS[f"cap-{_t}-front"] = (lambda t=_t: build_cap(t))


# ---------------------------------------------------------------- board
COLUMNS = [
    # (job suffix, garment label, placement note)
    ("tee-{t}-front", "TEE FRONT", "Front wordmark · 11 in · screen print"),
    ("tee-{t}-front-chest", "TEE CHEST", "Left chest monogram · 3.5 in · screen print"),
    ("tee-{t}-back", "TEE BACK", "Back yoke single line · 10 in · screen print"),
    ("hoodie-{t}-front", "HOODIE FRONT", "Centre chest monogram · 3.5 in · screen print"),
    ("hoodie-{t}-back", "HOODIE BACK", "Back and sleeves · 40 in · panel print"),
    ("cap-{t}-front", "CAP", "Heavy cut monogram · 2.25 in · embroidery"),
]
ROWS = {"ink": "Ink garment · Bone print", "bone": "Bone garment · Ink print",
        "moss": "Moss garment · Chalk print", "midnight": "Midnight garment · Mist print",
        "sage": "Sage garment · Ink print"}


def board():
    cells = []
    for th, note in ROWS.items():
        bg = THEMES[th][3]
        cells.append(f'<div class="row-label"><div class="d">{th.upper()}</div><div class="n">{note}</div></div>')
        for job, _, _ in COLUMNS:
            cells.append(f'<div class="tile" style="background:{bg}"><img src="mttm-mockup-{job.format(t=th)}.svg"></div>')
    heads = "".join(f'<div class="col-head"><div class="d">{g}</div><div class="n">{n}</div></div>' for _, g, n in COLUMNS)
    html = f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../../tokens/mttm-brand.css">
<style>
@font-face{{font-family:'Manrope';font-weight:500;src:url('../../_src/fonts/Manrope-Medium.ttf') format('truetype')}}
html,body{{margin:0;width:3000px;height:2000px;background:{BONE};color:{INK}}}
.d{{font-family:'MTTM Lettering';text-transform:uppercase;letter-spacing:0;font-size:19px;line-height:1}}
.n{{font-family:'Manrope';font-weight:500;font-size:19px;color:{STONE};margin-top:12px;line-height:1.3}}
header{{position:absolute;left:96px;top:72px;right:96px;display:flex;justify-content:space-between;align-items:flex-end}}
header .d{{font-size:30px}}
.grid{{position:absolute;left:96px;right:96px;top:210px;bottom:96px;display:grid;
  grid-template-columns:290px repeat(6,1fr);grid-template-rows:84px repeat(5,1fr);gap:18px 18px}}
.tile{{display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #D9D4CA}}
.tile img{{width:100%;height:100%;object-fit:contain}}
.row-label{{align-self:center}}
.col-head{{align-self:end}}
</style></head><body>
<header><div><div class="d">MERCH MOCKUPS</div>
<div class="n">Adult L. Logos are the supplied merch artwork at true print width. One print or thread colour per garment.</div></div>
<div class="n" style="text-align:right">@maketimetomove · 2026</div></header>
<div class="grid"><div></div>{heads}{''.join(cells)}</div>
<script>document.fonts.ready.then(()=>{{document.title=[
 [...document.fonts].filter(f=>f.status==="loaded").map(f=>f.family+" "+f.weight).join("|")].join(",")}})</script>
</body></html>"""
    p = OUT / "mttm-mockup-board.html"
    p.write_text(html)
    return p


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    if names == ["board"]:
        p = board()
        jobs = [{"src": str(p), "out": str(OUT / "mttm-mockup-board.png"), "width": 3000, "height": 2000}]
        names = []
    for name in (names if names or jobs else JOBS):
        svg, w, h = JOBS[name]()
        p = OUT / f"mttm-mockup-{name}.svg"
        p.write_text(svg)
        jobs.append({"src": str(p), "out": str(p.with_suffix(".png")),
                     "width": PX_WIDTH, "height": round(PX_WIDTH * h / w)})
    jf = OUT / "_jobs.json"
    jf.write_text(json.dumps(jobs))
    subprocess.run(["node", str(BRAND / "_src" / "render.mjs"), str(jf)], check=True)
    jf.unlink()
    for j in jobs:
        print("wrote", Path(j["out"]).relative_to(BRAND))


if __name__ == "__main__":
    main(sys.argv[1:])
