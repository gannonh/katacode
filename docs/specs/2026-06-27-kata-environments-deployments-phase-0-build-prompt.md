---
type: BuildPrompt
title: "Build prompt — Kata Environments/Deployments Phase 1 — Milestone A"
description: "Self-contained handoff for a fresh agent to build the approved Phase 1 Milestone A (SandboxProvider foundations) without rediscovering context."
status: Approved
tags: [specs, phase-1-milestone-a, build, environments, deployments, sandbox, spi]
timestamp: 2026-06-27T20:55:20Z
---

<!-- Path-slug note: this file's path/tag retain the historical `phase-0` slug for link
     stability. Phase 0 was merged into Phase 1 as Milestone A (see master roadmap). -->

# Build prompt — Kata Environments/Deployments Phase 1 — Milestone A

## Your objective

Build **Phase 1 Milestone A** of the approved Kata Environments/Deployments roadmap: the SandboxProvider
foundations slice. No user-facing surface. No driver shipped. No server wiring. No UI.

When this is done, Phase 1 Milestone B ships the Docker/OrbStack driver (the first demoable
surface); Milestone A only lays the modular substrate it plugs into and freezes the SPI.

## Read first (in order, fully)

1. `docs/specs/2026-06-27-kata-environments-deployments-design.md` — the approved master roadmap.
   Read for framing, key decisions, and Phase 1 Milestone A requirements. Do not re-litigate these.
2. `docs/specs/2026-06-27-kata-environments-deployments-phase-0-design.md` — **the spec you are
   implementing.** It is the source of truth: locked decisions, architecture, the frozen SPI
   shape, the implementation plan, and the acceptance criteria (AC-1.1…AC-1.7). Follow it.
3. `AGENTS.md` (repo root) — task-completion gates, git workflow, fork gotchas, maintainability.

Both specs are `Approved`. Do not change locked decisions. If you believe a decision is wrong,
stop and surface it rather than silently diverging.

## Locked decisions (do not re-litigate)

- **BYOC, free and open source.** Connect to the user's own creds/infra; Kata provisions/bills
  nothing. (Managed Kata Cloud is a future product, out of scope here.)
- **One capability-based `SandboxProvider` SPI** spans local-container + cloud. Required
  primitives: `kind`, `validate`, `provision`, `exec`, `reachability`, `dispose`, `describe`.
  Optional: `createSnapshot`/`deleteSnapshot`/`snapshotExists`, `renewTimeout`,
  `signedPreviewUrl`, `networkPolicy`, `pause`/`resume`. Registry degrades gracefully when an
  optional capability is absent.
- **Container is the first driver; Cloudflare is the second.** Phase 1 Milestone A ships NEITHER driver —
  only the SPI, contracts, registry, settings field, a test-only stub, and a container spike
  script.
- **`SandboxReachabilityKind` maps onto the existing `AdvertisedEndpointReachability`**
  (`loopback | lan | private-network | public`), not a new axis. V1 sandbox kinds use
  `loopback` (container) and `public` (cloud); `lan` is intentionally unused.
- **Secret storage reuses `ServerSecretStore` + the provider-instance redaction pattern.** No
  plaintext in settings. Phase 1 Milestone A only fixes the contract shape (`environment` reuses
  `ProviderInstanceEnvironment`); generalizing the redaction helpers to walk
  `sandboxProviderInstances` is a LATER phase, not Phase 1 Milestone A.
- **Connect auto-registration is a Phase 1+ constraint** (tested by AC-1.4/AC-3.4), not a
  Phase 1 Milestone A invariant. Phase 1 Milestone A has no provision path.
- **`apps/server/src/cloud/` is Kata Code Connect — do not touch it.**

## Verified repo facts (use these; do not rediscover)

