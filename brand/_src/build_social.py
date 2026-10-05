"""Instagram / social kit v2.0 — in the Coach Console app's packaging (Ink on Sage master).

Every template is built three ways from the same layout code:
  <name>.png / .svg        finished example, all text outlined (no fonts needed)
  templates/<name>.svg     live text (MTTM Lettering + Manrope) for Figma / Illustrator
  canva/<name>.pdf         live text with fonts embedded; import into Canva and edit the words

Run after build_final.py:  python3 brand/_src/build_social.py
"""
import base64
import json
import os
import shutil
import subprocess

from alphabet import BRAND
from mttm import fmt
from system import MANROPE_REGULAR, MANROPE_SEMIBOLD, THEME, THEMES, hexc, placed

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "instagram")
FONTS = os.path.join(HERE, "fonts")

W, H = 1080, 1920           # stories and reels
PW, PH = 1080, 1350         # feed posts (4:5)
M = 96                      # side margin
SAFE_T, SAFE_B = 250, 1580  # stories: Instagram UI covers above / below these lines
SQ_T, SQ_B = (H - W) / 2, (H + W) / 2  # reels: centre square survives every crop

FACES = {
    "brand": (BRAND, "MTTM Lettering", 400, 0.70),
    "body": (MANROPE_REGULAR, "Manrope", 400, MANROPE_REGULAR.H / MANROPE_REGULAR.tt["head"].unitsPerEm),
    "strong": (MANROPE_SEMIBOLD, "Manrope", 600, MANROPE_SEMIBOLD.H / MANROPE_SEMIBOLD.tt["head"].unitsPerEm),
}


class Build:
    """Emits outlined paths (finished art) or live <text> (editable templates)."""

    def __init__(self, editable):
        self.ed = editable

    def text(self, s, x, y, cap, fill, face="brand", anchor="start", maxw=None, tracking=0.0, field=None):
        f, family, weight, ratio = FACES[face]
        while maxw and f.width(s, cap, tracking) > maxw and cap > 6:
            cap -= 0.5
        if not self.ed:
            return f'<path fill="{fill}" d="{f.path(s, x, y, cap, tracking, anchor)}"/>'
        size = cap / ratio
        esc = s.replace("&", "&amp;").replace("<", "&lt;")
        return (f'<text x="{fmt(x)}" y="{fmt(y)}" font-family="{family}" font-weight="{weight}" font-size="{fmt(size)}" '
                f'letter-spacing="{fmt(tracking * cap)}" text-anchor="{anchor}" fill="{fill}"'
                f'{f" data-field={chr(34)}{field}{chr(34)}" if field else ""}>{esc}</text>')


def canvas(bg, body, w=W, h=H, title="Make Time To Move"):
    ground = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{title}"><title>{title}</title>{ground}{body}</svg>')


def mono(cx, cy, side, fill):
    d, _ = placed("monogram", cx, cy, width=side)
    return f'<path fill="{fill}" d="{d}"/>'


def framed(cx, cy, u, fill):
    """Framed monogram, as in the app header: M T / T M (3 U) inside a square frame with 1 U padding,
    frame line = the lettering stroke (0.12 U)."""
    sw = 0.12 * u
    side = 5 * u
    return (f'<rect x="{fmt(cx - side / 2 + sw / 2)}" y="{fmt(cy - side / 2 + sw / 2)}" width="{fmt(side - sw)}" '
            f'height="{fmt(side - sw)}" fill="none" stroke="{fill}" stroke-width="{fmt(sw)}"/>' + mono(cx, cy, 3 * u, fill))


def hair(x, y, w, fill, strong=False):
    return f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="2" fill="{fill}" fill-opacity="{0.4 if strong else 0.22}"/>'


def wordmark(cx, cy, width, fill):
    d, _ = placed("wordmark", cx, cy, width=width)
    return f'<path fill="{fill}" d="{d}"/>'


def colors(t):
    return hexc(t["fg"]), hexc(t["bg"]), hexc(t["grey"])


# ================================================================ templates
# Each returns (svg, size). Copy is example text in the brand voice; edit it in the template files.

