---
type: Runbook
title: "CI quality gates"
description: "Local and CI quality gates using Vite+ (`vp`) commands."
tags: [operations, runbook]
timestamp: 2026-06-16T17:10:05Z
---

# CI quality gates

- `.github/workflows/ci.yml` runs on every pull request and push to `main` (`vp check`, `vp run typecheck`, `vp run test`, `vp run build:desktop`).
- Release, relay deploy, and mobile EAS preview are **not** active — they live in [`.github/disabled/`](../.github/disabled/README.md) until [Phase 2](../../FORK.md#phase-2--infrastructure-split). Do not use branch-name `if:` skips; move whole workflows to `disabled/` instead.
- Archived plans under `docs/specs/plans/` may still reference upstream toolchain commands; use this runbook and [AGENTS.md](../../AGENTS.md) for current tooling.
- See [Release Checklist](./release.md) for desktop/npm release workflow (fork-specific release split pending Phase 2).
