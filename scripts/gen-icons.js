#!/usr/bin/env node
/**
 * gen-icons.js
 * Converts SVG icons → PNG at all required sizes for browser store submissions.
 * Requires: sharp  (npm install sharp)
 *
 * Output: assets/icons/png/icon{16,32,48,128,256,512}.png
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const SVG_SRC = path.join(ROOT, "assets", "icons", "icon128.svg");
const OUT_DIR = path.join(ROOT, "assets", "icons", "png");

// Sizes needed across all stores
// Chrome/Brave: 16, 48, 128  (manifest) + 128 (store icon)
// Firefox AMO:  48, 96, 128  (manifest) + 128 (store icon)
// Edge Add-ons: 16, 48, 128  (manifest) + 300 (store — we supply 512, they resize)
// Safari:       handled by xcrun safari-web-extension-converter
const SIZES = [16, 32, 48, 96, 128, 256, 300, 512];

async function generateIcons() {
  if (!fs.existsSync(SVG_SRC)) {
    console.error(`❌  Source SVG not found: ${SVG_SRC}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const outFile = path.join(OUT_DIR, `icon${size}.png`);
    await sharp(SVG_SRC)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outFile);
    console.log(`  ✓  icon${size}.png`);
  }

  console.log(`\n✅  All icons written to ${path.relative(ROOT, OUT_DIR)}/`);
}

generateIcons().catch((err) => {
  console.error("❌  Icon generation failed:", err.message);
  process.exit(1);
});