- **Package conventions.** `packages/contracts/package.json` is the template: subpath
  `exports` pointing at `src/*.ts` (types + import both → `./src/<x>.ts`), `tsgo --noEmit` for
  typecheck, `vp test run` for tests, `effect: "catalog:"` for effect. `pnpm-workspace.yaml`
  already globs `packages/*`, so new packages resolve with no workspace edit.
- **Pattern to mirror — `packages/contracts/src/providerInstance.ts`:** open branded
  `ProviderDriverKind` slug (`/^[a-zA-Z][a-zA-Z0-9_-]*$/`, 1..64 chars, NOT a closed union),
  `ProviderInstanceId` (brand `"ProviderInstanceId"`), `ProviderInstanceConfig` envelope
  (`{ driver, displayName?, enabled?, environment?, config? }` with `config: Schema.Unknown`),
  `defaultInstanceIdForDriver(kind)`. **Forward/back-compat invariant:** parsing an unknown
  driver kind must always succeed; the runtime marks it unavailable rather than crashing.
  `SandboxProvider*` mirrors this with a **distinct brand string**
  (`"SandboxProviderDriverKind"`, `"SandboxProviderInstanceId"`) so the type systems stay
  separate.
- **Cycle-free layout (LOCKED — see Phase 1 Milestone A spec decision 6).** `packages/contracts/src/settings.ts`
  must reference `SandboxProviderDriverKind`, `SandboxProviderInstanceId`, and
  `SandboxProviderInstanceConfig`. Defining those in `packages/sandbox-contracts` would force
  `contracts` to depend on `sandbox-contracts`, which depends back on `contracts` — a cycle
  (`packages/contracts` is currently a dependency leaf). **Therefore define them in
  `packages/contracts/src/sandboxProviderInstance.ts`** (new module beside `providerInstance.ts`),
  add a `./sandboxProviderInstance` subpath export, and have `packages/sandbox-contracts`
  **re-export** them. The dependency edge is one-directional (`sandbox-contracts` → `contracts`).
  The back-compat helper is `defaultInstanceIdForSandboxDriver(kind)` (renamed so it coexists
  with the provider one).
- **`ProviderInstanceEnvironment`** (`providerInstance.ts`): `{ name, value, sensitive,
valueRedacted? }`. **Import and reuse it** for the sandbox `environment` field — do not
  redefine. Because the sandbox envelope is defined in `packages/contracts`
  (`sandboxProviderInstance.ts`), this is an in-package import with no new dependency.
  `packages/sandbox-contracts` still depends on `@kata-sh/code-contracts` (to re-export the
  settings-referenced contracts and for the sandbox-only schemas it owns).
- **Settings map pattern — `packages/contracts/src/settings.ts`:** `providerInstances` is
  `Schema.Record(ProviderInstanceId, ProviderInstanceConfig).pipe(Schema.withDecodingDefault(
Effect.succeed({})))`, and `ServerSettingsPatch.providerInstances` is a whole-map
  `Schema.optionalKey(Schema.Record(...))` (no per-entry patch). Mirror exactly for
  `sandboxProviderInstances`. Adding a `withDecodingDefault({})` field is backward-compatible:
  existing settings JSON without the key decodes to `{}` (AC-1.4).
- **Secret store — `apps/server/src/auth/ServerSecretStore.ts`:** persists
  `<secretsDir>/<name>.bin`, dir `0o700`, files `0o600`, atomic temp-write+rename. Already
  backs provider-instance sensitive env vars via redaction in
  `apps/server/src/serverSettings.ts` (`materializeProviderEnvironmentSecrets` /
  `persistProviderEnvironmentSecrets`), which are **hardcoded to iterate
  `settings.providerInstances`**. Phase 1 Milestone A does NOT generalize these (out of scope) — it only
  fixes the contract shape so a later phase can.
