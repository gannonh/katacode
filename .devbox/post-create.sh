#!/usr/bin/env bash
# =============================================================================
# post-create.sh — Kata Code post-provision hook
#
# Runs after .devbox/provision.sh installs dependencies, links .env, and sets up
# the selected coding agent. Keep repo-specific setup here.
# =============================================================================
set -euo pipefail

log() { printf '[post-create] %s\n' "$*" >&2; }

cd /workspace
export PATH="/workspace/node_modules/.bin:${PATH}"

log "ensuring Electron runtime"
vp run --filter @kata-sh/code-desktop ensure:electron

log "post-create complete"
