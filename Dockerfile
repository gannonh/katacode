# syntax=docker/dockerfile:1
#
# Kata Code server container image.
#
# Packages the production @kata-sh/code-cli bundle (apps/server/dist/bin.mjs +
# externalized runtime deps, including the node-pty native addon compiled for
# linux/musl) over node:24-alpine. ENTRYPOINT is `node /app/dist/bin.mjs`, so
# the default provision command is `katacode serve --port 13773` (bin.mjs is the
# `katacode` CLI). See
# docs/specs/2026-06-27-kata-environments-deployments-phase-1-design.md (Phase 1
# scope amendment: the katacode container image is prerequisite infrastructure
# for AC-1.10).
#
# Build: `pnpm run build:docker-image` (tags `katacode:local`). Phase 2+ will
# publish versioned tags to GHCR.

ARG NODE_IMAGE=node:24-alpine

# ---------------------------------------------------------------------------
# Builder: install full workspace, build the server bundle + web client, then
# prune to prod deps so the runtime stage copies a lean node_modules.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder

# node-gyp / node-pty native build needs python3 + make + g++ on alpine.
RUN apk add --no-cache python3 make g++ git

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /repo

# Copy every workspace manifest first so the install layer caches across source
# changes. pnpm install --frozen-lockfile requires every workspace package.json
# referenced by the lockfile to be present.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY patches/ patches/
COPY apps/desktop/package.json apps/desktop/
COPY apps/marketing/package.json apps/marketing/
COPY apps/mobile/package.json apps/mobile/
COPY apps/mobile/modules/t3-review-diff/package.json apps/mobile/modules/t3-review-diff/
COPY apps/mobile/modules/t3-terminal/package.json apps/mobile/modules/t3-terminal/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY infra/relay/package.json infra/relay/
COPY mobile-e2e/package.json mobile-e2e/
COPY oxlint-plugin-kata-code/package.json oxlint-plugin-kata-code/
COPY packages/client-runtime/package.json packages/client-runtime/
COPY packages/contracts/package.json packages/contracts/
COPY packages/effect-acp/package.json packages/effect-acp/
COPY packages/effect-codex-app-server/package.json packages/effect-codex-app-server/
COPY packages/sandbox/package.json packages/sandbox/
COPY packages/sandbox-contracts/package.json packages/sandbox-contracts/
COPY packages/sandbox-docker/package.json packages/sandbox-docker/
COPY packages/shared/package.json packages/shared/
COPY packages/ssh/package.json packages/ssh/
COPY packages/tailscale/package.json packages/tailscale/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile

# Copy the rest of the source and build the server bundle + bundled web client.
# build:desktop builds @kata-sh/code-cli (which bundles @kata-sh/code-web).
COPY . .

RUN pnpm run build:desktop

# Prune to prod dependencies for @kata-sh/code-cli and its workspace deps.
# CI=true lets pnpm remove the dev modules directory non-interactively.
# --ignore-scripts skips the root `prepare` hook (husky/effect-tsgo, dev-only)
# and avoid re-running native builds; node-pty was compiled in the full install.
RUN CI=true pnpm install --frozen-lockfile --prod --ignore-scripts --filter @kata-sh/code-cli...

# ---------------------------------------------------------------------------
# Runtime: lean node:24-alpine with the server bundle + prod node_modules.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# node-pty's native addon is compiled in the builder; the runtime only needs
# the loader libs the addon links against.
RUN apk add --no-cache libstdc++

WORKDIR /app

# The bundle was built at apps/server/dist and externalizes effect + @effect/*
# + node-pty + provider SDKs, which Node resolves from the nearest
# node_modules upward. pnpm installs those under apps/server/node_modules, so
# preserve the apps/server layout: dist + node_modules + package.json there,
# and the repo-root node_modules + workspace packages the symlinks point at.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /repo/apps/server/package.json ./apps/server/package.json
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
COPY --from=builder /repo/packages ./packages

# Containerized Kata server defaults: desktop mode, no browser, loopback port.
ENV KATACODE_MODE=desktop \
    KATACODE_NO_BROWSER=true \
    KATACODE_HOST=0.0.0.0 \
    KATACODE_PORT=13773

# Expose the server CLI as `katacode` on PATH so provision commands like
# `katacode serve --port 13773` (run via `sh -c` by the sandbox driver) resolve.
RUN printf '#!/bin/sh\nexec node /app/apps/server/dist/bin.mjs "$@"\n' > /usr/local/bin/katacode \
    && chmod +x /usr/local/bin/katacode

EXPOSE 13773

ENTRYPOINT ["node", "/app/apps/server/dist/bin.mjs"]
