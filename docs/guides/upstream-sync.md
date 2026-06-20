---
type: Guide
title: "Upstream sync"
description: "Selective upstream sync runbook for Kata Code: inventory, classify, bulk-merge, resolve, verify, record. Pairs with the upstream-sync skill and its helper scripts."
tags: [fork, git, upstream, guide, runbook]
timestamp: 2026-06-20T00:00:00Z
---

# Upstream sync

Runbook for pulling changes from [pingdotgg/t3code](https://github.com/pingdotgg/t3code) into [gannonh/kata-code](https://github.com/gannonh/kata-code).

**Policy:** [ADR 0003 — Episodic upstream sync](/adrs/0003-episodic-upstream-sync.md). **Fork mechanics & divergence log:** [FORK.md](../../FORK.md) (Phase 3 runbook, Phase 4 divergence boundaries). **Agent-facing process:** [.agents/skills/upstream-sync/SKILL.md](../../.agents/skills/upstream-sync/SKILL.md).

Kata Code does **not** aim for parity with `upstream/main`. Sync when there is a concrete reason. The full process is codified as the `upstream-sync` skill so it stays repeatable and does not drift across syncs.

## Strategy

Default to a **single bulk merge** of `upstream/main` (or a pinned upstream SHA) on a sync branch. Use cherry-pick only for an individual hotfix when a full merge is not ready.

Bulk merge beats cherry-picking when the upstream diff contains coordinated refactors that depend on each other — the `[codex]` Effect service migration is the canonical example. Cherry-picking those commits individually tends to break compilation because they assume each other.

Use the **inventory + classify** step below to confirm the diff shape before committing to a strategy. If the diff is a handful of independent fixes, cherry-pick or wave-based absorbs are reasonable. If it is one or more coordinated refactors, bulk merge.

## Prerequisites

- `origin` → `gannonh/kata-code`, `upstream` → `https://github.com/pingdotgg/t3code.git` (read-only; never push)
- Clean working tree on `main`
- The **Last upstream sync** block in [FORK.md](../../FORK.md) records the baseline SHA (`Upstream SHA:` line). The classifier reads it from there.

## Step 0 — Prepare a clean integration branch

Start here. The classifier and conflict-zones scripts write `sync-plan.md` / `conflict-zones.md` into the working tree; keep those artifacts (and the eventual merge) isolated on an integration branch so `main` stays clean.

```bash
git checkout main
git status --short        # must be empty before continuing
git pull origin main
git fetch upstream --tags
git checkout -b upstream-sync-$(date +%Y-%m-%d)
```

If you are already on a `upstream-sync-*` branch (or in a dedicated worktree for this sync), stay there: confirm `git status --short` is clean and continue to Step 1. Resume by default; a fresh branch loses prior conflict-resolution work.

## Step 1 — Inventory and classify upstream commits

Produce a draft classification table, then review it.

```bash
node .agents/skills/upstream-sync/scripts/classify-upstream.ts --out sync-plan.md
```

The script:

1. Reads the baseline SHA from `FORK.md` (or `--base <sha>`, else `git merge-base main upstream/main`).
2. Lists every non-merge upstream commit since baseline.
3. Applies the rules in [`scripts/rules.ts`](../../.agents/skills/upstream-sync/scripts/rules.ts) — commit-message patterns (`[codex]` coordinated refactor = take; marketing / mobile-EAS = reject), path heuristics (`packages/contracts`, `apps/server|web|desktop` = take; `apps/marketing`, disabled workflows = reject), and the FORK.md divergence surfaces (`wireIdentity`, internal `t3://` protocol, `infra/relay/src` = defer).
4. Emits `sync-plan.md` grouped by verdict, with rationale for each commit. (`sync-plan.md` and `conflict-zones.md` are gitignored scratch artifacts, regenerated on each run.)

**Read every verdict, especially anything not a clean Take.** Use precise vocabulary: Take (absorb cleanly), Reject (permanently skip; log in FORK.md), Defer (tied to a named fork project phase or revisit trigger, cross-sync, see [deferred-work registry](../../docs/specs/deferred-work.md)), and Review (unclassified, pending human verdict — read a `defer` with "No rule matched" rationale this way). For commits flagged take+defer (a `[codex]` refactor that touches a fork divergence surface), plan for manual conflict resolution rather than a clean take. Confirm Take/Reject before merging, and record new Rejects in the [FORK.md divergence log](../../FORK.md#divergence-log) **before** merging so rejected work is not re-debated next sync.

To pin to a specific upstream tip instead of `upstream/main`, note the SHA from `sync-plan.md` and use `git merge <upstream-sha>` in Step 3.

## Step 2 — Predict conflict zones

```bash
node .agents/skills/upstream-sync/scripts/conflict-zones.ts --out conflict-zones.md
```

Intersects upstream-changed paths with fork-changed paths since baseline and the [FORK.md high-conflict zone catalog](../../FORK.md#high-conflict-zones). The zone rollup tells you where to budget resolution time (e.g. "196 conflicting files in apps/server"). Use it to scope the merge session and to decide whether a single bulk merge is sane or whether a wave-based absorb is worth the extra PRs.

## Step 3 — Merge and resolve conflicts

```bash
git merge upstream/main   # or the pinned SHA from Step 1
```

### Resolution rules

These rules encode fork policy. Apply them consistently so the fork does not silently drift back toward upstream identity.

- **Restore Kata Code branding** on every product surface: `Kata Code`, `KATACODE_*`, `katacode://` / `katacode-dev://`, `@kata-sh/code-*`, `com.katacode.app`. Never reintroduce `@t3tools/*` or `T3CODE_*` without an explicit [FORK.md](../../FORK.md) decision.
- **Prefer fork extension modules** over inlining fork logic into shared upstream files. When upstream moved a file the fork also moved, keep the fork location and reapply the divergence there.
- **Do not hand-merge `pnpm-lock.yaml`.** Delete it, run `vp i`, let pnpm regenerate it.
- **Keep fork rebrand test fixtures** upstream-shaped where they must be: product surfaces use Kata identity, but fixture repo names may remain `octocat/t3code`. See [CI runbook — fork rebrand test fixtures](/operations/ci.md#fork-rebrand-test-fixtures).
- **Resolution choices of `ours` vs `theirs` are decisions, not defaults.** Note non-obvious resolutions in the sync PR description so the next maintainer can follow the reasoning.

### High-conflict zones

The zones the conflict-zones script rolls up. Expect the most effort here:

| Zone                         | Why                                       |
| ---------------------------- | ----------------------------------------- |
| `apps/server/`               | Providers, CLI, session lifecycle         |
| `apps/web/`                  | UI state, WebSocket client, session UX    |
| `apps/desktop/`              | Electron main, backend manager, branding  |
| `packages/contracts/`        | Protocol/schema changes ripple everywhere |
| `packages/shared/`           | Shared runtime utilities                  |
| `scripts/dev-runner.ts`      | Dev env and ports                         |
| `pnpm-lock.yaml`             | Always regenerate with `vp i` after merge |
| `package.json` (root + apps) | Scripts, filters, version bumps           |

## Step 4 — Sync vendored reference repos (if deps changed)

If upstream bumped Effect, Alchemy, or another dependency with a vendored subtree under `.repos/`:

```bash
vp run sync:repos
# or one repo:
node scripts/sync-reference-repos.ts --repo <id>
```

Keep `.repos/` matched to the installed dependency version in the same sync.

## Step 5 — Verify

```bash
vp i                                              # after lockfile regen
vp run --filter @kata-sh/code-desktop ensure:electron   # if desktop touched
vp check
vp run typecheck
vp run test
vp run release:smoke                              # if release paths touched
```

Smoke session UX and providers manually when those areas changed:

```bash
pnpm run dev          # web + server
pnpm run dev:desktop  # Electron
```

If changing native mobile code, also run `vp run lint:mobile`.

Do not land the merge until `vp check` and `vp run typecheck` pass. These gates are required by [AGENTS.md](../../AGENTS.md) before a task is considered complete.

## Step 6 — Post-merge closure

Almost every non-trivial merge produces a tail of follow-up work **caused by this merge** that must land on **this integration branch** before it merges to `main`. This is distinct from the [deferred-work registry](../../docs/specs/deferred-work.md) (cross-sync backlog): closure work is scoped to this sync, has acceptance criteria, and is part of this sync's definition of done.

Common closure work: branding re-application the merge reverted, build-injection verification for new build-time constants or env (e.g. a Clerk publishable key define flowing from the release workflow's `production` environment), [OKF bundle](../../docs/index.md) integration of upstream-internal docs the merge absorbed (`.macroscope/*` Effect conventions → `docs/reference/` or `docs/operations/`), classifier rule updates when the merge exposed a rule gap, and vendored-repo follow-up if Step 4 could not fully converge.

Route closure through the **`plan-build-verify`** skill: author a spec at `docs/specs/YYYY-MM-DD-upstream-sync-closure.md` with a `## Acceptance criteria` section, build against it, and verify with evidence artifacts. Link the spec from the [specs roadmap](../../docs/specs/index.md) row for this sync and promote that row to Active.

If `plan-build-verify` is not installed, add it first: `npx skills add https://github.com/gannonh/skills --skill plan-build-verify -y`. This is the only external skill this runbook depends on.

Trivial syncs (clean merge, no follow-up surfaced) may skip this step — state that explicitly and proceed to Step 7. The default for any merge that touched branding, build injection, or absorbed internal docs is to run closure.

Do not merge the branch to `main` (Step 7) until closure is complete and its acceptance criteria pass.

## Step 7 — Land and record

```bash
git checkout main
git merge upstream-sync-$(date +%Y-%m-%d)
git push origin main
```

Update the **Last upstream sync** block in [FORK.md](../../FORK.md):

```text
Last upstream sync: YYYY-MM-DD
Upstream SHA:       <merged-upstream-tip-or-pin>
Fork SHA after merge: <main-commit>
Conflicts resolved in: <paths or zones>
Verification:       vp check && vp run typecheck && vp run test
Closure spec:       docs/specs/YYYY-MM-DD-upstream-sync-closure.md (or 'n/a — trivial merge')
```

Record any **Reject** entries in the [divergence log](../../FORK.md#divergence-log). Record cherry-picks outside full merges under **Cherry-picks (outside full merges)**. After landing, update the OKF bundle (`docs/log.md`; `docs/specs/log.md`; add the closure spec to the [specs roadmap](../../docs/specs/index.md)).

## Cherry-pick path (urgent single commit)

```bash
git fetch upstream
git checkout -b cherry-pick-<short-sha>
git cherry-pick <upstream-commit-sha>
# verify, merge to main, push
```

Log the SHA under **Cherry-picks (outside full merges)** in [FORK.md](../../FORK.md#divergence-log).

## When not to "disconnect" upstream

Removing the `upstream` remote or unlinking the GitHub fork badge does not make merges easier. Shared git history is what makes selective merges tractable. Independence is expressed through product identity, release pipeline, and the divergence log, not by severing ancestry.

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
- [upstream-sync skill](../../.agents/skills/upstream-sync/SKILL.md)
- Classifier rules: [`scripts/rules.ts`](../../.agents/skills/upstream-sync/scripts/rules.ts)
