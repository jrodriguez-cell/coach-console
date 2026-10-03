"""Shared styles for the brand review pages."""
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


# ---------------------------------------------------------------- shared helpers
import base64
import json
import math
import os
import subprocess

from mttm import MonogramSpec, bbox_of, fmt, monogram_glyphs


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def sized(svg, width):
    return svg.replace("<svg ", f'<svg width="{width}" ', 1)


def aspect(svg):
    vb = svg.split('viewBox="')[1].split('"')[0].split()
    return float(vb[3]) / float(vb[2])


def monogram_svg(lettering, gap, leading, fg="#FFFFFF", bg="#000000", ring=True, fit=0.82):
    """M T / T M centred so the block's diagonal sits inside `fit` of the circle's
    diameter (survives the Instagram crop)."""
    g, _ = monogram_glyphs(lettering, MonogramSpec(track=gap, leading=leading))
    x0, y0, x1, y1 = bbox_of(lettering, g)
    side = math.hypot(x1 - x0, y1 - y0) / fit
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vx, vy = cx - side / 2, cy - side / 2
    d = " ".join(lettering.path(c, x, b) for c, x, b in g)
    ground = (f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(side / 2)}" fill="{bg}"/>' if ring else
              f'<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(side)}" height="{fmt(side)}" fill="{bg}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(side)} {fmt(side)}" '
            f'role="img" aria-label="MTTM monogram"><title>MTTM monogram</title>{ground}'
            f'<path fill="{fg}" d="{d}"/></svg>')


class Embedder:
    """Rasterise SVGs at exact pixel sizes and embed them as data URIs, so review
    pages work when opened on their own."""

    def __init__(self, tmpdir):
        self.tmp = tmpdir
        os.makedirs(tmpdir, exist_ok=True)
        self.jobs, self.out = [], {}

    def add(self, svg, w, h, key):
        src = os.path.join(self.tmp, f"{key}.svg")
        with open(src, "w") as f:
            f.write(svg)
        out = os.path.join(self.tmp, f"{key}.png")
        self.jobs.append({"src": src, "out": out, "width": w, "height": h})
        self.out[key] = out
        return key

    @staticmethod
    def img(key, w, h, cls="", dw=None, dh=None):
        return f'<img class="{cls}" src="@@{key}@@" width="{dw or w}" height="{dh or h}" alt="">'

    def run_and_fill(self, html):
        jf = os.path.join(self.tmp, "jobs.json")
        with open(jf, "w") as fh:
            json.dump(self.jobs, fh)
        subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "render.mjs"), jf], check=True)
        for k, p in self.out.items():
            html = html.replace(f"@@{k}@@", "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode())
        for f in os.listdir(self.tmp):
            os.remove(os.path.join(self.tmp, f))
        os.rmdir(self.tmp)
        return html
