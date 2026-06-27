#!/usr/bin/env bash
# Kill stale Kata Code dev server processes and clear cached Electron dev app.
#
# Default ports: web 5733, server 13773.
# The dev-runner can use wider offsets, so we check 5733–5760 and 13773–13800.
# Also removes the cached Electron dev app (.electron-runtime) which can keep
# a stale VITE_DEV_SERVER_URL pointing at a killed port.
set -euo pipefail

WEB_PORTS=$(seq 5733 5760)
SERVER_PORTS=$(seq 13773 13800)
killed=0

for port in $WEB_PORTS $SERVER_PORTS; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    for pid in $pids; do
      if kill -9 "$pid" 2>/dev/null; then
        echo "killed PID $pid on port $port"
        killed=$((killed + 1))
      fi
    done
  fi
done

if [[ "$killed" -eq 0 ]]; then
  echo "no dev server processes found"
else
  echo "killed $killed process(es)"
fi

# Clear cached Electron dev app so the next dev:desktop rebuilds with the
# correct VITE_DEV_SERVER_URL instead of a stale port.
electron_cache="apps/desktop/.electron-runtime"
if [[ -d "$electron_cache" ]]; then
  rm -rf "$electron_cache"
  echo "cleared Electron dev runtime cache"
fi

# Clear Electron dev session/cache so the renderer does not restore a stale
# URL from a previous port. The app regenerates these on next launch.
# The user-data path below is macOS-only; skip on other platforms where
# Electron stores user data elsewhere (~/.config on Linux, %APPDATA% on
# Windows) instead of silently no-op'ing.
electron_user_data="${HOME}/Library/Application Support/katacode-dev"
if [[ "$(uname)" == "Darwin" ]]; then
  for subdir in "Session Storage" "Code Cache" "Cache" "GPUCache" "Service Worker"; do
    if [[ -d "${electron_user_data}/${subdir}" ]]; then
      rm -rf "${electron_user_data}/${subdir}"
      echo "cleared Electron dev ${subdir}"
    fi
  done
fi