def story_cover(B, t):
    fg, bg, gr = colors(t)
    b = [B.text("@MAKETIMETOMOVE", W / 2, 340, 16, gr, anchor="middle", field="handle"),
         wordmark(W / 2, 900, 780, fg), hair(W / 2 - 40, 1190, 80, fg, True),
         B.text("STRENGTH · MOBILITY · MINDSET", W / 2, 1278, 16, gr, anchor="middle", maxw=W - 2 * M)]
    return canvas(bg, "".join(b), title="Story opening page")


def highlight(B, t):
    fg, bg, _ = colors(t)
    return canvas(bg, framed(W / 2, H / 2, 100, fg), title=f"Highlight: {t['pillar']}")


def interview_title(B, t, number="NO. 01"):
    fg, bg, gr = colors(t)
    b = [framed(W / 2, 400, 34, fg), B.text("INTERVIEW SERIES", W / 2, 620, 17, gr, anchor="middle")]
    for i, line in enumerate(("WHY DO YOU", "MAKE TIME", "TO MOVE?")):
        b.append(B.text(line, W / 2, 880 + i * 132, 44, fg, anchor="middle", maxw=W - 2 * M))
    b += [hair(W / 2 - 40, 1250, 80, fg, True), B.text(number, W / 2, 1340, 22, fg, anchor="middle", field="episode"),
          B.text("@MAKETIMETOMOVE", W / 2, 1520, 15, gr, anchor="middle")]
    return canvas(bg, "".join(b), title="Interview title card")


def lower_third(B, t, name="NAME SURNAME", caption="Occupation · Neighbourhood"):
    fg, bg, gr = colors(t)
    x, y, h = 72, 1330, 180
    b = [f'<rect x="{x}" y="{y}" width="700" height="{h}" fill="{bg}"/>',
         f'<rect x="{x}" y="{y}" width="6" height="{h}" fill="{fg}"/>',
         B.text(name, x + 48, y + 78, 24, fg, maxw=600, field="name"),
         B.text(caption, x + 48, y + 132, 22, gr, face="body", maxw=600, field="caption")]
    return canvas(None, "".join(b), title="Interview lower third")


def quote(B, t, lines=("“I used to wait for", "a free hour. Now I", "take the ten minutes", "I actually have.”"),
          who="MARIA, 41", what="Nurse · Brooklyn"):
    fg, bg, gr = colors(t)
    b = [B.text("WHY THEY MAKE TIME", M, 360, 17, gr), hair(M, 410, W - 2 * M, fg)]
    for i, line in enumerate(lines):
        b.append(B.text(line, M, 640 + i * 104, 50, fg, face="strong", maxw=W - 2 * M, field=f"quote{i + 1}"))
    y = 640 + len(lines) * 104 + 40
    b += [hair(M, y, 120, fg, True), B.text(who, M, y + 90, 20, fg, field="name"),
          B.text(what, M, y + 150, 24, gr, face="body", field="detail"),
          framed(W - M - 60, 1460, 24, fg)]
    return canvas(bg, "".join(b), title="Interview quote")


def tip(B, t, title=("THREE HIP", "OPENERS"), items=(("90/90 switches", "8 slow reps each side"),
                                                      ("Deep squat hold", "45 seconds, heels down"),
                                                      ("Half-kneeling stretch", "30 seconds each side"))):
    fg, bg, gr = colors(t)
    b = [B.text(t["pillar"].upper(), M, 360, 17, gr)]
    for i, line in enumerate(title):
        b.append(B.text(line, M, 500 + i * 96, 44, fg, maxw=W - 2 * M, field=f"title{i + 1}"))
    y0 = 760
    for i, (head, sub) in enumerate(items):
        y = y0 + i * 230
        b += [hair(M, y, W - 2 * M, fg), B.text(f"0{i + 1}", M, y + 104, 26, fg),
              B.text(head, M + 170, y + 104, 36, fg, face="strong", maxw=W - 2 * M - 170, field=f"item{i + 1}"),
              B.text(sub, M + 170, y + 164, 26, gr, face="body", maxw=W - 2 * M - 170, field=f"detail{i + 1}")]
    b.append(B.text("@MAKETIMETOMOVE", M, 1540, 15, gr))
    return canvas(bg, "".join(b), title="Tip card")


