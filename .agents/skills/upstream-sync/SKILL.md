---
name: upstream-sync
description: "Selective upstream sync for the Kata Code fork of T3 Code. Use when the user wants to scan upstream for new changes, analyze upstream commits for effort and risk, port individual upstream changes into the fork, inventory what's new upstream, classify commits as Port/Defer/Skip/Watch, or update the FORK.md baseline. Also covers 'what changed upstream since last sync' and 'should we take this upstream change.' This skill IS the runbook; follow it end-to-end so the process stays repeatable and does not drift across syncs."
---

# Upstream sync

This skill is the canonical runbook for absorbing changes from `pingdotgg/t3code` into `gannonh/kata-code`. The human-facing guide at `docs/guides/upstream-sync.md` mirrors this process. Helper scripts under `scripts/` in this skill automate the inventory and classification steps. Run them from the repo root.

**Policy:** ADR 0004 (selective vendor-pull). **Fork baseline & divergence log:** `FORK.md`. Read both before a first-time sync.

## Core strategy

**Selective vendor-pull.** Upstream changes are ported individually (or in small clusters) as fork-original commits. There is no merge of `upstream/main`. Each port reads the upstream diff, re-implements the change with fork branding already in place, and commits as new fork history.

Why vendor-pull over bulk merge: the first sync attempt showed that bulk merges compound — larger gaps produce more conflicts, more classification work, and more branding-regression closure tasks. Vendor-pull keeps each change small, self-contained, and correctly branded from the start. The upstream remote and `.repos/` vendored copy provide full traceability without requiring merge ancestry.

For coordinated upstream refactors (the `[codex]` Effect migration is the archetype), defer until the refactor stabilizes, then port the net result. Porting intermediate states of a moving target is wasted work.

## Process

Follow these steps in order.

- **Step 0** scans upstream to see what's new.
- **Step 1** analyzes and recommends which changes to port. **Hard human gate** — present the analysis, wait for approval.
- **Step 2** ports each approved change as a fork-original commit.
- **Step 3** records the sync in FORK.md and OKF logs.

### Step 0 — Scan upstream

See what's new since the last scan.

```bash
git fetch upstream --tags
node .agents/skills/upstream-sync/scripts/classify-upstream.ts --since-scan --out sync-plan.md
```

The script reads the `Last upstream scan` SHA from `FORK.md` (override with `--base <sha>`; falls back to `git merge-base main upstream/main`), lists every non-merge upstream commit since that SHA, applies the rules in `scripts/rules.ts`, and writes `sync-plan.md` grouped by area and verdict.

`sync-plan.md` is a gitignored scratch artifact, regenerated on each run. Decisions confirmed during review get recorded in `FORK.md` (Skips, Watches) or carried into Step 2 (Ports). The artifact itself does not persist past the sync.

The baseline SHA represents the last-scanned upstream tip, not the last-merged commit. Advance it in Step 3 after every scan regardless of how many changes are ported.

### Step 1 — Analyze and recommend

Group related commits into clusters (e.g., all `[codex]` commits form one cluster; UI fixes form another). For each cluster, produce a structured assessment:

- **What it does** — functional summary.
- **Fork intersection** — which fork-modified files it touches. Use `conflict-zones.ts`:

```bash
node .agents/skills/upstream-sync/scripts/conflict-zones.ts --commits <sha1>,<sha2> --out conflict-zones.md
```

- **Effort** — Trivial (additive, non-divergent files) / Moderate (touches fork-modified files) / Significant (structural change across packages).
- **Risk** — Low (isolated) / Medium (touches shared types/contracts) / High (touches divergence surfaces: wire identifiers, branding, relay).
- **Recommendation** — Port / Defer / Skip / Watch.

**Verdict vocabulary:**

- **Port** — re-implement on the fork. Small, self-contained, valuable.
- **Skip** — permanently ignore. Record in the FORK.md divergence log with rationale.
- **Defer** — tied to a named fork project phase or revisit trigger (see `docs/specs/deferred-work.md`). Cross-sync: survives beyond this scan.
- **Watch** — a moving target (active upstream refactor, coupled commit chain). Defer until it stabilizes, then port the net result. Record the stabilization trigger.

**Coordinated refactors.** When upstream runs a large coupled refactor, recommend **Watch**. The `[codex]` Effect migration is the archetype: 200+ coupled commits that depend on each other, with new ones landing daily. Port the net result once it stabilizes, not intermediate states.

**This step has a hard human gate.** Present the analysis and pause. The human decides which changes to port. Do not auto-proceed.

### Step 2 — Port (per approved change)

Re-implement the upstream change as a fork-original commit.

