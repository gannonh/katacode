# Kata Code devbox

Isolated worktree dev containers for Kata Code. Each box includes Node 24, pnpm,
vite-plus (`vp`), the Electron runtime, Chromium for OAuth flows, a headed
noVNC display, GitHub-token forwarding, and the Pi coding agent.

## Quickstart

```bash
# 1. Initialize devbox in your repo if .devbox/ and .devcontainer/ are absent
npx @gannonh/devbox init

# 2. Boot a box for a branch
npx @gannonh/devbox my-feature

# 3. Open the headed display
npx @gannonh/devbox my-feature --url --open
```

The worktree is mounted at `/workspace` inside the box. The shell runs as the
non-root `node` user.

## Kata Code defaults

- Node: `24.x` from the devcontainers TypeScript/Node Bookworm image.
- Package manager: Corepack activates the `packageManager` from `package.json`
  (`pnpm@11.8.0` at the time this file was written).
- Dependency install: `.devbox/provision.sh` runs `pnpm install --frozen-lockfile`.
- Repo CLIs: `/workspace/node_modules/.bin` is added to shell `PATH`, so `vp`
  works after install.
- Electron setup: `.devbox/post-create.sh` runs
  `vp run --filter @kata-sh/code-desktop ensure:electron`.
- Default app ports: web `5733`, server `13773`, noVNC `6080`, VNC `5900`.

## Prerequisites

- **Docker / OrbStack**. OrbStack is recommended on macOS because it exposes
  container ports at `<container>.orb.local:<port>`. Other Docker runtimes work
  with container IPs.
- **@devcontainers/cli**:
  ```bash
  npm install -g @devcontainers/cli
  ```
- **gh (GitHub CLI)** authenticated on the host:
  ```bash
  gh auth login
  ```
  The launcher forwards `gh auth token` into the box so `gh` and `git push`
  work without re-auth inside the container.
- **~/.pi (optional)**. If you use Pi, the host config is copied into the box
  excluding sessions, npm, and cache directories. Extensions are reinstalled so
  native packages build for Linux.

## Files

| File                              | Purpose                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.devbox/Dockerfile`              | Builds the dev image: Node 24, pnpm baseline, dev CLIs, display stack, Electron/Chromium runtime libs, Chromium, GitHub CLI, and Pi.                   |
| `.devbox/provision.sh`            | Runs once at create: activates the package manager, installs dependencies, links `.env`, copies Pi config, runs the repo hook, and starts the display. |
| `.devbox/post-create.sh`          | Kata Code hook that ensures the Electron runtime after dependencies are installed.                                                                     |
| `.devbox/start-display.sh`        | Starts Xvfb, fluxbox, x11vnc, and noVNC. Runs on every container start.                                                                                |
| `.devcontainer/devcontainer.json` | Devcontainer config used by `@devcontainers/cli`, Codespaces, and Cursor. Defines mounts, env vars, lifecycle hooks, and forwarded ports.              |

## Agent switching

The box ships with **Pi** active by default. To switch to **Claude Code** or
**Codex**:

1. Edit `.devbox/provision.sh`:
   - Comment out the Pi block.
   - Uncomment the Claude Code or Codex block.
2. Edit `.devcontainer/devcontainer.json`:
   - Remove the `~/.pi` mount line.

### Claude Code

- Package: `@anthropic-ai/claude-code`
- Auth: set `ANTHROPIC_API_KEY` in `.env` or `devcontainer.json` `containerEnv`

### Codex

- Package: `@openai/codex`
- Auth: set `OPENAI_API_KEY` in `.env`, or run `codex --login` inside the box
  and complete the browser flow through noVNC.

## Notes

- Electron renders against software Xvfb. Use native local builds for
  pixel-sensitive checks.
- The Kata desktop launcher detects Linux Electron sandbox support and adds
  `--no-sandbox` when the container cannot use Electron's setuid sandbox.
- For a native VNC client, connect to `<container-name>.orb.local:5900` on
  OrbStack or the container IP on other Docker runtimes.
- To pick up newer generic template changes from `@gannonh/devbox`, run
  `npx @gannonh/devbox init --force`, then reapply the Kata Code-specific
  Node, pnpm, port, and Electron setup from these files.
