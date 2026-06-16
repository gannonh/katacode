---
type: Runbook
title: "Release Checklist"
description: "Fork release workflow for KataCode desktop and CLI packages."
tags: [operations, runbook]
timestamp: 2026-06-16T17:10:05Z
---

# Release Checklist

This runbook describes the **KataCode fork** release workflow. Upstream T3 release docs are obsolete for this repository.

## What the workflow does

- Workflow: `.github/workflows/release.yml`
- Triggers:
  - push tag matching `v*.*.*` for stable releases
  - manual `workflow_dispatch` for stable or nightly channels
- **Phase 2 note:** The upstream nightly cron schedule is disabled until fork release channels and secrets are split. Use `workflow_dispatch` for nightly builds during Phase 1.
- Runs quality gates first: `vp check`, `vpr typecheck`, `vp run test`.
- Builds macOS (`arm64`, `x64`), Linux (`x64`), and Windows (`x64`) desktop artifacts.
- Publishes the CLI package **`@kata-sh/code-cli`** (binary `katacode`) with OIDC trusted publishing:
  - stable releases publish npm dist-tag `latest`
  - nightly releases publish npm dist-tag `nightly`
- Signing is optional and auto-detected per platform from secrets.

## Phase 2 — not yet fork-complete

The following remain upstream-shaped and are gated until [Phase 2 in FORK.md](../../FORK.md#phase-2--infrastructure-split):

- Hosted web deploy targets (`app.t3.codes`, channel cookies)
- Production relay auto-deploy on every `main` push (`.github/workflows/deploy-relay.yml` is `workflow_dispatch` only until Phase 2)
- Fork-specific npm/desktop update channels and signing identities

Do **not** configure upstream production secrets on the fork repo until Phase 2 checklist items are complete.

## Local verification before tagging

```bash
vp check
vp run typecheck
vp run test
vp run build:desktop
```

## Related

- [CI quality gates](./ci.md)
- [Fork setup spec](../specs/fork-setup.md)
- [FORK.md — Phase 2](../../FORK.md#phase-2--infrastructure-split)
