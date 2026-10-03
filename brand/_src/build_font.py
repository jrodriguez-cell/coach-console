"""Build the MTTM Lettering font files (OTF + WOFF2, Regular and Heavy) and a specimen page.

Metrics: UPM 1000, cap height 700 (1 U = 700 units).
Every character carries half a unit of space on each side, so typed text follows the brand rhythm with
no extra letter-spacing: 1 U between characters, 3 U between words. Lowercase types as capitals.

Run:  python3 brand/_src/build_font.py
"""
import base64
import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

from alphabet import BRAND, CHARSET, HEAVY_ALPHABET, LETTERS, REGULAR_ALPHABET
from mttm import fmt
from system import hexc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "fonts")
os.makedirs(OUT, exist_ok=True)

UPM, K = 1000, 7.0          # 100 lettering units -> 700 font units
SB = 50 * K                 # half a unit of side bearing
NAMES = {".": "period", ",": "comma", ":": "colon", "!": "exclam", "?": "question", "'": "quotesingle",
         "’": "quoteright", '"': "quotedbl", "-": "hyphen", "–": "endash", "—": "emdash", "/": "slash",
         "·": "periodcentered", "@": "at", "+": "plus", "#": "numbersign", "(": "parenleft", ")": "parenright", "&": "ampersand",
         **{d: n for d, n in zip("0123456789", ["zero", "one", "two", "three", "four", "five", "six", "seven",
                                                 "eight", "nine"])}}


def gname(ch):
    return ch if ch in LETTERS else NAMES[ch]


def build(alpha, style, weight):
    order = [".notdef", "space"] + [gname(c) for c in CHARSET]
    charstrings, metrics, cmap = {}, {}, {}

    # .notdef: an empty box
    pen = T2CharStringPen(1400, None)
    for (x0, y0, x1, y1), cw in (((SB, 0, SB + 700, 700), True), ((SB + 60, 60, SB + 640, 640), False)):
        pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)] if cw else [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]
        pen.moveTo(pts[0])
        for p in pts[1:]:
            pen.lineTo(p)
        pen.closePath()
    charstrings[".notdef"] = pen.getCharString()
    metrics[".notdef"] = (1400, int(SB))

    charstrings["space"] = T2CharStringPen(1400, None).getCharString()
    metrics["space"] = (1400, 0)
    cmap[ord(" ")] = "space"
    cmap[0xA0] = "space"

    for ch in CHARSET:
        g = alpha.glyph(ch)
        adv = round((alpha.box(ch) + 100) * K)
        pen = T2CharStringPen(adv, None)
        g.draw(TransformPen(pen, (K, 0, 0, K, SB, 0)))
        n = gname(ch)
        charstrings[n] = pen.getCharString()
        x0 = g.bounds[0] if g.bounds else 0
        metrics[n] = (adv, round(x0 * K + SB))
        cmap[ord(ch)] = n
        if ch in LETTERS:
            cmap[ord(ch.lower())] = n
    cmap[ord("`")] = "quotesingle"

    family = "MTTM Lettering"
    ps = f"MTTMLettering-{style}"
    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupCFF(ps, {"FullName": f"{family} {style}", "Weight": style}, charstrings, {})
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-250, lineGap=0)
    fb.setupNameTable({"familyName": family, "styleName": style, "uniqueFontIdentifier": f"{ps};1.000",
                       "fullName": f"{family} {style}", "psName": ps, "version": "Version 1.000",
                       "copyright": "Make Time To Move. Custom brand lettering.",
                       "manufacturer": "Make Time To Move"})
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, sTypoLineGap=0, usWinAscent=950, usWinDescent=260,
                sCapHeight=700, sxHeight=700, usWeightClass=weight, achVendID="MTTM",
                fsSelection=0x40 if style == "Regular" else 0x00)
    fb.setupPost()
    path = os.path.join(OUT, f"mttm-lettering-{style.lower()}.otf")
    fb.save(path)
    f = TTFont(path)
    f.flavor = "woff2"
    f.save(path.replace(".otf", ".woff2"))
    return path


paths = [build(REGULAR_ALPHABET, "Regular", 400), build(HEAVY_ALPHABET, "Heavy", 800)]

# ---------------------------------------------------------------- specimen
INK, BONE, STONE = hexc("ink"), hexc("bone"), hexc("stone")


def b64(p):
    return base64.b64encode(open(p, "rb").read()).decode()


reg_woff = os.path.join(OUT, "mttm-lettering-regular.woff2")
hvy_woff = os.path.join(OUT, "mttm-lettering-heavy.woff2")


def story(label_face):
    """The Ink & Bone brand cover story, with labels in the given face ('michroma' or 'brand')."""
    from system import MICHROMA, placed
    W, Hh = 1080, 1920
    wm, _ = placed("wordmark", W / 2, 900, width=780)
    if label_face == "brand":
        handle = BRAND.path("@MAKETIMETOMOVE", W / 2, 340, 16, anchor="middle")
        pillars = BRAND.path("STRENGTH · MOBILITY · MINDSET", W / 2, 1278, 16, anchor="middle")
    else:
        handle = MICHROMA.path("@MAKETIMETOMOVE", W / 2, 340, 16, 0.5, "middle")
        pillars = MICHROMA.path("STRENGTH · MOBILITY · MINDSET", W / 2, 1278, 17, 0.5, "middle")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}"><rect width="{W}" height="{Hh}" fill="{INK}"/>'
            f'<path fill="{STONE}" d="{handle}"/><path fill="{BONE}" d="{wm}"/>'
            f'<rect x="{W / 2 - 40}" y="1190" width="80" height="2" fill="{STONE}"/><path fill="{STONE}" d="{pillars}"/></svg>')


