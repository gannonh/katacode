# Specs roadmap

Work map for KataCode.

## Active / next

| Item                            | Status      | Document                                                                                                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 2 — remaining infra split | **Planned** | Relay deploy, mobile EAS, marketing — see [disabled workflows README](../../.github/disabled/README.md)                                                 |
| Upstream sync (first merge)     | **Planned** | [FORK.md — Phase 3](../../FORK.md#phase-3--upstream-sync-runbook)                                                                                       |
| Post-merge release validation   | **Next**    | [Release runbook](/operations/release.md) — `dry_run` then nightly `workflow_dispatch` after [PR #2](https://github.com/gannonh/katacode/pull/2) merges |

## Completed

| Item                                | Document                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 2 — desktop/web release split | [Design spec](/specs/2026-06-16-phase-2-desktop-web-release-design.md) · [Release runbook](/operations/release.md) · [PR #2](https://github.com/gannonh/katacode/pull/2) |
| Phase 0 — Git remotes               | [FORK.md — Phase 0](../../FORK.md#phase-0--git-remotes-complete)                                                                                                         |
| Phase 1 — Branding & rename         | [FORK.md — Phase 1](../../FORK.md#phase-1--branding-and-rename-do-this-first) · [ADR 0002](/adrs/0002-katacode-product-identity.md)                                      |
| Phase 1 — PR & CI                   | [PR #1](https://github.com/gannonh/katacode/pull/1) · [fork-setup spec](/specs/fork-setup.md) · [CI runbook](/operations/ci.md)                                          |

## Backlog & historical plans

Upstream-era implementation plans live under [docs/specs/plans/](/specs/plans/). Treat them as archived context unless a spec explicitly revives one.
