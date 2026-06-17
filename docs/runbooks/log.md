# Runbooks log

## 2026-06-17 (desktop packaging + brand icons)

- [Release runbook](/operations/release.md): `afterPack` path must be relative to `apps/desktop`; Liquid Glass `Assets.car` copy; brand raster regeneration from `source.png`.

## 2026-06-17 (release runbook gh watch fix)

- [Release runbook](/operations/release.md): `gh run watch` requires a run ID — `--workflow` is not a valid flag. Use the run URL from `gh workflow run` or resolve the latest run via `gh run list -w release.yml`.

## 2026-06-17 (release docs split)

- Split [release runbook](/operations/release.md) (steps + verification) from [release setup](/operations/release-setup.md) (secrets/infrastructure).

## 2026-06-17 (release runbook)

- [Release runbook](/operations/release.md): parallel stable/nightly sections, version-selection guide, per-channel verification.

## 2026-06-17 (Phase 2 pre-merge)

- [CI runbook](/operations/ci.md): branch protection allowlist for `main` (five CI jobs; Release workflow excluded from PR gates).
- [Release runbook](/operations/release.md): dry-run default version and prerelease npm `next` dist-tag documented.

## 2026-06-16 (CI)

- Expanded [CI quality gates](/operations/ci.md): active workflow table, disabled-workflow policy, fork rebrand test-fixture table.

## 2026-06-16

- Added runbooks index; operations docs remain under `docs/operations/` (linked from here).
