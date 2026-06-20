---
name: upstream-sync
description: "Selective upstream sync runbook for the Kata Code fork of T3 Code. Use when the user wants to sync, merge, or pull changes from upstream (pingdotgg/t3code), inventory what's new upstream, classify commits as Take/Reject/Defer, predict merge conflicts, absorb an upstream feature or fix, run an episodic upstream merge, cherry-pick an upstream commit, or update the FORK.md baseline. Also covers 'what changed upstream since last sync' and 'should we take this upstream change.' This skill IS the runbook; follow it end-to-end so the process stays repeatable and does not drift across syncs."
---

# Upstream sync

This skill is the canonical runbook for pulling changes from `pingdotgg/t3code` into `gannonh/kata-code`. The human-facing guide at `docs/guides/upstream-sync.md` mirrors this process and points back here; the helper scripts bundled under `scripts/` in this skill automate the inventory and classification steps. Run them from the repo root:

**Policy:** ADR 0003 (episodic sync, no parity target). **Fork baseline & divergence log:** `FORK.md`. Read both before a first-time sync.

Kata Code syncs when there is a concrete reason — a security/reliability fix, a shared protocol change, or a bounded upstream feature worth absorbing. There is no fixed weekly schedule.

## Core strategy

Default to a **single bulk merge** of `upstream/main` (or a pinned upstream SHA) on a sync branch. Cherry-pick is the exception path for an urgent single hotfix.

Why bulk merge by default: upstream periodically ships coordinated refactors (the `[codex]` Effect service migration is the archetype) whose commits depend on each other. Cherry-picking them individually breaks compilation. The inventory step below tells you when this applies; if the diff is a handful of independent fixes, the same runbook supports cherry-pick or wave-based absorbs instead.

## Process

Follow these steps in order. Steps 0 and 1 are read-only and safe to run anytime for a status check. Steps 2+ mutate the repo.

### Step 0 — Inventory and classify

Produce a draft Take / Cherry-pick / Reject / Defer table, then review it. Do not skip the human review: the classifier is a starting point, not a final decision.

```bash
node .agents/skills/upstream-sync/scripts/classify-upstream.ts --out sync-plan.md
```

The script reads the baseline SHA from `FORK.md`'s `Upstream SHA:` line (override with `--base <sha>`; falls back to `git merge-base main upstream/main`), fetches upstream, lists every non-merge commit since baseline, applies the rules in `scripts/rules.ts`, and writes the table grouped by verdict with rationale.

**Review the Defer bucket carefully.** Two sub-cases deserve attention:

- **take + defer** (a `[codex]` refactor that also touches a fork divergence surface like `infra/relay/src` or `wireIdentity`): plan for manual conflict resolution, not a clean take. The refactor wants to land together, but the fork has policy-level reasons to diverge on that surface.
- **upstream-internal docs only** (commits touching only `.macroscope/`, `.github` templates, `CONTRIBUTING.md`): the fork has its own equivalents (e.g. `docs/operations/effect-fn-checklist.md`). Absorb only if you want upstream's guidance verbatim.

Confirm every Take and Reject verdict. Record new Rejects in the `FORK.md` divergence log **before** merging, so rejected work is not re-debated next sync.

### Step 1 — Predict conflict zones

```bash
node .agents/skills/upstream-sync/scripts/conflict-zones.ts --out conflict-zones.md
```

Intersects upstream-changed paths with fork-changed paths since baseline and the FORK.md high-conflict zone catalog. The zone rollup tells you where to budget resolution time. Use it to scope the merge session and to sanity-check whether a single bulk merge is sane or whether the conflicting surface is so large you should reconsider wave-based absorbs.

At very large scale (hundreds of conflicting files), the zone rollup matters more than the per-file list — you resolve by zone, not file by file.

### Step 2 — Open a sync branch

```bash
git checkout main
git pull origin main
git checkout -b upstream-sync-$(date +%Y-%m-%d)
```

To pin to a specific upstream tip instead of `upstream/main`, note the SHA from Step 0 and `git merge <upstream-sha>` in Step 3.

### Step 3 — Merge and resolve

```bash
git merge upstream/main   # or the pinned SHA
```

Resolve conflicts by zone, applying these fork-policy rules consistently:

