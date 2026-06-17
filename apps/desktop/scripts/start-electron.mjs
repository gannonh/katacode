import { spawn } from "node:child_process";

import { desktopDir, resolveElectronLaunchCommand } from "./electron-launcher.mjs";

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;
// Packaged/local production start must not inherit dev-only VITE_DEV_SERVER_URL from the shell.
delete childEnv.VITE_DEV_SERVER_URL;

const electronCommand = resolveElectronLaunchCommand(["dist-electron/main.cjs"]);
const child = spawn(electronCommand.electronPath, electronCommand.args, {
  stdio: "inherit",
  cwd: desktopDir,
  env: childEnv,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
