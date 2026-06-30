#!/usr/bin/env bash
# =============================================================================
# provision.sh — Kata Code repo + agent setup, run once at container create.
# Idempotent. The devcontainer postCreateCommand runs this from /workspace.
#
# AGENT SWITCHING
# -----------------------------------------------------------------------------
# This file ships with the Pi agent active by default. To switch to Claude Code
# or Codex instead:
#
#   1. Comment out the Pi block (section 4a).
#   2. Uncomment the Claude Code block (4b) or Codex block (4c).
#   3. Remove the ~/.pi mount from .devcontainer/devcontainer.json.
# =============================================================================
set -euo pipefail

cd /workspace
export PATH="/workspace/node_modules/.bin:${PATH}"
log() { printf '[provision] %s\n' "$*" >&2; }

package_manager_spec() {
  node -e "try { const p = require('./package.json'); process.stdout.write(p.packageManager || ''); } catch {}"
}

activate_package_manager() {
  if [[ ! -f package.json ]]; then
    return
  fi

  local spec
  spec="$(package_manager_spec)"
  if [[ -z "${spec}" ]]; then
    return
  fi

  log "activating ${spec%%+*}"
  corepack enable
  corepack prepare "${spec%%+*}" --activate
}

install_dependencies() {
  if [[ -f pnpm-lock.yaml ]]; then
    log "pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile
  elif [[ -f package-lock.json ]]; then
    log "npm ci"
    npm ci
  else
    log "no supported lockfile found, skipping dependency install"
  fi
}

# --- 1. Repo dependencies -----------------------------------------------------
activate_package_manager
install_dependencies

# --- 2. .env link -------------------------------------------------------------
if [[ -f "${HOME}/.env" ]] && [[ ! -e /workspace/.env ]]; then
  ln -s "${HOME}/.env" /workspace/.env
  log "linked .env -> ${HOME}/.env"
fi

# --- 3. Agent setup -----------------------------------------------------------
# Only ONE block should be active. See the AGENT SWITCHING comment at the top.

# --- 3a. Pi (active default) --------------------------------------------------
# Copy the host ~/.pi (mounted read-only at /tmp/host-pi) into the box, excluding
# bulky or host-native dirs. Then replay extensions from settings.json so they
# rebuild Linux-native.
HOST_PI=/tmp/host-pi
BOX_PI="${HOME}/.pi"
if [[ -d "${HOST_PI}" ]] && [[ ! -d "${BOX_PI}" ]]; then
  log "copying Pi config from host (excluding sessions/npm/cache)"
  mkdir -p "${BOX_PI}"
  rsync -a \
    --exclude 'agent/sessions/' \
    --exclude 'agent/npm/' \
    --exclude 'agent/cache/' \
    "${HOST_PI}/" "${BOX_PI}/"

  SETTINGS="${BOX_PI}/agent/settings.json"
  if [[ -f "${SETTINGS}" ]] && command -v pi >/dev/null 2>&1; then
    mapfile -t specs < <(jq -r '.packages[]?' "${SETTINGS}" 2>/dev/null || true)
    if [[ "${#specs[@]}" -gt 0 ]]; then
      log "reinstalling ${#specs[@]} Pi extensions"
      for spec in "${specs[@]}"; do
        [[ -z "${spec}" ]] && continue
        log "  pi install ${spec}"
        pi install "${spec}" --approve >/tmp/pi-install.log 2>&1 \
          || log "  warn: failed to install ${spec} (see /tmp/pi-install.log)"
      done
    fi
  fi
else
  log "Pi config already present or host ~/.pi not mounted, skipping"
fi

# --- 3b. Claude Code (commented out, uncomment to use) ------------------------
# log "installing Claude Code"
# npm install -g @anthropic-ai/claude-code

# --- 3c. Codex (commented out, uncomment to use) ------------------------------
# log "installing Codex"
# npm install -g @openai/codex

# --- 4. Repo-specific hook ----------------------------------------------------
if [[ -x .devbox/post-create.sh ]]; then
  log "running .devbox/post-create.sh"
  bash .devbox/post-create.sh
fi

# --- 5. Start the headed display now (first run) ------------------------------
# postStartCommand also starts it on every boot, but kick it here so the box is
# viewable immediately after `devcontainer up` without waiting for a restart.
if [[ -x /usr/local/bin/devbox-start-display ]]; then
  setsid bash -c /usr/local/bin/devbox-start-display </dev/null >/tmp/devbox-display.log 2>&1 || true
  log "display stack starting (noVNC :6080)"
fi

log "provisioning complete"
