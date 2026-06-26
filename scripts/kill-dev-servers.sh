#!/usr/bin/env bash
# Kill stale Kata Code dev server processes on web and server port ranges.
#
# Default ports: web 5733, server 13773.
# The dev-runner uses offsets up to 10, so we check 5733–5743 and 13773–13783.
set -euo pipefail

WEB_PORTS=$(seq 5733 5743)
SERVER_PORTS=$(seq 13773 13783)
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