def workout(B, t, title="LOWER BODY", meta="45 min · 4 exercises",
            rows=(("Goblet squat", "4 × 8", "Rest 90 s"), ("Romanian deadlift", "3 × 10", "Rest 90 s"),
                  ("Split squat", "3 × 8 / side", "Rest 60 s"), ("Farmer carry", "4 × 30 m", "Rest 60 s"))):
    fg, bg, gr = colors(t)
    b = [B.text("TODAY’S SESSION", M, 360, 17, gr), B.text(title, M, 500, 44, fg, maxw=W - 2 * M, field="title"),
         B.text(meta, M, 580, 26, gr, face="body", field="meta"), hair(M, 650, W - 2 * M, fg, True)]
    for i, (name, rx, rest) in enumerate(rows):
        y = 650 + i * 190
        if i:
            b.append(hair(M, y, W - 2 * M, fg))
        b += [B.text(name, M, y + 96, 36, fg, face="strong", maxw=560, field=f"exercise{i + 1}"),
              B.text(rx, W - M, y + 96, 36, fg, face="strong", anchor="end", field=f"sets{i + 1}"),
              B.text(rest, M, y + 152, 24, gr, face="body", field=f"note{i + 1}")]
    b.append(B.text("Log every set in your plan.", M, 1520, 26, gr, face="body", field="footer"))
    return canvas(bg, "".join(b), title="Workout card")


def stat(B, t, done=4, total=5, line="Ten minutes counts."):
    fg, bg, gr = colors(t)
    b = [B.text("THIS WEEK", W / 2, 470, 17, gr, anchor="middle"),
         B.text(f"{done}/{total}", W / 2, 900, 190, fg, anchor="middle", maxw=W - 2 * M, field="figure"),
         B.text("SESSIONS DONE", W / 2, 1030, 17, gr, anchor="middle")]
    s, g = 96, 32
    x0 = W / 2 - (total * s + (total - 1) * g) / 2
    for i in range(total):
        x = x0 + i * (s + g)
        b.append(f'<rect x="{fmt(x)}" y="1110" width="{s}" height="{s}" fill="{fg}"/>' if i < done else
                 f'<rect x="{fmt(x + 2.5)}" y="1112.5" width="{s - 5}" height="{s - 5}" fill="none" stroke="{fg}" stroke-width="5"/>')
    b += [B.text(line, W / 2, 1380, 30, fg, face="body", anchor="middle", field="line"),
          B.text("@MAKETIMETOMOVE", W / 2, 1520, 15, gr, anchor="middle")]
    return canvas(bg, "".join(b), title="Weekly progress")


def question(B, t, guide=False):
    fg, bg, gr = colors(t)
    b = [B.text("QUESTION FOR YOU", W / 2, 380, 17, gr, anchor="middle")]
    for i, line in enumerate(("WHY DO YOU", "MAKE TIME", "TO MOVE?")):
        b.append(B.text(line, W / 2, 560 + i * 120, 44, fg, anchor="middle", field=f"title{i + 1}"))
    if guide:
        b += [f'<rect x="{M + 60}" y="980" width="{W - 2 * M - 120}" height="380" fill="none" stroke="{fg}" '
              f'stroke-width="3" stroke-dasharray="14 10" stroke-opacity="0.5"/>',
              B.text("PLACE THE QUESTION STICKER HERE", W / 2, 1180, 15, gr, anchor="middle")]
    b.append(B.text("@MAKETIMETOMOVE", W / 2, 1520, 15, gr, anchor="middle"))
    return canvas(bg, "".join(b), title="Question sticker story")


def end_card(B, t):
    fg, bg, gr = colors(t)
    b = [framed(W / 2, 780, 80, fg), B.text("START WHERE", W / 2, 1180, 40, fg, anchor="middle", field="line1"),
         B.text("YOU ARE.", W / 2, 1270, 40, fg, anchor="middle", field="line2"),
         B.text("FOLLOW @MAKETIMETOMOVE", W / 2, 1460, 15, gr, anchor="middle")]
    return canvas(bg, "".join(b), title="End card")


