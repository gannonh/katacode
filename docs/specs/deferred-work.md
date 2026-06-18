---
type: Reference
title: "Deferred work registry"
description: "Review queue for work intentionally deferred from specs so future planning can revisit, promote, or close it."
tags: [specs, roadmap, deferred-work, planning]
timestamp: 2026-06-18T00:00:00Z
---

# Deferred work registry

Use this registry for work that a spec intentionally leaves out but future planning should revisit. Keep entries short, source-linked, and actionable.

## Entry format

Each entry should include:

- **Status:** `deferred`, `planned`, `accepted`, or `closed`
- **Area:** product or technical area
- **Source:** spec, ADR, roadmap, runbook, or PR that deferred the work
- **Rationale:** why it was deferred
- **Revisit trigger:** when future planning should review it
- **Notes:** current context or next decision needed

## Review workflow

- When writing a spec, include an `## Explicitly deferred work` section.
- If a deferred item should survive beyond that spec, add or update an entry here.
- During `/okf update`, review entries related to changed areas and either keep them deferred, promote them to planned work, mark them accepted into an active spec, or close them with rationale.
- Do not use this registry for speculative ideas without a source. Use the product backlog or a new spec when direction is not tied to a deferral.

## Deferred / review queue

### Production Relay Deploy

- **Status:** planned
- **Area:** relay, infrastructure, release
- **Source:** [Phase 2 desktop/web release design](/specs/2026-06-16-phase-2-desktop-web-release-design.md), [specs roadmap](/specs/index.md), `.github/disabled/README.md`
- **Rationale:** Deferred from the desktop/web release split until fork-owned relay infrastructure and secrets are ready.
- **Revisit trigger:** Current Relay Deploy planning and before re-enabling `.github/workflows/deploy-relay.yml`.
- **Notes:** Initial direction is manual-only production deploy with dry-run mode, health/metadata checks, Clerk DPoP smoke, and release config from Alchemy state.

### Mobile EAS preview and production release

- **Status:** deferred
- **Area:** mobile, release, infrastructure
- **Source:** [fork setup spec](/specs/fork-setup.md), `.github/disabled/README.md`
- **Rationale:** Requires fork Expo project ownership and production-ready EAS credentials.
- **Revisit trigger:** Review after Relay Deploy is implemented or before any mobile release planning.
- **Notes:** Known required values include `KATACODE_EAS_PROJECT_ID` and `EXPO_OWNER`.

### Marketing release and Connect pages

- **Status:** deferred
- **Area:** marketing, release, product
- **Source:** [Phase 2 desktop/web release design](/specs/2026-06-16-phase-2-desktop-web-release-design.md), [specs roadmap](/specs/index.md)
- **Rationale:** Excluded from the desktop/web release split and Relay Deploy planning so infrastructure work can remain independently verifiable.
- **Revisit trigger:** Review before public Connect launch, release download page work, or marketing site deployment work.
- **Notes:** Keep release/download surfaces aligned with hosted web and desktop artifact channels.
