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

Follow these steps in order.

- **Step 0** sets up a clean integration branch so every artifact this runbook produces (sync-plan.md, conflict-zones.md, the merge commit, lockfile regen, the closure spec) stays off `main`.
- **Steps 1 and 2** are read-only status checks.
- **Steps 3-5** mutate the repo: merge, vendored-repo sync, verify gates.
- **Step 6** is post-merge closure: sync-scoped follow-up work (caused by this merge, lands on this branch, authored against a spec with acceptance criteria). Routed through the `plan-build-verify` skill.
- **Step 7** lands the closure-complete branch on `main` and records the sync.

Do not land on `main` (Step 7) until Step 6 closure is complete. Closure work belongs on the integration branch, same as the merge.

### Step 0 — Prepare a clean integration branch

Start here, before running any inventory script. The classifier and conflict-zones scripts write `sync-plan.md` / `conflict-zones.md` into the working tree; keep those artifacts (and the eventual merge) isolated on an integration branch so `main` stays clean.

```bash
git checkout main
git status --short        # must be empty before continuing
git pull origin main
git fetch upstream --tags
git checkout -b upstream-sync-$(date +%Y-%m-%d)
```

If you are already on a sync branch (e.g. resuming a paused run, or working in a dedicated worktree for this sync), stay there: confirm `git status --short` is clean and `git branch --show-current` is `upstream-sync-*` (or your chosen worktree branch), then continue to Step 1. Do not rebase mid-sync.

If the tree on `main` is dirty, do not work around it. Commit, stash, or revert the unrelated change first. `git status --short` must be empty before the integration branch is created.

**Re-entering a sync in progress:** if `upstream-sync-<date>` already exists from a prior attempt, decide whether to resume it (`git checkout` into it and continue from where you paused) or start fresh (`git branch -D` the old branch after confirming nothing there was worth keeping). Resume by default; a fresh branch loses prior conflict-resolution work.

### Step 1 — Inventory and classify

Produce a draft classification table (Take / Cherry-pick / Reject / Defer, with unclassified commits flagged for Review), then review it. Do not skip the human review: the classifier is a starting point, not a final decision.

```bash
node .agents/skills/upstream-sync/scripts/classify-upstream.ts --out sync-plan.md
```

The script reads the baseline SHA from `FORK.md`'s `Upstream SHA:` line (override with `--base <sha>`; falls back to `git merge-base main upstream/main`), fetches upstream, lists every non-merge commit since baseline, applies the rules in `scripts/rules.ts`, and writes the table grouped by verdict with rationale.

`sync-plan.md` is a scratch artifact: it is gitignored at the repo root and regenerated on each run. The decisions you confirm during review get recorded in `FORK.md` (Rejects), the closure spec (Take+defer plans), or `docs/specs/deferred-work.md` (legitimate deferrals). The artifact itself does not need to persist past the sync.

**Read every verdict, especially anything not a clean Take.** The classifier emits four verdicts; use them with this vocabulary:

- **Take** — absorb cleanly. Land in the bulk merge, no follow-up.
- **Reject** — permanently skip. Record in the `FORK.md` divergence log before merging.
- **Defer** — tied to a named, tracked fork project phase or revisit trigger (see `docs/specs/deferred-work.md`). Cross-sync: survives beyond this sync. Not "maybe later."
- **Review** — the classifier had no rule signal. Not tied to any un-integrated feature; just unclassified. The human assigns it to Take/Reject/Defer.

Two sub-cases in the Defer/Review buckets deserve attention:

- **take + defer** (a `[codex]` refactor that also touches a fork divergence surface like `infra/relay/src` or `wireIdentity`): plan for manual conflict resolution, not a clean take. The refactor wants to land together, but the fork has policy-level reasons to diverge on that surface.
- **upstream-internal docs only** (commits touching only `.macroscope/`, `.github` templates, `CONTRIBUTING.md`): the fork has its own equivalents (e.g. `docs/operations/effect-fn-checklist.md`). Absorb, then handle the OKF integration as Step 6 closure work — do not let it sit un-classified.

Note: `rules.ts` currently emits only `take | cherry-pick | reject | defer`; the "unclassified, pending human verdict" case is emitted as `defer`. Aligning the code's `Classification` type with this vocabulary (adding a distinct `review` bucket) is tracked closure work. Until then, read a `defer` with rationale "No rule matched" as **Review**, not as a project-phase deferral.

