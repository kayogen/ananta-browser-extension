#!/usr/bin/env node
/**
 * build.js
 * Produces browser-specific extension packages ready to upload to each store.
 *
 * Usage:
 *   node scripts/build.js --target all       # chrome + firefox + edge
 *   node scripts/build.js --target chrome
 *   node scripts/build.js --target firefox
 *   node scripts/build.js --target edge
 *
 * Output: dist/<target>/  +  dist/ananta-<target>-v<version>.zip
 */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PNG_DIR = path.join(ROOT, "assets", "icons", "png");

const BASE_MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"),
);

// Files / dirs to include in every build (relative to ROOT)
const INCLUDE = ["index.html", "css", "js", "assets"];

// ── Browser manifest factories ──────────────────────────────────────────────

function chromeManifest(base) {
  const m = JSON.parse(JSON.stringify(base));

  // Chrome Web Store / Brave / Edge: no gecko-specific block
  delete m.browser_specific_settings;

  // Must use PNG icons — SVG is rejected by Chrome's validator
  m.icons = {
    16: "assets/icons/png/icon16.png",
    32: "assets/icons/png/icon32.png",
    48: "assets/icons/png/icon48.png",
    128: "assets/icons/png/icon128.png",
  };
  m.action = {
    ...m.action,
    default_icon: {
      16: "assets/icons/png/icon16.png",
      48: "assets/icons/png/icon48.png",
      128: "assets/icons/png/icon128.png",
    },
  };

  return m;
}

function firefoxManifest(base) {
  const m = JSON.parse(JSON.stringify(base));

  // Firefox supports SVG in manifests but PNG is safer across all FF versions
  m.icons = {
    16: "assets/icons/png/icon16.png",
    32: "assets/icons/png/icon32.png",
    48: "assets/icons/png/icon48.png",
    128: "assets/icons/png/icon128.png",
  };
  m.action = {
    ...m.action,
    default_icon: {
      16: "assets/icons/png/icon16.png",
      48: "assets/icons/png/icon48.png",
      128: "assets/icons/png/icon128.png",
    },
  };

  // Ensure gecko ID is present (required for AMO submission)
  m.browser_specific_settings = m.browser_specific_settings || {};
  m.browser_specific_settings.gecko = {
    ...(m.browser_specific_settings.gecko || {}),
    id: "ananta@kayogen",
    strict_min_version: "142.0",
  };

  return m;
}

function edgeManifest(base) {
  // Edge Add-ons = Chromium MV3, identical to Chrome build
  return chromeManifest(base);
}

const TARGETS = {
  chrome: { manifest: chromeManifest, label: "Chrome / Brave" },
  firefox: { manifest: firefoxManifest, label: "Firefox" },
  edge: { manifest: edgeManifest, label: "Edge" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function zipDirectory(sourceDir, outFile) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function checkPNGs() {
  const required = [16, 32, 48, 128];
  for (const size of required) {
    const p = path.join(PNG_DIR, `icon${size}.png`);
    if (!fs.existsSync(p)) {
      console.error(`\n❌  Missing PNG icon: assets/icons/png/icon${size}.png`);
      console.error("   Run  npm run icons  first to generate PNG icons.\n");
      process.exit(1);
    }
  }
}

// ── Build ────────────────────────────────────────────────────────────────────

async function buildTarget(name, config) {
  const outDir = path.join(DIST, name);

  console.log(`\n📦  Building ${config.label}…`);

  // Clean
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Copy extension files
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (fs.existsSync(src)) {
      copyRecursive(src, path.join(outDir, item));
    }
  }

  // Write browser-specific manifest
  const manifest = config.manifest(BASE_MANIFEST);
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  // Zip
  const version = BASE_MANIFEST.version;
  const zipName = `ananta-${name}-v${version}.zip`;
  const zipPath = path.join(DIST, zipName);
  await zipDirectory(outDir, zipPath);

  console.log(`  ✓  dist/${name}/`);
  console.log(`  ✓  dist/${zipName}  →  ready to upload`);
}

async function main() {
  const args = process.argv.slice(2);
  const targetArg =
    (args.find((a) => a.startsWith("--target=")) || "").replace(
      "--target=",
      "",
    ) ||
    args[args.indexOf("--target") + 1] ||
    "all";

  checkPNGs();

  const targets = targetArg === "all" ? Object.keys(TARGETS) : [targetArg];

  for (const name of targets) {
    if (!TARGETS[name]) {
      console.error(
        `❌  Unknown target "${name}". Choose: chrome | firefox | edge | all`,
      );
      process.exit(1);
    }
    await buildTarget(name, TARGETS[name]);
  }

  console.log("\n✅  Build complete!\n");
  console.log("Upload locations:");
  console.log(
    "  Chrome / Brave  →  https://chrome.google.com/webstore/devconsole",
  );
  console.log("  Firefox AMO     →  https://addons.mozilla.org/developers/");
  console.log(
    "  Edge Add-ons    →  https://partner.microsoft.com/dashboard/microsoftedge",
  );
  console.log(
    "  Safari          →  run  npm run safari  (requires macOS + Xcode)",
  );
  console.log("");
}

main().catch((err) => {
  console.error("❌  Build failed:", err.message);
  process.exit(1);
});
