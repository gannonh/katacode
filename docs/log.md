# OKF bundle log

## 2026-06-20 (upstream-sync skill: post-merge closure phase + vocabulary fix)

- Added **Step 6 — Post-merge closure** to the [upstream-sync skill](../../.agents/skills/upstream-sync/SKILL.md) and [guide](/guides/upstream-sync.md): a sync-scoped follow-up phase (branding re-application, build-injection verification, OKF integration of absorbed internal docs, classifier rule updates, vendored-repo follow-up) that lands on the integration branch before it merges to `main`. Routed through the `plan-build-verify` skill, producing a `docs/specs/YYYY-MM-DD-upstream-sync-closure.md` spec with acceptance criteria. Old Step 6 (land) renumbered to Step 7, gated on closure completion.
- Added `plan-build-verify` install fallback (`npx skills add https://github.com/gannonh/skills --skill plan-build-verify -y`) for environments missing the skill.
- Fixed the classification vocabulary in the runbook: split the single `defer` into `Take` / `Reject` / `Defer` (project-phase-tied, cross-sync, see [deferred-work registry](/specs/deferred-work.md)) / `Review` (unclassified, pending human verdict). Documented that `rules.ts` still emits only `take|cherry-pick|reject|defer`; aligning the code's `Classification` type with this vocabulary is tracked closure work for the 2026-06-20 sync.
- Gitignored `sync-plan.md` / `conflict-zones.md` (script scratch artifacts) at the repo root so they no longer pollute `git status` or trip `vp check`.

## 2026-06-20 (upstream-sync scripts moved into the skill)

- Moved the three upstream-sync helper scripts from `scripts/upstream-sync/` into the skill bundle at `.agents/skills/upstream-sync/scripts/` (`rules.ts`, `classify-upstream.ts`, `conflict-zones.ts`) so the skill is self-contained and portable, matching how other tracked skills (babysit-pr, fix-github-ci, okf) bundle their scripts.
- Updated [upstream-sync guide](/guides/upstream-sync.md) and [`.agents/skills/upstream-sync/SKILL.md`](../../.agents/skills/upstream-sync/SKILL.md) command examples and references to point at the new in-skill paths.
- Scripts no longer typecheck under `vp run typecheck` (they left the `@kata-sh/code-scripts` workspace); they remain linted by `vp check`. Run via `node .agents/skills/upstream-sync/scripts/<name>.ts` from the repo root.

## 2026-06-20 (upstream-sync runbook + skill + classifier scripts)

- Rewrote [upstream-sync guide](/guides/upstream-sync.md) as the canonical selective-sync runbook: bulk-merge default, integrated inventory+classify and conflict-zone scripts, fork-policy resolution rules, verify gates, land+record steps.
- Added `.agents/skills/upstream-sync/SKILL.md` — the agent-facing runbook that IS the sync process (mirrors the guide, points at the scripts and ADRs). Helper scripts are bundled inside the skill at `.agents/skills/upstream-sync/scripts/`:
  - `rules.ts` — Take/Cherry-pick/Reject/Defer classification rules (source of truth the classifier runs against).
  - `classify-upstream.ts` — inventories upstream commits since baseline and emits a draft classification table.
  - `conflict-zones.ts` — intersects upstream-changed and fork-changed paths with the FORK.md high-conflict zone catalog; zone-level rollup.
- Validated against the real 80-commit upstream diff since baseline `708d5383`: 63 take / 2 reject / 15 defer; conflict-zones predicts 649 intersecting paths (450 in high-blast zones, heaviest in apps/server and apps/web).
- Did **not** perform the merge in this change; scripts are read-only runbook tooling. Baseline in [FORK.md](../../FORK.md) unchanged.

## 2026-06-19 (stable v0.0.29 released + full UAT pass)

