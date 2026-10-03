"""Print the brand guidelines to PDF (A4) with embedded brand fonts.

Run after build_guidelines.py:  python3 brand/_src/build_pdf.py
Writes brand/mttm-brand-guidelines.pdf
"""
import base64
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
FONTS = os.path.join(HERE, "fonts")


def face(family, filename, weight="100 900"):
    data = base64.b64encode(open(os.path.join(FONTS, filename), "rb").read()).decode()
    return (f'@font-face{{font-family:"{family}";src:url(data:font/ttf;base64,{data}) format("truetype");'
            f"font-weight:{weight};font-style:normal}}")


PRINT_CSS = (face("Manrope", "Manrope-Medium.ttf")
             + face("IBM Plex Mono", "IBMPlexMono-Regular.ttf") + """
@page{size:A4;margin:14mm 14mm 16mm}
html{scroll-behavior:auto}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-size:10.5pt;background:#FFFFFF}
thead{display:table-header-group}
nav.toc,.copy{display:none !important}
.wrap{max-width:none;padding-inline:0}
.cover{min-height:265mm;display:flex;align-items:center}
.cover .wrap{width:100%;padding-inline:12mm}
.cover-mark{max-width:150mm}
section{break-before:page;padding-top:0}
.sec-head{margin-top:0}
h3{break-after:avoid}
p,li{max-width:none}
.lede{font-size:12pt}
.brief pre{font-size:7.6pt;line-height:1.55}
tr,figure,.sw,.theme,.ig,.merch figure,.specimen,.voice,pre.code,.marks,.cs{break-inside:avoid}
.themes .theme{padding:10px 14px}
.theme-art{grid-template-columns:minmax(0,1fr) 80px}
.ig-row{grid-template-columns:repeat(6,1fr)}
.merch{grid-template-columns:repeat(3,1fr)}
.swatches{grid-template-columns:repeat(5,1fr)}
footer{break-before:avoid}
""")

src = open(os.path.join(ROOT, "guidelines.html")).read()
src = re.sub(r'<link rel="preconnect"[^>]*>', "", src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', "", src)
src = src.replace("</head>", f"<style>{PRINT_CSS}</style></head>", 1)
tmp = os.path.join(ROOT, "_print.html")
with open(tmp, "w") as f:
    f.write(src)

out = os.path.join(ROOT, "mttm-brand-guidelines.pdf")
footer = ('<div style="width:100%;font:7px Helvetica,Arial,sans-serif;letter-spacing:1.5px;color:#8F8B83;'
          'padding:0 14mm;display:flex;justify-content:space-between"><span>MAKE TIME TO MOVE · BRAND GUIDELINES v1.0'
          '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')
script = f"""
import {{ createRequire }} from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
const {{ chromium }} = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://{tmp}");
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({{ media: "print" }});
await page.pdf({{ path: {out!r}, format: "A4", printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: {footer!r} }});
await browser.close();
"""
mjs = os.path.join(ROOT, "_print.mjs")
with open(mjs, "w") as f:
    f.write(script)
try:
    subprocess.run(["node", mjs], check=True)
finally:
    os.remove(mjs)
    os.remove(tmp)
print("ok", out)
