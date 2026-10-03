# Make Time To Move: brand

Start with **[guidelines.md](guidelines.md)** (or `guidelines.html`, or the PDF `mttm-brand-guidelines.pdf`). It is the single shareable reference: the copy-paste brand brief, logo rules, colours, type, Instagram, website and merch.

- `preview.html`: every final asset side by side
- `logo/`: wordmark, monogram, single line, heavy cut, layout variants, favicons (SVG + PNG)
- `instagram/`: avatar, highlight covers, interview title card + lower third, reel covers (+ editable `-template.svg`)
- `merch/`: print-ready transparent files at 300 dpi
- `tokens/`: `mttm-brand.css` (one self-contained file for websites, brand font embedded), CSS / JSON tokens
- `fonts/`: MTTM Lettering font files (OTF, WOFF2) and specimen
- `mttm-brand-kit.zip`: the shareable kit (PDF, guidelines.md, mttm-brand.css, fonts, key logos) for other chats and developers
- `exploration/`, `type-exploration.html`: the design rounds that led here
- `_src/`: fonts and build scripts. Rebuild everything with:

```sh
pip install fonttools skia-pathops
python3 brand/_src/build_final.py && python3 brand/_src/build_guidelines.py && python3 brand/_src/build_pdf.py
```