def reel_cover(B, t, title=("YOUR TITLE", "GOES HERE"), guide=False):
    fg, bg, gr = colors(t)
    b = [B.text(t["pillar"].upper(), W / 2, SQ_T + 170, 17, gr, anchor="middle")]
    for i, line in enumerate(title):
        b.append(B.text(line, W / 2, 920 + (i - (len(title) - 1) / 2) * 112, 44, fg, anchor="middle",
                        maxw=W - 2 * M - 60, field=f"title{i + 1}"))
    b.append(framed(W / 2, SQ_B - 200, 26, fg))
    if guide:
        b += ['<g fill="none" stroke-width="3" stroke-dasharray="16 12">',
              f'<rect x="1.5" y="{(H - 1440) / 2}" width="{W - 3}" height="1440" stroke="#d14"/>',
              f'<rect x="60" y="{SQ_T + 60}" width="{W - 120}" height="{W - 120}" stroke="#18f"/>',
              f'<rect x="1.5" y="{SAFE_B}" width="{W - 3}" height="{H - SAFE_B - 2}" stroke="#d14"/></g>',
              B.text("3:4 PROFILE GRID CROP", 30, (H - 1440) / 2 - 24, 16, "#d14"),
              B.text("SAFE ZONE FOR TEXT", 90, SQ_T + 40, 16, "#18f"),
              B.text("CAPTION AREA", 30, SAFE_B + 60, 16, "#d14")]
    return canvas(bg, "".join(b), title=f"Reel cover: {t['pillar']}")


def caption_bar(B, t, lines=("Ten minutes counts.", "Start where you are.")):
    """On-screen caption for reels: a solid Ink block, Sage text, sitting above the caption area."""
    fg, bg, _ = colors(t)
    size = 34
    widths = [FACES["strong"][0].width(l, size) for l in lines]
    bw = max(widths) + 2 * 44
    y = 1300 - len(lines) * 70
    b = [f'<rect x="{fmt(W / 2 - bw / 2)}" y="{y}" width="{fmt(bw)}" height="{len(lines) * 70 + 50}" fill="{bg}"/>']
    for i, l in enumerate(lines):
        b.append(B.text(l, W / 2, y + 72 + i * 70, size, fg, face="strong", anchor="middle", field=f"line{i + 1}"))
    return canvas(None, "".join(b), title="Reel caption")


def title_overlay(B, t, lines=("MOBILITY", "RESET")):
    fg, bg, _ = colors(t)
    b = [f'<rect x="{M}" y="360" width="{W - 2 * M}" height="{60 + len(lines) * 100}" fill="{bg}"/>']
    for i, l in enumerate(lines):
        b.append(B.text(l, W / 2, 470 + i * 100, 40, fg, anchor="middle", maxw=W - 2 * M - 80, field=f"title{i + 1}"))
    return canvas(None, "".join(b), title="Reel title overlay")


def post_statement(B, t, lines=("START WHERE", "YOU ARE.")):
    fg, bg, gr = colors(t)
    b = [framed(PW / 2, 250, 26, fg)]
    for i, l in enumerate(lines):
        b.append(B.text(l, PW / 2, 640 + i * 110, 48, fg, anchor="middle", maxw=PW - 2 * M, field=f"line{i + 1}"))
    b.append(B.text("@MAKETIMETOMOVE", PW / 2, 1140, 15, gr, anchor="middle"))
    return canvas(bg, "".join(b), PW, PH, "Statement post")


def carousel_cover(B, t, title=("FIVE MINUTE", "MOBILITY", "RESET"), count=5):
    fg, bg, gr = colors(t)
    b = [B.text(t["pillar"].upper(), M, 190, 17, gr)]
    for i, l in enumerate(title):
        b.append(B.text(l, M, 520 + i * 116, 52, fg, maxw=PW - 2 * M, field=f"title{i + 1}"))
    b += [hair(M, 1150, PW - 2 * M, fg), B.text(f"01 / 0{count}", M, 1240, 17, gr),
          B.text("SWIPE", PW - M, 1240, 17, fg, anchor="end")]
    return canvas(bg, "".join(b), PW, PH, "Carousel cover")


