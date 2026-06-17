/**
 * electron-builder afterPack hook
 *
 * Copies pre-compiled macOS 26+ Liquid Glass icon (Assets.car) into the app bundle.
 *
 * To regenerate Assets.car after icon changes:
 *   cd apps/desktop
 *   xcrun actool "resources/liquid-glass/AppIcon.icon" --compile "resources/liquid-glass" \
 *     --app-icon AppIcon --minimum-deployment-target 26.0 \
 *     --platform macosx --output-partial-info-plist /dev/null
 */

const path = require("node:path");
const fs = require("node:fs");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const productName = context.packager.appInfo.productName;
  const projectDir = context.packager.projectDir;
  const resourcesDir = path.join(context.appOutDir, `${productName}.app`, "Contents", "Resources");
  const precompiledAssets = path.join(projectDir, "apps/desktop/resources/liquid-glass/Assets.car");

  if (!fs.existsSync(precompiledAssets)) {
    console.log("afterPack: Assets.car not found — app will use AppIcon.icns");
    return;
  }

  fs.copyFileSync(precompiledAssets, path.join(resourcesDir, "Assets.car"));
  console.log("afterPack: Liquid Glass icon (Assets.car) copied");
};
