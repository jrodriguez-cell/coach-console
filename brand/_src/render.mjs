// Rasterise SVG/HTML to PNG with the pre-installed Chromium.
// usage: node render.mjs jobs.json
//   jobs: [{ "src": "a.svg" | "page.html", "out": "a.png", "width": 1080, "height": 1080, "fullPage": false }]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");

const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  const src = resolve(j.src);
  await page.setViewportSize({ width: j.width, height: j.height ?? j.width });
  if (src.endsWith(".svg")) {
    const svg = readFileSync(src, "utf8");
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        `<div style="width:${j.width}px;height:${j.height ?? j.width}px">` +
        svg.replace("<svg ", `<svg width="${j.width}" height="${j.height ?? j.width}" `) +
        `</div></body></html>`
    );
  } else {
    await page.goto("file://" + src);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  await page.screenshot({ path: j.out, omitBackground: !!j.transparent, fullPage: !!j.fullPage });
}
await browser.close();
