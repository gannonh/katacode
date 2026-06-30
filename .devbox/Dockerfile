# syntax=docker/dockerfile:1
# =============================================================================
# Kata Code headed dev box (devcontainer)
#
# Provides the repo's Linux development baseline: Node 24, pnpm, vite-plus,
# Electron runtime libraries, Chromium for OAuth flows, noVNC for headed UI work,
# GitHub CLI, and the Pi coding agent.
#
# Repo setup happens at container create in .devbox/provision.sh so dependency
# installs, Electron runtime setup, and agent extension rebuilds stay idempotent.
# =============================================================================
FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# -----------------------------------------------------------------------------
# System packages: dev CLIs + headed display stack + Electron/Chromium runtime.
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      jq \
      rsync \
      ripgrep \
      fd-find \
      fzf \
      tmux \
      xvfb \
      x11vnc \
      novnc \
      websockify \
      fluxbox \
      x11-utils \
      x11-xserver-utils \
      dbus-x11 \
      libgtk-3-0 \
      libnotify4 \
      libnss3 \
      libxss1 \
      libxtst6 \
      libxkbcommon0 \
      libxshmfence1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libatspi2.0-0 \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libdrm2 \
      libgbm1 \
      libasound2 \
      libcups2 \
      xdg-utils \
      fonts-liberation \
      chromium \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf "$(command -v fdfind)" /usr/local/bin/fd

# Make the newer /usr/local/bin/git from the base image the git every caller
# sees. The apt git binary can be too old for relative worktree config.
RUN ln -sf /usr/local/bin/git /usr/bin/git

# -----------------------------------------------------------------------------
# GitHub CLI (official apt repo).
# -----------------------------------------------------------------------------
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# Package manager baseline. The provision script activates the exact package
# manager from package.json; this baked version keeps pnpm available before the
# workspace is mounted.
# -----------------------------------------------------------------------------
RUN corepack enable \
    && corepack prepare pnpm@11.8.0 --activate

# Make repo-local CLIs like vp available in interactive shells after install.
RUN printf '\nexport PATH=/workspace/node_modules/.bin:$PATH\n' >> /etc/bash.bashrc \
    && printf 'export PATH=/workspace/node_modules/.bin:$PATH\n' > /etc/profile.d/workspace-bin.sh

# -----------------------------------------------------------------------------
# Pi coding agent (global). Extensions are reinstalled per-box from the user's
# settings.json at provision time so they build Linux-native.
# -----------------------------------------------------------------------------
RUN npm install -g @earendil-works/pi-coding-agent

# Chromium needs --no-sandbox under Xvfb in a container. Wrap the real binary so
# xdg-open, Electron shell.openExternal, and direct chromium invocations work.
RUN mv /usr/bin/chromium /usr/bin/chromium.real \
    && printf '#!/bin/sh\nexec /usr/bin/chromium.real --no-sandbox --disable-gpu --test-type "$@"\n' \
       > /usr/bin/chromium \
    && chmod +x /usr/bin/chromium

# Display defaults (overridable via devcontainer.json containerEnv).
ENV DISPLAY=:99 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    SCREEN_WIDTH=1600 \
    SCREEN_HEIGHT=1000 \
    SCREEN_DEPTH=24 \
    BROWSER=chromium

COPY .devbox/start-display.sh /usr/local/bin/devbox-start-display
RUN chmod +x /usr/local/bin/devbox-start-display

USER node
