#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOGO_MARK_DARK_SVG = "assets/logo-square-dark.svg";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function magick(...args) {
  execFileSync("magick", args, { stdio: "inherit" });
}

function sips(...args) {
  execFileSync("sips", args, { stdio: "inherit" });
}

const sourceSvg = join(repoRoot, LOGO_MARK_DARK_SVG);
const prodDir = join(repoRoot, "assets/prod");
const webPublicDir = join(repoRoot, "apps/web/public");
const desktopResourcesDir = join(repoRoot, "apps/desktop/resources");

magick(sourceSvg, "-resize", "1024x1024", join(prodDir, "black-macos-1024.png"));
magick(sourceSvg, "-resize", "1024x1024", join(prodDir, "black-ios-1024.png"));
magick(sourceSvg, "-resize", "1024x1024", join(prodDir, "black-universal-1024.png"));

magick(sourceSvg, "-resize", "180x180", join(prodDir, "t3-black-web-apple-touch-180.png"));
magick(sourceSvg, "-resize", "32x32", join(prodDir, "t3-black-web-favicon-32x32.png"));
magick(sourceSvg, "-resize", "16x16", join(prodDir, "t3-black-web-favicon-16x16.png"));
magick(
  sourceSvg,
  "-define",
  "icon:auto-resize=256,128,64,48,32,16",
  join(prodDir, "t3-black-web-favicon.ico"),
);
magick(
  sourceSvg,
  "-define",
  "icon:auto-resize=256,128,64,48,32,16",
  join(prodDir, "t3-black-windows.ico"),
);

copyFileSync(sourceSvg, join(prodDir, "logo.svg"));

mkdirSync(webPublicDir, { recursive: true });
copyFileSync(join(prodDir, "t3-black-web-favicon.ico"), join(webPublicDir, "favicon.ico"));
copyFileSync(join(prodDir, "t3-black-web-favicon-16x16.png"), join(webPublicDir, "favicon-16x16.png"));
copyFileSync(join(prodDir, "t3-black-web-favicon-32x32.png"), join(webPublicDir, "favicon-32x32.png"));
copyFileSync(join(prodDir, "t3-black-web-apple-touch-180.png"), join(webPublicDir, "apple-touch-icon.png"));
copyFileSync(sourceSvg, join(webPublicDir, "logo-mark.svg"));

mkdirSync(desktopResourcesDir, { recursive: true });
const sourcePng = join(prodDir, "black-macos-1024.png");
copyFileSync(sourcePng, join(desktopResourcesDir, "icon.png"));
copyFileSync(join(prodDir, "t3-black-windows.ico"), join(desktopResourcesDir, "icon.ico"));

const iconsetDir = join(repoRoot, ".tmp-icon.iconset");
mkdirSync(iconsetDir, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  sips("-z", String(size), String(size), sourcePng, "--out", join(iconsetDir, `icon_${size}x${size}.png`));
  sips(
    "-z",
    String(size * 2),
    String(size * 2),
    sourcePng,
    "--out",
    join(iconsetDir, `icon_${size}x${size}@2x.png`),
  );
}
execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", join(desktopResourcesDir, "icon.icns")], {
  stdio: "inherit",
});
rmSync(iconsetDir, { recursive: true, force: true });

console.log("Generated production brand rasters from", LOGO_MARK_DARK_SVG);
console.log("Synced apps/web/public and apps/desktop/resources");