```bash
# Create feature branch
git checkout main && git pull origin main
git checkout -b port-upstream/<short-description>

# Read the upstream diff
git show <commit>                         # single commit
git diff <first-parent>..<last-commit>    # cluster
```

Apply the change to the fork codebase with fork branding already in place. This is a re-implementation, not a merge — no conflict resolution, no branding re-application pass.

After applying:

```bash
node .agents/skills/upstream-sync/scripts/rebrand-fork.ts --check   # gate: exit 1 on regressions
vp check
vp run typecheck
```

Commit with conventional commit format. Reference upstream SHAs in the commit body:

```
feat(server): port upstream session timeout fix

Upstream: abc1234, def5678
```

If vendored reference repos (`.repos/`) need updating because the ported change bumps a dep:

```bash
vp run sync:repos --repo <id>
```

Merge to main (direct push or PR depending on scope).

### Step 3 — Record

Update `FORK.md`:

- Advance the `Last upstream scan` date and tip SHA.
- Log ported changes under `Ported upstream changes` with upstream SHA, fork SHA, and date.
- Log new Skip decisions in the divergence log with rationale.
- Log Watch clusters with their stabilization trigger.

Update OKF logs (`docs/log.md`, relevant section logs) per the OKF workflow.

```text
Last upstream scan: YYYY-MM-DD
Upstream tip SHA:   <scanned-upstream-tip>
Ported:             <upstream-sha> → <fork-sha> (<description>)
Skipped:            <upstream-sha> — <rationale>
Watching:           <cluster> — stabilization trigger: <trigger>
```

## Scripts reference

All scripts live under `.agents/skills/upstream-sync/scripts/`. Run from the repo root.

- `classify-upstream.ts` — inventory and classify upstream commits since baseline. Produces `sync-plan.md`. Supports `--since-scan` to read the last-scanned SHA from FORK.md.
- `conflict-zones.ts` — intersection analysis. Shows which fork-modified files an upstream change touches. Used for port-effort estimation.
- `rebrand-fork.ts` — audit gate. Scans for upstream identity regressions (`@t3tools/*`, `T3CODE_*`, etc.). `--check` exits 1 on regressions. Run after every port.
- `rules.ts` — classification rules. Vocabulary: Port / Defer / Skip / Watch. Effort and risk heuristics.
- `take-upstream.sh` — **deprecated.** Was used for merge conflict resolution under the bulk-merge strategy. No longer needed under vendor-pull.

## Hard rules

These are non-negotiable fork policy:

- Never push to the `upstream` remote.
- Never reintroduce `@t3tools/*`, `T3CODE_*`, or upstream product strings (`t3code://`, `app.t3.codes`) without an explicit `FORK.md` decision.
- Never sever the `upstream` remote or unlink the GitHub fork badge. Shared git history and the read-only upstream reference provide traceability. Fork independence is expressed through product identity, release pipeline, and the divergence log.
- Never commit secrets (`.env`, signing certs, Clerk/relay credentials).

## Developing fork features with future syncs in mind

Fork-only code should live where upstream does not touch, so future ports do not conflict with it.

| Prefer                                  | Avoid                                               |
| --------------------------------------- | --------------------------------------------------- |
| New package under `packages/kata-*`     | `if (katacode)` branches in shared core             |
| Adapter at provider boundary            | Renaming upstream types in place                    |
| Fork specs and ADRs under `docs/specs/` | Rewriting upstream architecture docs in place       |
| Thin hooks into shared modules          | Large edits across `contracts` for fork-only fields |

Before a large fork-only feature, ask: _can this live in a new module upstream does not touch?_ If yes, put it there.

## References

- `scripts/rules.ts` — classification rules (edit when fork policy changes).
- `scripts/classify-upstream.ts` — inventory + classify script.
- `scripts/conflict-zones.ts` — fork intersection analysis for port-effort estimation.
- `scripts/rebrand-fork.ts` — applies the FORK.md identity-rename table; `--check` is the post-port gate.
- `scripts/take-upstream.sh` — **deprecated** (bulk-merge era). Retained for reference only.
- `docs/guides/upstream-sync.md` — human-facing mirror of this runbook.
- `FORK.md` — baseline SHA, divergence log, Phase 3 runbook, Phase 4 divergence boundaries.
- `docs/adrs/0004-selective-vendor-pull.md` — sync policy ADR (supersedes ADR 0003).
- `docs/adrs/0001-connected-fork-upstream-merge.md` — connected-fork strategy ADR.
- `docs/specs/2026-06-21-upstream-sync-strategy-analysis.md` — strategy analysis that motivated the vendor-pull shift.
- `docs/specs/deferred-work.md` — cross-sync deferred-work registry; the source of truth for what a legitimate Defer verdict is tied to.