- **Restore Kata Code branding** on every product surface: `Kata Code`, `KATACODE_*`, `katacode://` / `katacode-dev://`, `@kata-sh/code-*`, `com.katacode.app`. Never reintroduce `@t3tools/*` or `T3CODE_*` without an explicit `FORK.md` decision.
- **Prefer fork extension modules** over inlining fork logic into shared upstream files. When upstream moved a file the fork also moved, keep the fork location and reapply the divergence there.
- **Do not hand-merge `pnpm-lock.yaml`.** Delete it and run `vp i`; let pnpm regenerate it.
- **Keep fork rebrand test fixtures upstream-shaped** where they must be: product surfaces use Kata identity, fixture repo names may remain `octocat/t3code` (see `docs/operations/ci.md#fork-rebrand-test-fixtures`).
- **`ours` vs `theirs` is a decision, not a default.** Note non-obvious resolutions in the sync PR description so the next maintainer can follow the reasoning.

High-conflict zones to expect (the conflict-zones script rolls these up): `apps/server`, `apps/web`, `apps/desktop`, `packages/contracts`, `packages/shared`, `scripts/dev-runner.ts`, `pnpm-lock.yaml`, root and app `package.json`.

### Step 4 — Sync vendored reference repos (if deps changed)

If upstream bumped Effect, Alchemy, or another dependency with a vendored subtree under `.repos/`:

```bash
vp run sync:repos
# or one repo:
node scripts/sync-reference-repos.ts --repo <id>
```

Keep `.repos/` matched to the installed dependency version in the same sync.

### Step 5 — Verify

These gates are required by `AGENTS.md` before the sync is considered complete. Do not land the merge until `vp check` and `vp run typecheck` pass.

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

If native mobile code changed, also run `vp run lint:mobile`.

### Step 6 — Land and record

```bash
git checkout main
git merge upstream-sync-$(date +%Y-%m-%d)
git push origin main
```

Update the **Last upstream sync** block in `FORK.md`:

```text
Last upstream sync: YYYY-MM-DD
Upstream SHA:       <merged-upstream-tip-or-pin>
Fork SHA after merge: <main-commit>
Conflicts resolved in: <paths or zones>
Verification:       vp check && vp run typecheck && vp run test
```

Record any Reject entries and cherry-picks in the `FORK.md` divergence log. After landing, update the OKF bundle (`docs/log.md` with a dated entry; `docs/specs/log.md` if a spec changed) per the OKF workflow.

## Cherry-pick path (urgent single commit)

For one bugfix between scheduled merges, or when a full merge is blocked but a security/reliability fix is urgent:

```bash
git fetch upstream
git checkout -b cherry-pick-<short-sha>
git cherry-pick <upstream-commit-sha>
# verify, merge to main, push
```

Log the SHA under **Cherry-picks (outside full merges)** in the `FORK.md` divergence log.

## Hard rules

These are non-negotiable fork policy, not preferences:

- Never push to the `upstream` remote.
- Never reintroduce `@t3tools/*`, `T3CODE_*`, or upstream product strings (`t3code://`, `app.t3.codes`) without an explicit `FORK.md` decision.
- Never sever the `upstream` remote or unlink the GitHub fork badge as a "simplify merges" move. Shared git history is what makes selective merges tractable. Fork independence is expressed through product identity, release pipeline, and the divergence log.
- Never commit secrets (`.env`, signing certs, Clerk/relay credentials).

## Developing fork features with future syncs in mind

Fork-only code should live where upstream does not touch, so future syncs do not conflict with it. This is the single highest-leverage thing maintainers can do to keep merges cheap over time.

| Prefer                                  | Avoid                                               |
| --------------------------------------- | --------------------------------------------------- |
| New package under `packages/kata-*`     | `if (katacode)` branches in shared core             |
| Adapter at provider boundary            | Renaming upstream types in place                    |
| Fork specs and ADRs under `docs/specs/` | Rewriting upstream architecture docs in place       |
| Thin hooks into shared modules          | Large edits across `contracts` for fork-only fields |

Before a large fork-only feature, ask: _can this live in a new module upstream does not touch?_ If yes, put it there.

## References

- `scripts/rules.ts` — classification rules (the source of truth the classifier runs against; edit when fork policy changes).
- `scripts/classify-upstream.ts` — inventory + classify script.
- `scripts/conflict-zones.ts` — conflict-zone predictor.
- `docs/guides/upstream-sync.md` — human-facing mirror of this runbook.
- `FORK.md` — baseline SHA, divergence log, Phase 3 runbook, Phase 4 divergence boundaries.
- `docs/adrs/0003-episodic-upstream-sync.md` — sync policy ADR.
- `docs/adrs/0001-connected-fork-upstream-merge.md` — connected-fork strategy ADR.