def carousel_slide(B, t, n=2, count=5, head="Cat–cow, 60 seconds",
                   body=("Move slowly with your breath.", "Round on the exhale, open", "on the inhale. Keep the", "neck long.")):
    fg, bg, gr = colors(t)
    b = [B.text(f"0{n}", M, 330, 110, fg, field="number"),
         B.text(head, M, 540, 46, fg, face="strong", maxw=PW - 2 * M, field="heading")]
    for i, l in enumerate(body):
        b.append(B.text(l, M, 650 + i * 62, 32, fg, face="body", maxw=PW - 2 * M, field=f"body{i + 1}"))
    b += [hair(M, 1150, PW - 2 * M, fg), B.text(f"0{n} / 0{count}", M, 1240, 17, gr),
          B.text(t["pillar"].upper(), PW - M, 1240, 17, gr, anchor="end")]
    return canvas(bg, "".join(b), PW, PH, "Carousel slide")


def carousel_end(B, t):
    fg, bg, gr = colors(t)
    b = [framed(PW / 2, 470, 60, fg), B.text("SAVE THIS.", PW / 2, 860, 40, fg, anchor="middle", field="line1"),
         B.text("MOVE TODAY.", PW / 2, 950, 40, fg, anchor="middle", field="line2"),
         B.text("@MAKETIMETOMOVE", PW / 2, 1140, 15, gr, anchor="middle")]
    return canvas(bg, "".join(b), PW, PH, "Carousel end")


def avatar(B, t, plain=False):
    fg, bg, _ = colors(t)
    art = mono(W / 2, W / 2, 0.76 * W / 2 ** 0.5, fg) if plain else framed(W / 2, W / 2, 118, fg)
    return canvas(bg, art, W, W, "Profile avatar")


# ================================================================ catalogue
S = THEME["start-here"]
CATALOGUE = [
    # (folder, name, function, theme, kwargs, size, transparent, template?)
    ("avatar", "mttm-ig-avatar", avatar, S, {}, (W, W), False, False),
    ("avatar", "mttm-ig-avatar-plain", avatar, S, {"plain": True}, (W, W), False, False),
    ("avatar", "mttm-ig-avatar-inverse", avatar, THEME["strength"], {}, (W, W), False, False),
    ("stories", "mttm-ig-story-cover", story_cover, S, {}, (W, H), False, True),
    ("stories", "mttm-ig-story-cover-inverse", story_cover, THEME["strength"], {}, (W, H), False, False),
    ("stories", "mttm-ig-story-cover-bone", story_cover, THEME["mobility"], {}, (W, H), False, False),
    ("stories", "mttm-ig-story-tip", tip, THEME["mobility"], {}, (W, H), False, True),
    ("stories", "mttm-ig-story-workout", workout, THEME["strength"], {}, (W, H), False, True),
    ("stories", "mttm-ig-story-progress", stat, S, {}, (W, H), False, True),
    ("stories", "mttm-ig-story-question", question, S, {}, (W, H), False, True),
    ("stories", "mttm-ig-story-question-guide", question, S, {"guide": True}, (W, H), False, False),
    ("stories", "mttm-ig-story-end", end_card, S, {}, (W, H), False, True),
    ("interview", "mttm-ig-interview-title", interview_title, THEME["interviews"], {}, (W, H), False, True),
    ("interview", "mttm-ig-interview-quote", quote, THEME["interviews"], {}, (W, H), False, True),
    ("interview", "mttm-ig-lower-third", lower_third, THEME["interviews"], {}, (W, H), True, True),
    ("reels", "mttm-ig-reel-cover-safe-zone-guide", reel_cover, S, {"guide": True}, (W, H), False, False),
    ("reels/overlays", "mttm-ig-reel-caption", caption_bar, THEME["strength"], {}, (W, H), True, True),
    ("reels/overlays", "mttm-ig-reel-title", title_overlay, THEME["strength"], {}, (W, H), True, True),
    ("posts", "mttm-ig-post-statement", post_statement, S, {}, (PW, PH), False, True),
    ("posts", "mttm-ig-post-carousel-cover", carousel_cover, THEME["mobility"], {}, (PW, PH), False, True),
    ("posts", "mttm-ig-post-carousel-slide", carousel_slide, THEME["mobility"], {}, (PW, PH), False, True),
    ("posts", "mttm-ig-post-carousel-end", carousel_end, THEME["mobility"], {}, (PW, PH), False, True),
]
for t in THEMES:
    CATALOGUE.append(("highlights", f"mttm-ig-highlight-{t['id']}", highlight, t, {}, (W, H), False, False))
    CATALOGUE.append(("reels", f"mttm-ig-reel-cover-{t['id']}", reel_cover, t, {}, (W, H), False, True))


