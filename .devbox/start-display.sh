#!/usr/bin/env bash
# =============================================================================
# start-display.sh — bring up the headed display stack.
#
# Idempotent: safe to run on every container start. Starts Xvfb, fluxbox,
# x11vnc, and noVNC when needed, then returns. Electron renders to Xvfb; view it
# in a browser at http://localhost:<novnc>/vnc.html.
# =============================================================================
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
SCREEN_W="${SCREEN_WIDTH:-1600}"
SCREEN_H="${SCREEN_HEIGHT:-1000}"
SCREEN_D="${SCREEN_DEPTH:-24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

log() { printf '[display] %s\n' "$*" >&2; }

wait_for_display() {
  for _ in $(seq 1 20); do
    if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

if ! xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
  log "Xvfb ${DISPLAY} (${SCREEN_W}x${SCREEN_H}x${SCREEN_D})"
  rm -f "/tmp/.X${DISPLAY#:}-lock"
  Xvfb "${DISPLAY}" -screen 0 "${SCREEN_W}x${SCREEN_H}x${SCREEN_D}" -ac -nolisten tcp \
    >/tmp/xvfb.log 2>&1 &
  if ! wait_for_display; then
    log "error: Xvfb did not become ready; see /tmp/xvfb.log"
    exit 1
  fi
fi

if ! pgrep -u "$(id -u)" -x fluxbox >/dev/null 2>&1; then
  log "fluxbox"
  (DISPLAY="${DISPLAY}" fluxbox >/tmp/fluxbox.log 2>&1 &)
fi

if ! pgrep -u "$(id -u)" -x x11vnc >/dev/null 2>&1; then
  log "x11vnc :${VNC_PORT}"
  (x11vnc -display "${DISPLAY}" -rfbport "${VNC_PORT}" -shared -forever -nopw \
          >/tmp/x11vnc.log 2>&1 &)
fi

if ! pgrep -u "$(id -u)" -f "websockify.*${NOVNC_PORT}.*${VNC_PORT}" >/dev/null 2>&1; then
  log "noVNC http://localhost:${NOVNC_PORT}/vnc.html"
  (websockify --web=/usr/share/novnc "${NOVNC_PORT}" "localhost:${VNC_PORT}" \
          >/tmp/novnc.log 2>&1 &)
fi

log "display ready"