def detail(text, face_letters=BRAND):
    w = face_letters.width(text, 100)
    d = face_letters.path(text, 40, 140, 100)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w + 80)} 180"><path fill="{INK}" d="{d}"/></svg>')


CSS = f"""
@font-face{{font-family:"MTTM Lettering";src:url(data:font/woff2;base64,{b64(reg_woff)}) format("woff2");font-weight:400}}
@font-face{{font-family:"MTTM Lettering";src:url(data:font/woff2;base64,{b64(hvy_woff)}) format("woff2");font-weight:800}}
:root{{--ink:{INK};--bone:{BONE};--stone:{STONE};--paper:#F6F3EE;--line:#D9D3C7;color-scheme:light}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bone);color:var(--ink);font:16px/1.6 "Manrope",system-ui,sans-serif}}
.wrap{{max-width:1120px;margin:0 auto;padding-inline:clamp(16px,4vw,36px);padding-block:44px 88px}}
.mt{{font-family:"MTTM Lettering",sans-serif;text-transform:uppercase}}
h1{{font:400 clamp(22px,3.4vw,40px)/1.4 "MTTM Lettering";margin:0}}
h2{{font:400 13px/1.6 "MTTM Lettering";margin:0 0 12px}}
section{{border-top:1px solid var(--ink);padding-top:16px;margin-top:44px}}
.note{{color:#55534e;max-width:72ch;margin:6px 0 16px}}
.set{{font:400 clamp(20px,3.6vw,42px)/2 "MTTM Lettering";word-break:break-all}}
.set.h{{font-weight:800}}
.pair{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px}}
.pair figure{{margin:0}} figcaption{{font:10px/1.6 "MTTM Lettering";color:var(--stone);margin-top:8px}}
svg{{display:block;max-width:100%;height:auto}}
.story{{max-width:300px}}
.samples{{background:var(--ink);color:var(--bone);padding:clamp(20px,4vw,40px);display:grid;gap:22px}}
.samples .lg{{font:400 clamp(16px,2.6vw,30px)/1.6 "MTTM Lettering"}}
.samples .sm{{font:400 12px/1.6 "MTTM Lettering";color:var(--stone)}}
.tester label{{font:10px "MTTM Lettering";color:var(--stone);display:block;margin-bottom:6px}}
.tester input{{width:100%;font:400 clamp(18px,3vw,34px)/1.6 "MTTM Lettering";text-transform:uppercase;background:var(--paper);
  border:1px solid var(--line);color:var(--ink);padding:14px 16px}}
.tester input:focus-visible{{outline:2px solid var(--ink);outline-offset:2px}}
.rec{{background:var(--paper);border:1px solid var(--line);padding:18px 20px}}
ul{{padding-left:20px}} li{{max-width:72ch}}
"""
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MTTM Lettering</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap">
<style>{CSS}</style></head><body><div class="wrap">
<h1>MTTM LETTERING</h1>
<p class="note">The logo’s letters, extended to a full alphabet. Everything on this page is set with the real font files
(<code>fonts/mttm-lettering-regular.otf</code> and <code>-heavy.otf</code>), so what you see is what Canva, Figma or a website will show.</p>

<section><h2>Regular</h2><div class="set">ABCDEFGHIJKLM NOPQRSTUVWXYZ 0123456789 .,:!?'"-–—/·@+#()</div></section>
<section><h2>Heavy · small sizes and embroidery only</h2><div class="set h">ABCDEFGHIJKLM NOPQRSTUVWXYZ 0123456789 .,:!?'"-–—/·@+#()</div></section>

<section><h2>The change you asked about</h2>
<p class="note">The Ink &amp; Bone story cover, before and after. The handle and the pillar line now use the same letters as
the logo: square boxes, a circular O and the same one-letter gaps.</p>
<div class="pair">
 <figure class="story">{story("michroma")}<figcaption>Before · labels in Michroma</figcaption></figure>
 <figure class="story">{story("brand")}<figcaption>After · labels in MTTM Lettering</figcaption></figure>
</div></section>

<section><h2>Details</h2>
<p class="note">The O is a true circle, as in the logo. The zero is a rounded square so 0 and O never get confused.
I is a single stroke, and W is the M turned upside down.</p>
<div class="pair"><figure>{detail("O0 SGR")}</figure><figure>{detail("MW KQ?")}</figure></div></section>

<section><h2>In use</h2><div class="samples">
 <div class="lg">WHY DO YOU MAKE TIME TO MOVE?</div>
 <div class="lg">START WHERE YOU ARE.</div>
 <div class="sm">STRENGTH · MOBILITY · MINDSET</div>
 <div class="sm">INTERVIEW SERIES · NO. 01 · @MAKETIMETOMOVE</div>
</div></section>

<section class="tester"><h2>Try it</h2><label for="type-test">Type anything (lowercase becomes capitals)</label>
<input id="type-test" type="text" value="Ten minutes counts." aria-label="Type to preview MTTM Lettering"></section>

<section><h2>How it works</h2><div class="rec"><ul>
<li>The brand spacing is built in: one letter-width between characters and three between words, with no letter-spacing needed. Leave letter-spacing at 0.</li>
<li>Capitals only. Lowercase keys type capitals.</li>
<li>Use it for headlines, labels, title cards, highlight text and merch slogans. Keep lines short. Use Manrope for anything read as sentences.</li>
<li>Heavy is for small sizes (labels under about 14 px high on screen) and embroidery.</li>
<li>The logo stays fixed artwork. Never retype it, even though the font has the letters.</li>
<li>Not included yet: %. If you need it, I can draw it.</li>
</ul></div></section>
</div></body></html>"""
with open(os.path.join(OUT, "mttm-lettering-specimen.html"), "w") as f:
    f.write(html)
print("ok", [os.path.basename(p) for p in paths])