- **Reachability literals — `packages/contracts/src/remoteAccess.ts`:**
  `AdvertisedEndpointReachability = Schema.Literals(["loopback", "lan", "private-network",
"public"])`. Map `SandboxReachabilityKind` onto these.
- **Prior art (pattern reference only, do not copy/import code):** AgentBox at
  `/Volumes/EVO/repos/agentbox`. `packages/core/src/cloud-backend.ts` (the SPI shape),
  `packages/sandbox-cloud/src/cloud-provider.ts` (scaffolding),
  `packages/sandbox-docker/src/*` (the local-container driver Phase 1 will mirror). It is a
  different product; adapt, don't transplant. Per AGENTS.md, do not import from `.repos/` or
  vendored reference repos.

## What to build (from the spec's Implementation plan)

1. **`packages/contracts/src/sandboxProviderInstance.ts`** (settings-referenced contracts) —
   define `SandboxProviderDriverKind`, `SandboxProviderInstanceId`,
   `SandboxProviderInstanceConfig` (envelope + `config: Schema.Unknown`),
   `SandboxProviderInstanceConfigMap`, `defaultInstanceIdForSandboxDriver`. Reuse in-package
   `ProviderInstanceEnvironment` for `environment`. Add `./sandboxProviderInstance` to
   `packages/contracts/package.json#exports` and re-export from `src/index.ts`.
2. **`packages/sandbox-contracts`** (schema-only) — package.json (subpath exports, `effect`
   catalog, `tsgo`/`vp test`, **dependency on `@kata-sh/code-contracts`**), `tsconfig`, modules:
   `instance.ts` (**re-exports** the settings-referenced contracts from `@kata-sh/code-contracts`),
   `environmentConfig.ts`, `sessionState.ts`, `reachability.ts`, `index.ts`. The sandbox-only
   schemas (`EnvironmentConfig`, `SandboxSessionState`, `SandboxReachabilityKind`) are defined
   here.
3. **`packages/sandbox`** (runtime) — `SandboxProviderDriver.ts` (SPI types +
   `SandboxProviderError` tagged Effect error), `SandboxProviderRegistry.ts`, `descriptor.ts`,
   a test-only `testing/stubDriver.ts` (**NOT in `package.json#exports`** — relative-path-only
   from co-located tests), `index.ts`.
4. **`ServerSettings.sandboxProviderInstances`** — add to `ServerSettings` and
   `ServerSettingsPatch` in `packages/contracts/src/settings.ts` (importing the types from
   `./sandboxProviderInstance.ts`, same package), default `{}`, whole-map patch.
5. **Tests** — contracts round-trip incl. unknown driver; registry materialization
   (available / `unknown-driver` / `disabled` / `invalid-config`); descriptor↔method-presence
   agreement; settings decode with unknown sandbox driver; type-level SPI conformance;
   reachability forward-mapping totality.
6. **Container spike** — `scripts/sandbox-spike/container-reachability.ts` (add to the existing
   `@kata-sh/code-scripts` package): provision a local container, start a listener, publish port
   to `localhost`, open `ws`/`wss`, confirm a long-lived process runs. **Transport is pinned:**
   talk to the Docker Engine API over the Unix socket (`/var/run/docker.sock` / `$DOCKER_HOST`)
   via Node built-ins — **no Docker client npm dependency** (no lockfile/`allowBuilds` churn).
   The `ws`/`wss` client needs no dep either (`@types/node` v24 ships a global `WebSocket`).
   **Required:** suppress the repo's `nodeBuiltinImport` lint rule with
   `// @effect-diagnostics nodeBuiltinImport:off` at the top of the script (every existing
   `scripts/*.ts` importing Node built-ins does this), or `vp check` fails. Must **typecheck
   under `vp run typecheck`**. Run it if Docker is available and fill the spec's **Spike
   findings** section, citing the Engine API endpoints used; if Docker is unavailable, record a
   "blocked: needs local Docker" finding (still satisfies AC-1.7; Phase 1 is then blocked until
   it runs).
7. **Gates** — `vp check`, `vp run typecheck`, `vp run test`.

