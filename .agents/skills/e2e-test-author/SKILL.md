---
name: e2e-test-author
description: Author local Playwright Electron E2E tests for Kata Code using the reusable harness and Kata-specific flows. Use when adding or updating tests under e2e/.
---

# E2E test author

## Before writing code

1. Read `e2e/README.md` and the relevant product spec.
2. Inspect existing tests under `e2e/tests/` and reusable blocks in `e2e/src/harness/` and `e2e/src/flows/`.
3. Choose the smallest tag-filtered command to validate your change.

## Rules

- Compose tests from `e2e/src/harness/` and `e2e/src/flows/` — do not duplicate launch, auth, isolation, or navigation logic in spec files.
- Keep generic Electron/process concerns in `harness/` and Kata UI/product language in `flows/`.
- Do **not** mock application services: no Playwright `route().fulfill()`, HAR replay, MSW, or fake provider backends.
- Store secrets and auth state only under ignored paths (`e2e/.auth/`, Playwright output dirs, local `.env.local`).
- Tag every spec with at least one feature tag: `@smoke`, `@auth`, `@settings`, or `@agent`.
- Fail loudly with the missing env var or prerequisite when credentials are absent — never skip assertions silently.
- Prefer user-visible locators (role, label, text). Add `data-testid` in product code only when no durable accessible locator exists and the attribute is a deliberate test contract.
- Default to one worker for authenticated mutable flows unless additional isolated test accounts exist.

## Typical test shape

```ts
import { E2E_TAGS } from "../../src/config/tags.ts";
import { test } from "../../src/harness/testFixtures.ts";
import { signInWithClerkGoogleTestUser } from "../../src/flows/auth.ts";

test.describe(`My feature ${E2E_TAGS.settings}`, () => {
  test("does the user-visible behavior", async ({ appWindow, runContext }) => {
    await signInWithClerkGoogleTestUser(appWindow);
    // feature-specific steps only
  });
});
```

## Verification commands

```bash
vp run e2e --list --grep @your-tag
vp run e2e --project desktop-dev --grep @your-tag
vp check
vp run typecheck
```

For release-only coverage:

```bash
KATACODE_E2E_RELEASE_APP="/path/to/Kata Code.app" vp run e2e:release --grep @smoke
```