# ================================================================ build
def b64(fn):
    return base64.b64encode(open(os.path.join(FONTS, fn), "rb").read()).decode()


FONT_FACES = (
    f'@font-face{{font-family:"MTTM Lettering";font-weight:400;src:url(data:font/woff2;base64,'
    f'{base64.b64encode(open(os.path.join(ROOT, "fonts", "mttm-lettering-regular.woff2"), "rb").read()).decode()}) format("woff2")}}'
    f'@font-face{{font-family:"Manrope";font-weight:400;src:url(data:font/ttf;base64,{b64("Manrope-Regular.ttf")}) format("truetype")}}'
    f'@font-face{{font-family:"Manrope";font-weight:600;src:url(data:font/ttf;base64,{b64("Manrope-SemiBold.ttf")}) format("truetype")}}')

shutil.rmtree(OUT, ignore_errors=True)
jobs, pdfs = [], []
for folder, name, fn, t, kw, (w, h), transparent, has_tpl in CATALOGUE:
    d = os.path.join(OUT, folder)
    os.makedirs(d, exist_ok=True)
    svg = fn(Build(False), t, **kw)
    with open(os.path.join(d, name + ".svg"), "w") as f:
        f.write(svg)
    jobs.append({"src": os.path.join(d, name + ".svg"), "out": os.path.join(d, name + ".png"), "width": w, "height": h,
                 "transparent": transparent})
    if has_tpl:
        live = fn(Build(True), t, **kw)
        os.makedirs(os.path.join(d, "templates"), exist_ok=True)
        with open(os.path.join(d, "templates", name + "-template.svg"), "w") as f:
            f.write(live)
        pdfs.append({"html": (f"<!doctype html><html><head><meta charset='utf-8'><style>{FONT_FACES}"
                              f"@page{{size:{w}px {h}px;margin:0}}html,body{{margin:0;padding:0}}svg{{display:block}}</style>"
                              f"</head><body>{live}</body></html>"),
                     "out": os.path.join(OUT, "canva", name + ".pdf"), "width": w, "height": h})

jf = os.path.join(OUT, "_jobs.json")
with open(jf, "w") as fh:
    json.dump(jobs, fh)
subprocess.run(["node", os.path.join(HERE, "render.mjs"), jf], check=True)
os.remove(jf)

os.makedirs(os.path.join(OUT, "canva"), exist_ok=True)
pj = os.path.join(OUT, "_pdf.json")
with open(pj, "w") as fh:
    json.dump(pdfs, fh)
mjs = os.path.join(OUT, "_pdf.mjs")
with open(mjs, "w") as fh:
    fh.write("""import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const b = await chromium.launch(); const p = await b.newPage();
for (const j of jobs) {
  await p.setViewportSize({ width: j.width, height: j.height });
  await p.setContent(j.html); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: j.out, width: j.width + "px", height: j.height + "px", printBackground: true, pageRanges: "1" });
}
await b.close();
""")
subprocess.run(["node", mjs, pj], check=True)
os.remove(mjs)
os.remove(pj)
print(f"ok: {len(jobs)} images, {len(pdfs)} editable templates")