Steps 1–3 proceed in order (settings step 4 depends on step 1); SPI work (step 3) can run in
parallel with steps 1–2 once contract names are fixed; step 6 is independent of 1–5.

## Acceptance criteria (all must pass before Phase 1 Milestone A is complete)

- **AC-1.1** `packages/sandbox-contracts` + `packages/sandbox` build and pass `vp run
typecheck`; `vp check` clean; resolve via subpath exports.
- **AC-1.2** Unit test: a `sandboxProviderInstances` map with a valid-but-unregistered driver
  kind round-trips (encode∘decode identity), no data loss.
- **AC-1.3** Unit test: registry with stub driver — (a) stub instance available; (b)
  unknown-driver instance unavailable with reason `unknown-driver`, no throw; (c) `disabled`
  → `disabled`; (d) bad `config` → `invalid-config`.
- **AC-1.4** With `sandboxProviderInstances` present (default `{}` + an unknown-driver entry),
  the server boots unchanged; existing settings tests pass; no production driver registered.
- **AC-1.5** Unit test: `describe()` capability flags match method presence (e.g.
  `supportsSnapshot === (createSnapshot && deleteSnapshot && snapshotExists all present)`),
  across a variant with and without the capability.
- **AC-1.6** Type-level conformance test: stub satisfies the `SandboxProvider` interface, so an
  accidental required-signature change breaks the build. (Drift guard; the real freeze is the
  no-amendment process rule.)
- **AC-1.7** `scripts/sandbox-spike/container-reachability.ts` exists (in `@kata-sh/code-scripts`,
  using the raw Docker Engine API over the Unix socket via Node built-ins — no Docker client npm
  dependency) and typechecks under `vp run typecheck`. Spike findings recorded (pass/fail or
  "blocked: needs local Docker") for provision, port publish, sustained `ws`/`wss`, long-lived
  process, with the verified Docker Engine API endpoints cited.

## Guardrails

- **Out of scope:** any `environments.deploy.*`/`sandbox.*` RPCs; server-layer registry wiring;
  the Docker/OrbStack driver (`packages/sandbox-docker`); the Cloudflare driver; the
  `.kata/environment.json` resolver; any UI; touching `apps/server/src/cloud/`; generalizing
  the secret-redaction helpers.
- **Fail loud.** `SandboxProviderError` carries a `reason` + optional `cause`. No silent
  fallbacks. An unknown driver is "unavailable", not a throw, but a real provision/validate
  failure surfaces explicitly.
- **No plaintext secrets in settings.** The `environment` field reuses the
  `sensitive` + `valueRedacted` shape; Phase 1 Milestone A ships no writer for it, so the bar is a contract
  decision, not yet an enforced invariant.
- **Fork branding:** `.kata/` config dir, `KATACODE_*` env, `~/.katacode` state. No upstream
  `t3`/`cursor` product strings in Kata surfaces.
- **Atomic commits** (Conventional Commits, `<type>(<scope>): <summary>`). Stage only related
  files. Commit after each logical unit. Keep `git status` clean.
- **Do not mark the task complete unless AC-1.1…AC-1.6 pass and AC-1.7's script typechecks.**
  If the spike can't run live, record the "blocked" finding and say so explicitly — do not
  claim the spike passed when it didn't.

## When you finish

- Run `vp check`, `vp run typecheck`, `vp run test`; record results.
- Update the Phase 1 Milestone A spec's **Spike findings** section in place with the recorded results.
- Add a concise entry to the relevant `docs/**/log.md` per OKF practice, and update
  `docs/specs/index.md` to list this work as implemented, if the repo's OKF workflow expects it.
- Leave a short build report: what landed, AC results (pass/blocked per AC), and any deferred
  items filed as issues per AGENTS.md.
- Do not advance to Phase 1 Milestone B (the container driver). Milestone B is a separate Plan cycle after Milestone A is verified, and is the first phase slice to carry a user-facing demo + e2e test (AC-1.13).
