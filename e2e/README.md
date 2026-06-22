# Kata Code local Electron E2E

Local-only Playwright end-to-end tests for the Kata Code Electron desktop app on macOS. The suite uses real Clerk, real provider APIs, and real local workspace data. It is intentionally **not** wired into CI.

## Prerequisites

- macOS with a GUI session (Electron requires a desktop session even in unattended mode)
- Node.js and `pnpm` per the repo root
- Desktop build artifacts:
  ```bash
  vp run --filter @kata-sh/code-desktop ensure:electron
  vp run --filter @kata-sh/code-desktop --filter @kata-sh/code-cli build
  ```
- Playwright browsers (first run):
  ```bash
  pnpm exec playwright install
  ```

## Environment variables

Set these in `.env.local` (gitignored; recommended) or export them in your shell. The E2E runner loads `.env` and `.env.local` from the repo root automatically.

### Clerk (required for `@auth`, `@smoke`, `@settings`)

| Variable                       | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `CLERK_PUBLISHABLE_KEY`        | Clerk publishable key (`pk_test_…` or `pk_live_…`)   |
| `CLERK_SECRET_KEY`             | Clerk secret key for `@clerk/testing` setup          |
| `KATACODE_E2E_GOOGLE_EMAIL`    | Dedicated Google test user email                     |
| `KATACODE_E2E_GOOGLE_PASSWORD` | Google test user password for UI OAuth when required |

Canonical `KATACODE_CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` are also accepted for the publishable key.

### Deterministic agent tests (`@agent`)

| Variable                      | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `KATACODE_E2E_AGENT_PROVIDER` | Provider driver id configured in the app (for example `openai`) |
| `KATACODE_E2E_AGENT_MODEL`    | Model id to select in the UI                                    |
| `OPENAI_API_KEY`              | Required when provider is OpenAI                                |
| `ANTHROPIC_API_KEY`           | Required when provider is Anthropic                             |

### Release target (`desktop-release` project)

| Variable                   | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `KATACODE_E2E_RELEASE_APP` | Absolute path to a built `.app` bundle, for example `/Applications/Kata Code.app` |

### Runner controls

| Variable               | Default | Purpose                                                                                                                   |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `KATACODE_E2E_WORKERS` | `1`     | Parallel workers. Authenticated mutable tests default to one worker because only one Google test user is available in V1. |
| `KATACODE_E2E_VIDEO`   | off     | Set to `1` to retain failure video artifacts                                                                              |
| `KATACODE_PORT_OFFSET` | auto    | Optional fixed port offset for isolated dev stacks                                                                        |

## Commands

From the repo root:

```bash
# List tests
vp run e2e --list

# Unattended local run (default Playwright runner mode)
vp run e2e --project desktop-dev --grep @smoke

# Headed debugging
vp run e2e:headed --grep @smoke

# Interactive Playwright UI
vp run e2e:ui --grep @settings

# Release app validation
KATACODE_E2E_RELEASE_APP="/path/to/Kata Code.app" vp run e2e:release --grep @smoke
```

### Feature tags

| Tag         | Coverage                            |
| ----------- | ----------------------------------- |
| `@smoke`    | Electron launch + signed-in surface |
| `@auth`     | Clerk Google test-user sign-in      |
| `@settings` | Settings theme persistence          |
| `@agent`    | Real LLM deterministic reply        |

Filter with `--grep`, for example `vp run e2e --project desktop-dev --grep @settings`.

## Artifacts (ignored by git)

Each run writes a manifest under `e2e/test-results/<run-id>/manifest.json` with:

- run id
- `KATACODE_HOME`
- server and web ports
- artifact root
- seeded workspace root

Additional outputs:

- `e2e/playwright-report/` — HTML report
- `e2e/test-results/results.json` — JSON report
- traces and screenshots on failure
- video when `KATACODE_E2E_VIDEO=1`
- `e2e/.auth/` — local Clerk auth state

## Architecture

- `e2e/src/harness/` — reusable Electron/process/isolation helpers (no Kata product selectors)
- `e2e/src/flows/` — Kata-specific UI workflows (auth, settings, workspace, agent chat)
- `e2e/tests/` — small starter specs composing harness + flows

Service mocking (`route().fulfill()`, HAR replay, MSW, fake backends) is out of scope. Native OS dialog control through Electron main-process hooks is allowed only for OS UI determinism and must be documented at the call site.

## Nightly release validation

Before promoting a nightly desktop build:

```bash
KATACODE_E2E_RELEASE_APP="/path/to/Kata Code.app" vp run e2e:release --grep @smoke
KATACODE_E2E_RELEASE_APP="/path/to/Kata Code.app" vp run e2e:release --grep @settings
```

## Authoring new tests

See `.agents/skills/e2e-test-author/SKILL.md` for agent-oriented guidance.