Confirm every Take and Reject verdict. Record new Rejects in the `FORK.md` divergence log **before** merging, so rejected work is not re-debated next sync. Commit the divergence-log update on the integration branch before proceeding.

To pin to a specific upstream tip instead of `upstream/main`, note the SHA from `sync-plan.md` and use `git merge <upstream-sha>` in Step 3.

### Step 2 — Predict conflict zones

```bash
node .agents/skills/upstream-sync/scripts/conflict-zones.ts --out conflict-zones.md
```

Intersects upstream-changed paths with fork-changed paths since baseline and the FORK.md high-conflict zone catalog. The zone rollup tells you where to budget resolution time. Use it to scope the merge session and to sanity-check whether a single bulk merge is sane or whether the conflicting surface is so large you should reconsider wave-based absorbs. `conflict-zones.md` is gitignored scratch, like `sync-plan.md`.

At very large scale (hundreds of conflicting files), the zone rollup matters more than the per-file list — you resolve by zone, not file by file.

### Step 3 — Merge and resolve

```bash
git merge upstream/main   # or the pinned SHA from Step 1
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

### Step 6 — Post-merge closure

Almost every non-trivial merge produces a tail of follow-up work **caused by this merge** that must land on **this integration branch** before it merges to `main`. This is distinct from `docs/specs/deferred-work.md` (the cross-sync backlog): closure work is scoped to this sync, has acceptance criteria, and is part of this sync's definition of done.

Common closure work:

- **Branding re-application** the merge reverted (`@t3tools/*`, `T3CODE_*`, `t3code://`, `app.t3.codes` reappearing on product surfaces).
- **Build-injection verification** for new build-time constants or env the merge introduced (e.g. a Clerk publishable key define that must flow from the release workflow's `production` environment).
- **OKF integration** of upstream-internal docs the merge absorbed (e.g. `.macroscope/check-run-agents/*` Effect conventions → `docs/reference/` or `docs/operations/`).
- **Classifier rule updates** when the merge exposed a rule gap (e.g. a `[codex]` wave that touched a divergence surface and was mis-bucketed).
- **Vendored-repo follow-up** if `vp run sync:repos` couldn't fully converge in Step 4.

Route closure through the **`plan-build-verify`** skill: author a spec at `docs/specs/YYYY-MM-DD-upstream-sync-closure.md` with a `## Acceptance criteria` section, build against it, and verify with evidence artifacts (command output, file diffs, gate results). Link the spec from the `docs/specs/index.md` roadmap row for this sync and promote that row to Active.

If `plan-build-verify` is not installed, add it first:

```bash
npx skills add https://github.com/gannonh/skills --skill plan-build-verify -y
```

This is the only external skill this runbook depends on. Do not improvise closure without it — the spec + acceptance-criteria + evidence discipline is what separates closure from deferred work.

Trivial syncs (clean merge, no follow-up surfaced) may skip this step — state that explicitly and proceed to Step 7. But the default for any merge that touched branding, build injection, or absorbed internal docs is to run closure.

Do not merge the branch to `main` (Step 7) until closure is complete and its acceptance criteria pass.

### Step 7 — Land and record

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
Closure spec:       docs/specs/YYYY-MM-DD-upstream-sync-closure.md (or 'n/a — trivial merge')
```

Record any Reject entries and cherry-picks in the `FORK.md` divergence log. After landing, update the OKF bundle (`docs/log.md` with a dated entry; `docs/specs/log.md` if a spec changed; add the closure spec to `docs/specs/index.md`) per the OKF workflow.

## Cherry-pick path (urgent single commit)

For one bugfix between scheduled merges, or when a full merge is blocked but a security/reliability fix is urgent. Follow the same branch discipline as a full sync: start from a clean `main`, create a dedicated branch.

```bash
git checkout main
git status --short        # must be empty
git pull origin main
git fetch upstream
git checkout -b cherry-pick-<short-sha>
git cherry-pick <upstream-commit-sha>
# verify (vp check + vp run typecheck), merge to main, push
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
- `.agents/skills/plan-build-verify/SKILL.md` — drives Step 6 post-merge closure (spec with acceptance criteria → build → verify).
- `docs/specs/deferred-work.md` — the cross-sync deferred-work registry; the source of truth for what a legitimate "Defer" verdict is tied to.
