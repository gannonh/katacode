---
type: Guide
title: "Upstream sync"
description: "How to selectively merge upstream T3 Code changes into Kata Code while preserving product independence and manageable conflict surface."
tags: [fork, git, upstream, guide]
timestamp: 2026-06-17T23:30:00Z
---

# Upstream sync

Use this guide when pulling changes from [pingdotgg/t3code](https://github.com/pingdotgg/t3code) into [gannonh/kata-code](https://github.com/gannonh/kata-code).

**Policy:** [ADR 0003 — Episodic upstream sync](/adrs/0003-episodic-upstream-sync.md). **Mechanics:** [FORK.md — Phase 3](../../FORK.md#phase-3--upstream-sync-runbook). **Boundaries:** [FORK.md — Phase 4](../../FORK.md#phase-4--divergence-boundaries).

Kata Code does **not** aim for parity with `upstream/main`. Sync when there is a concrete reason, not on a fixed weekly schedule.

## Prerequisites

- `upstream` remote → `https://github.com/pingdotgg/t3code.git` (read-only; never push)
- `origin` remote → `gannonh/kata-code`
- Read [FORK.md](../../FORK.md) and note the **Last upstream sync** baseline SHA (currently `708d5383` if no sync has completed yet)
- Clean working tree on `main`

## When to sync

| Trigger                         | Example                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Security / reliability          | Upstream fix for provider crash, auth bypass, data loss                      |
| Shared protocol change          | `packages/contracts` or WebSocket RPC shape change you need                  |
| Bounded feature absorb          | “Take upstream Codex adapter refactor through commit X”                      |
| Pre-flight before fork refactor | Large Kata-only change touching `server`/`web` — optional smaller sync first |

| Usually skip                          | Example                                        |
| ------------------------------------- | ---------------------------------------------- |
| Upstream branding / T3 product work   | UI copy, `t3code://`, `@t3tools/*`             |
| Upstream release/CI only              | Their deploy pipelines, secrets, domains       |
| Already rejected (see divergence log) | Features Kata Code intentionally does not ship |

## When **not** to “disconnect” upstream

Removing the `upstream` remote or unlinking the GitHub fork badge does **not** make merges easier. Shared git history is what makes selective merges tractable. Independence is expressed through product identity, release pipeline, and the [divergence log](../../FORK.md#divergence-log) — not by severing ancestry.

## Step 0 — Inventory upstream commits

```bash
git fetch upstream --tags
BASE=<last-sync-sha>   # e.g. 708d5383 from FORK.md
git log --oneline ${BASE}..upstream/main
```

For each commit or grouped range, mark in the sync PR description or a scratch note:

- **Take** — include in merge
- **Cherry-pick** — take alone without full merge (urgent hotfix)
- **Reject** — skip permanently; add to [FORK.md divergence log](../../FORK.md#divergence-log)
- **Defer** — revisit later

Update the divergence log **before** merging so rejected work is not re-debated every sync.

## Step 1 — Open a sync branch

```bash
git checkout main
git pull origin main
git checkout -b upstream-sync-$(date +%Y-%m-%d)
```

Optional: merge a specific upstream SHA instead of branch tip:

```bash
git merge <upstream-sha>
```

## Step 2 — Merge and resolve conflicts

```bash
git merge upstream/main
# or: git merge <pinned-upstream-sha>
```

### High-conflict zones

| Zone                        | Why                                       |
| --------------------------- | ----------------------------------------- |
| `packages/contracts/`       | Schemas ripple to server and all clients  |
| `packages/shared/`          | Shared runtime utilities                  |
| `apps/server/`              | Providers, CLI, sessions                  |
| `apps/web/`                 | UI, WebSocket client, session UX          |
| `apps/desktop/`             | Electron shell, branding, backend manager |
| `scripts/dev-runner.ts`     | Dev ports and orchestration               |
| `pnpm-lock.yaml`            | Regenerate with `vp i` after merge        |
| Root and app `package.json` | Scripts, filters, versions                |

**Resolution rules:**

- Restore Kata Code branding (`Kata Code`, `KATACODE_*`, `katacode://`, `@kata-sh/code-*`) on product surfaces — never reintroduce `@t3tools/*` or `T3CODE_*` without an explicit [FORK.md](../../FORK.md) decision.
- Prefer keeping fork extension modules over inlining fork logic into shared upstream files.
- After conflict resolution: `vp i` (do not hand-merge `pnpm-lock.yaml` for long).

See [CI runbook — fork rebrand test fixtures](/operations/ci.md#fork-rebrand-test-fixtures): product surfaces use Kata Code identity; fixture repo names may remain upstream-shaped (`octocat/t3code`).

## Step 3 — Sync vendored reference repos (if deps changed)

```bash
vp run sync:repos
# or one repo:
node scripts/sync-reference-repos.ts --repo <id>
```

## Step 4 — Verify

```bash
vp run --filter @kata-sh/code-desktop ensure:electron   # if desktop touched
vp check
vp run typecheck
vp run test
vp run release:smoke                                   # if release paths touched
```

Smoke manually when touching session UX or providers:

```bash
pnpm run dev          # web + server
pnpm run dev:desktop  # Electron
```

## Step 5 — Land on main

```bash
git checkout main
git merge upstream-sync-$(date +%Y-%m-%d)
git push origin main
```

Update [FORK.md](../../FORK.md) **Last upstream sync** block:

```text
Last upstream sync: YYYY-MM-DD
Upstream SHA:       <merged-upstream-tip-or-pin>
Fork SHA after merge: <main-commit>
Conflicts resolved in: <paths>
Verification:       vp check && vp run typecheck && vp run test
```

Record any **reject** / **cherry-pick** entries in the [divergence log](../../FORK.md#divergence-log).

## Cherry-pick path (urgent single commit)

```bash
git fetch upstream
git checkout -b cherry-pick-<short-sha>
git cherry-pick <upstream-commit-sha>
# verify, merge to main, push
```

Log the SHA under **Cherry-picks (outside full merges)** in [FORK.md](../../FORK.md#divergence-log).

## Developing fork features with future syncs in mind

Follow [FORK.md — Phase 4](../../FORK.md#phase-4--divergence-boundaries):

| Prefer                                  | Avoid                                               |
| --------------------------------------- | --------------------------------------------------- |
| New package under `packages/kata-*`     | `if (katacode)` branches in shared core             |
| Adapter at provider boundary            | Renaming upstream types in place                    |
| Fork specs and ADRs under `docs/specs/` | Rewriting upstream architecture docs in place       |
| Thin hooks into shared modules          | Large edits across `contracts` for fork-only fields |

Before a large fork-only feature, ask: _can this live in a new module upstream does not touch?_ If yes, put it there.

## Related

- [ADR 0001 — Connected fork](/adrs/0001-connected-fork-upstream-merge.md)
- [ADR 0003 — Episodic sync policy](/adrs/0003-episodic-upstream-sync.md)
- [Fork setup spec](/specs/fork-setup.md)
- [FORK.md](../../FORK.md)