- Stable `v0.0.29` released ([run 27854360066](https://github.com/gannonh/kata-code/actions/runs/27854360066)); `@kata-sh/code-cli@0.0.29` published to npm.
- Full UAT passed on stable (`app.kata.sh`): chat completion, Files panel, Connect sign-in, relay link/tunnel, network access toggle, manual environment add via `npx @kata-sh/code-cli serve`.
- Deferred: Connect stale relay link on account switch; Connect open signups (waitlist off). See [deferred work registry](/specs/deferred-work.md).

## 2026-06-19 (Relay Deploy completed + Nightly UAT)

- Marked [Relay Deploy design](/specs/2026-06-18-relay-deploy-design.md) **Completed**: production relay deployed ([run 27798366259](https://github.com/gannonh/kata-code/actions/runs/27798366259)), Nightly runtime regressions fixed, Connect UAT passed.
- Moved Phase 2 infra split to **Completed** on [specs roadmap](/specs/index.md); updated Active to upstream sync planning.
- Closed "Production Relay Deploy" deferred item; added "Connect: stale relay link on account switch" deferred item to [deferred work registry](/specs/deferred-work.md).
- Documented relay deploy and Connect polish commits: `11c8a75c6` (fff native asar fix), `628d982de` (rejected cloud session recovery), `1cfb69697` (x64 cross-arch native bindings).

## 2026-06-18 (Relay Deploy infra setup)

- Documented one-time Alchemy Cloudflare bootstrap, credential smoke validation, and `CLOUDFLARE_ACCOUNT_ID` verification in [Relay deploy setup](/operations/relay-deploy-setup.md) and [Relay credentials playbook](/guides/relay-credentials-playbook.md).
- Updated [Relay Deploy design](/specs/2026-06-18-relay-deploy-design.md) build handoff with credential smoke + local dry-run progress; [specs roadmap](/specs/index.md) links [PR #4](https://github.com/gannonh/kata-code/pull/4).

## 2026-06-18 (Relay Deploy design)

- Added [Relay Deploy design](/specs/2026-06-18-relay-deploy-design.md) and updated [specs roadmap](/specs/index.md) plus [deferred work registry](/specs/deferred-work.md).

## 2026-06-18 (deferred work registry)

- Added [deferred work registry](/specs/deferred-work.md) and roadmap links so spec out-of-scope items have a durable review queue.
- Updated [AGENTS.md](../../AGENTS.md) with deferred-work maintenance guidance.

## 2026-06-17 (episodic upstream sync)

- Added [ADR 0003 — Episodic upstream sync](/adrs/0003-episodic-upstream-sync.md) and [upstream sync guide](/guides/upstream-sync.md).
- Updated [FORK.md — Phase 3](../../FORK.md#phase-3--upstream-sync-runbook), [fork-setup spec](/specs/fork-setup.md), and [specs roadmap](/specs/index.md).

## 2026-06-17 (Kata brand icons + desktop packaging)

- Shipped Kata kanji icons across web, server, mobile, and desktop releases; removed upstream blueprint/T3 artwork from dev and nightly channels ([FORK.md — brand marks](../../FORK.md#brand-logo-marks), `scripts/lib/brand-assets.ts`).
- Desktop releases use `apps/desktop/resources/` assets, macOS Liquid Glass `Assets.car`, and `scripts/electron-after-pack.cjs` (`afterPack` path must be relative to `apps/desktop`).
- [Release runbook](/operations/release.md): nightly rerun after `afterPack` path fix (`19f05374d`).

## 2026-06-17 (Phase 2 pre-merge)

- Finalized OKF and [AGENTS.md](../../AGENTS.md) for [PR #2](https://github.com/gannonh/kata-code/pull/2): active [release workflow](../../.github/workflows/release.yml), `app.kata.sh` hosted web, branch-protection guidance in [CI runbook](/operations/ci.md).
- Documented `apps/web/vercel.ts` compile-time branding constants (must stay in sync with [branding.ts](../../packages/shared/src/branding.ts)).
- Post-merge operator steps: merge PR #2, configure branch protection, run `release.yml` `dry_run`, then nightly test release.

## 2026-06-17

- Added [diagrams](/diagrams/index.md) section with interactive [hosted web & remote stack](/diagrams/hosted-remote-stack.html) map (`app.kata.sh`, `katacode serve`, Connect vs manual pairing).
- Updated bundle [index](/index.md) and [architecture index](/architecture/index.md) cross-links.
- Rewrote [provider architecture](/architecture/providers.md) for multi-driver server design (no longer Codex-only).
- Updated [architecture overview](/architecture/overview.md) for provider-agnostic stack diagram and turn flow.

## 2026-06-16 (Phase 1 CI)

- Documented Phase 1 PR [#1](https://github.com/gannonh/kata-code/pull/1) CI green and review hardening in [fork-setup spec](/specs/fork-setup.md).
- Expanded [CI runbook](/operations/ci.md) with active vs disabled workflows and fork rebrand test-fixture guidance.
- Updated [specs roadmap](/specs/index.md): Phase 1 PR & CI complete; Phase 2 next.
- Refreshed [ADR 0002](/adrs/0002-katacode-product-identity.md) consequences (migration warning, hosted pairing, disabled release workflows).

## 2026-06-16

- Initialized OKF v0.1 bundle at `./docs`.
- Created required sections: `specs/`, `adrs/`, root `index.md` and `log.md`.
- Moved `.plans/` → `docs/specs/plans/` and `docs/project/todo.md` → `docs/specs/product-backlog.md`.
- Added section indexes for `architecture/`, `guides/`, `runbooks/`, `reference/`, `cloud/`, `providers/`, `integrations/`.
- Seeded ADRs for connected-fork strategy and Kata Code product identity.
- Added OKF frontmatter to existing concept documents.
- Updated [AGENTS.md](../../AGENTS.md) with OKF consumption and maintenance instructions.
