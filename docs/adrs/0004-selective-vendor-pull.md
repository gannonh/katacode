---
type: ADR
title: "Selective vendor-pull upstream sync"
description: "Replace episodic bulk merges with per-change selective porting from upstream, each re-implemented as a fork-native commit."
tags: [fork, git, upstream, adr]
timestamp: 2026-06-21T08:30:00Z
---

# ADR 0004: Selective vendor-pull upstream sync

## Status

Accepted — supersedes [ADR 0003](/adrs/0003-episodic-upstream-sync.md).

## Context

[ADR 0003](/adrs/0003-episodic-upstream-sync.md) established episodic merge-based sync: periodically merge a range of `upstream/main` into a dated `upstream-sync-*` branch, resolve conflicts, and land the result.

The first attempt (branch `upstream-sync-2025-06-20`, 80 commits) consumed a full session building classification and conflict-resolution tooling without completing the merge. By the time work could resume, upstream had landed 173 additional commits (253 total, 1408 files changed, 107K insertions / 79K deletions). Of those 253 commits, 205 belong to an ongoing Effect service migration that is still actively landing.

Bulk merge creates a compounding problem: larger gaps produce more conflicts, conflict resolution takes longer sessions, and the gap grows further while the merge is in progress. Merging intermediate states of a moving refactor (like the Effect migration) is wasted work that will be overwritten by later commits in the same effort.

## Decision

1. **Operational independence + connected history.** Unchanged from [ADR 0003](/adrs/0003-episodic-upstream-sync.md) and [ADR 0001](/adrs/0001-connected-fork-upstream-merge.md). Keep the `upstream` remote. Never push to it.

2. **Replace bulk merge with selective porting.** Instead of merging `upstream/main`, scan upstream and port specific changes as fork-original commits. Each port is an independent branch + PR that re-implements the upstream change with fork branding already applied. No merge commit, no conflict-resolution cascades.

3. **Scan cadence replaces merge cadence.** Scan upstream weekly or on-demand. The scan produces an analysis with effort, risk, and recommendations per change or change cluster. Porting decisions are made per-change, not batched into mega-merges.

4. **Coordinated upstream refactors get Watch status.** When upstream runs a large coordinated refactor (e.g. the Effect service migration), don't port intermediate states. Track it as a watched cluster and port the net result once it stabilizes. This avoids merging a moving target.

5. **Divergence log expands.** [FORK.md](../../FORK.md) tracks:
   - Ported upstream commits (upstream SHA → fork SHA)
   - Skipped commits (with rationale)
   - Watched clusters (with stabilization trigger)
   - Last-scanned upstream tip SHA

6. **Extension-first fork development.** Unchanged from [ADR 0003](/adrs/0003-episodic-upstream-sync.md).

7. **No cherry-pick escape hatch needed.** Every port is already a targeted individual change. The cherry-pick concept from ADR 0003 is subsumed by the normal workflow.

## Consequences

- The [upstream-sync skill](/guides/upstream-sync.md) and guide are rewritten for the port-based workflow.
- `classify-upstream.ts` is enhanced to produce richer analysis (effort/risk/recommendations per cluster).
- `take-upstream.sh` is deprecated (no merge conflicts to resolve).
- `conflict-zones.ts` becomes intersection analysis (which fork files does an upstream change touch?).
- `rebrand-fork.ts` remains as an audit gate.
- The FORK.md "Last upstream sync" block becomes "Last upstream scan" + "Ported changes" log.
- ADR 0003 is superseded but remains in the `adrs/` directory for history.

## Related

- [ADR 0001 — Connected fork with merge-based upstream sync](/adrs/0001-connected-fork-upstream-merge.md)
- [ADR 0003 — Episodic upstream sync (superseded)](/adrs/0003-episodic-upstream-sync.md)
- [Upstream sync guide](/guides/upstream-sync.md)
- [FORK.md](../../FORK.md)
