import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(mobileRoot, "../..");

describe("development app variant assets", () => {
  it("uses Kata production brand rasters instead of legacy upstream placeholders", () => {
    const iconPath = resolve(mobileRoot, "assets/icon.png");
    const splashPath = resolve(mobileRoot, "assets/splash-icon.png");
    const brandSourcePath = resolve(repoRoot, "assets/prod/black-ios-1024.png");

    expect(existsSync(iconPath)).toBe(true);
    expect(existsSync(splashPath)).toBe(true);
    expect(existsSync(brandSourcePath)).toBe(true);

    const iconBytes = statSync(iconPath).size;
    const brandBytes = statSync(brandSourcePath).size;

    expect(iconBytes).toBe(brandBytes);
    expect(statSync(splashPath).size).toBe(brandBytes);
  });

  it("uses the desktop Liquid Glass icon bundle for the iOS home screen", () => {
    const appConfigSource = readFileSync(resolve(mobileRoot, "app.config.ts"), "utf8");
    const kanjiPath = resolve(mobileRoot, "assets/icon-composer-prod.icon/Assets/kanji.png");
    const desktopKanjiPath = resolve(
      repoRoot,
      "apps/desktop/resources/liquid-glass/AppIcon.icon/Assets/kanji.png",
    );
    const iconJsonPath = resolve(mobileRoot, "assets/icon-composer-prod.icon/icon.json");

    expect(appConfigSource).toContain("icon: iosHomeScreenIcon");
    expect(appConfigSource).toContain('"./assets/icon-composer-prod.icon"');
    expect(existsSync(kanjiPath)).toBe(true);
    expect(statSync(kanjiPath).size).toBe(statSync(desktopKanjiPath).size);
    expect(readFileSync(iconJsonPath, "utf8")).toContain('"image-name": "kanji.png"');
    expect(readFileSync(iconJsonPath, "utf8")).toContain('"scale": 0.64');
  });
});
