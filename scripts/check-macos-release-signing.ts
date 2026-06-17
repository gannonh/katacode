#!/usr/bin/env node

import {
  MACOS_RELEASE_SIGNING_SECRET_NAMES,
  resolveMacOsReleaseSigning,
} from "./lib/macos-release-signing.ts";

const signingStatus = resolveMacOsReleaseSigning({
  CSC_LINK: process.env.CSC_LINK,
  CSC_KEY_PASSWORD: process.env.CSC_KEY_PASSWORD,
  APPLE_ID: process.env.APPLE_ID,
  APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
});

if (signingStatus.ready) {
  process.stdout.write(
    `macOS release signing inputs ready (${MACOS_RELEASE_SIGNING_SECRET_NAMES.join(", ")}).\n`,
  );
  process.exit(0);
}

process.stderr.write(
  `Missing required macOS release signing secrets: ${signingStatus.missing.join(", ")}\n`,
);
process.exit(1);
