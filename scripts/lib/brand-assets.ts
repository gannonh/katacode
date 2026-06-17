export const BRAND_ASSET_PATHS = {
  logoMarkDarkSvg: "assets/logo-square-dark.svg",
  logoMarkLightSvg: "assets/logo-square-light.svg",

  desktopIconSourcePng: "apps/desktop/resources/source.png",
  desktopAppIconIcns: "apps/desktop/resources/AppIcon.icns",
  desktopLiquidGlassAssetsCar: "apps/desktop/resources/liquid-glass/Assets.car",

  productionMacIconPng: "assets/prod/black-macos-1024.png",
  productionLinuxIconPng: "assets/prod/black-universal-1024.png",
  productionWindowsIconIco: "assets/prod/katacode-windows.ico",
  productionWebFaviconIco: "assets/prod/katacode-web-favicon.ico",
  productionWebFavicon16Png: "assets/prod/katacode-web-favicon-16x16.png",
  productionWebFavicon32Png: "assets/prod/katacode-web-favicon-32x32.png",
  productionWebAppleTouchIconPng: "assets/prod/katacode-web-apple-touch-180.png",
} as const;

export type WebAssetBrand = "development" | "nightly" | "production";

export const WEB_ASSET_CHANNELS = ["latest", "nightly"] as const;

export type WebAssetChannel = (typeof WEB_ASSET_CHANNELS)[number];

/** All hosted channels ship the production Kata mark (no upstream blueprint artwork). */
export function resolveWebAssetBrandForChannel(_channel: WebAssetChannel): WebAssetBrand {
  return "production";
}

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

const WEB_ICON_TARGET_FILENAMES = {
  faviconIco: "favicon.ico",
  favicon16Png: "favicon-16x16.png",
  favicon32Png: "favicon-32x32.png",
  appleTouchIconPng: "apple-touch-icon.png",
} as const;

const PRODUCTION_WEB_ICON_SOURCES = {
  faviconIco: BRAND_ASSET_PATHS.productionWebFaviconIco,
  favicon16Png: BRAND_ASSET_PATHS.productionWebFavicon16Png,
  favicon32Png: BRAND_ASSET_PATHS.productionWebFavicon32Png,
  appleTouchIconPng: BRAND_ASSET_PATHS.productionWebAppleTouchIconPng,
} as const;

const WEB_ICON_SOURCE_PATHS_BY_BRAND = {
  development: PRODUCTION_WEB_ICON_SOURCES,
  nightly: PRODUCTION_WEB_ICON_SOURCES,
  production: PRODUCTION_WEB_ICON_SOURCES,
} as const satisfies Record<WebAssetBrand, Record<keyof typeof WEB_ICON_TARGET_FILENAMES, string>>;

export function resolveWebIconOverrides(
  brand: WebAssetBrand,
  targetDirectory: string,
): ReadonlyArray<IconOverride> {
  const sourcePaths = WEB_ICON_SOURCE_PATHS_BY_BRAND[brand];
  return [
    {
      sourceRelativePath: sourcePaths.faviconIco,
      targetRelativePath: `${targetDirectory}/${WEB_ICON_TARGET_FILENAMES.faviconIco}`,
    },
    {
      sourceRelativePath: sourcePaths.favicon16Png,
      targetRelativePath: `${targetDirectory}/${WEB_ICON_TARGET_FILENAMES.favicon16Png}`,
    },
    {
      sourceRelativePath: sourcePaths.favicon32Png,
      targetRelativePath: `${targetDirectory}/${WEB_ICON_TARGET_FILENAMES.favicon32Png}`,
    },
    {
      sourceRelativePath: sourcePaths.appleTouchIconPng,
      targetRelativePath: `${targetDirectory}/${WEB_ICON_TARGET_FILENAMES.appleTouchIconPng}`,
    },
  ];
}

export const PUBLISH_ICON_OVERRIDES = resolveWebIconOverrides("production", "dist/client");

/** Local server builds use the same production icons as release bundles. */
export const DEVELOPMENT_ICON_OVERRIDES = PUBLISH_ICON_OVERRIDES;
