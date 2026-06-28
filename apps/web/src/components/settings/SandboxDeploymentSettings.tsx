"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SandboxProviderDriverKind,
  SandboxProviderInstanceId,
  type SandboxInstanceSummary,
  type SandboxProviderInstanceConfig,
  type SandboxProviderInstanceConfigMap,
  type SandboxTestConnectionProgressEvent,
} from "@kata-sh/code-contracts";

import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { getPrimaryEnvironmentConnection } from "../../environments/runtime";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { toastManager } from "../ui/toast";

const DOCKER_KIND = SandboxProviderDriverKind.make("docker");

/** Slugify a label into a sandbox instance id suffix (mirrors provider dialog). */
function slugifyLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function rpcClient() {
  return getPrimaryEnvironmentConnection().client;
}

/**
 * Settings panel for sandbox deployment targets (Phase 1: local Docker
 * containers). Lists configured targets with their materialized status, and
 * provides Add / Test connection (streaming) / Start session / Dispose /
 * Remove. Writes go through `useUpdateSettings` against the
 * `sandboxProviderInstances` settings map (no plaintext secrets in settings);
 * the live RPCs (list/test/start/dispose) go through the paired WS client.
 */
export function SandboxDeploymentSettings() {
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const instanceMap = (settings.sandboxProviderInstances ?? {}) as SandboxProviderInstanceConfigMap;

  const [summaries, setSummaries] = useState<ReadonlyArray<SandboxInstanceSummary>>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [testProgress, setTestProgress] = useState<Record<string, string[]>>({});
  const [activeSession, setActiveSession] = useState<
    Record<string, { environmentId: string; httpBaseUrl: string }>
  >({});
  const [busy, setBusy] = useState<Record<string, "test" | "start" | "dispose">>({});

  const refreshList = useCallback(async () => {
    try {
      const result = await rpcClient().sandbox.listInstances();
      setSummaries(result.instances);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to list sandbox targets",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList, settings.sandboxProviderInstances]);

  const summaryById = useMemo(() => {
    const map: Record<string, SandboxInstanceSummary> = {};
    for (const summary of summaries) {
      map[summary.instanceId as string] = summary;
    }
    return map;
  }, [summaries]);

  const handleTest = useCallback(async (instanceId: string) => {
    setBusy((prev) => ({ ...prev, [instanceId]: "test" }));
    setTestProgress((prev) => ({ ...prev, [instanceId]: [] }));
    try {
      await rpcClient().sandbox.testConnection(
        instanceId as never,
        (event: SandboxTestConnectionProgressEvent) => {
          setTestProgress((prev) => ({
            ...prev,
            [instanceId]: [
              ...(prev[instanceId] ?? []),
              `${event.stage}: ${event.ok ? "ok" : "failed"}${
                "detail" in event && event.detail ? ` — ${event.detail}` : ""
              }`,
            ],
          }));
        },
      );
      toastManager.add({
        type: "success",
        title: "Test connection complete",
        description: `Sandbox '${instanceId}' validated.`,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Test connection failed",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    }
  }, []);

  const handleStart = useCallback(async (instanceId: string) => {
    setBusy((prev) => ({ ...prev, [instanceId]: "start" }));
    try {
      const result = await rpcClient().sandbox.startSession({
        instanceId: instanceId as never,
      });
      setActiveSession((prev) => ({
        ...prev,
        [instanceId]: {
          environmentId: result.environmentId,
          httpBaseUrl: result.endpoint.httpBaseUrl,
        },
      }));
      toastManager.add({
        type: "success",
        title: "Sandbox session started",
        description: `Reachable at ${result.endpoint.httpBaseUrl}.`,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Start session failed",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    }
  }, []);

  const handleDispose = useCallback(async (instanceId: string) => {
    setBusy((prev) => ({ ...prev, [instanceId]: "dispose" }));
    try {
      await rpcClient().sandbox.disposeSession({ instanceId: instanceId as never });
      setActiveSession((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
      toastManager.add({
        type: "success",
        title: "Sandbox disposed",
        description: `Sandbox '${instanceId}' released.`,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Dispose failed",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    }
  }, []);

  const handleRemove = useCallback(
    (instanceId: string) => {
      const nextMap = { ...instanceMap };
      delete nextMap[instanceId as keyof typeof nextMap];
      updateSettings({ sandboxProviderInstances: nextMap });
      toastManager.add({
        type: "success",
        title: "Deployment target removed",
        description: `'${instanceId}' removed from Environments.`,
      });
    },
    [instanceMap, updateSettings],
  );

  const instanceEntries = Object.entries(instanceMap);

  return (
    <section className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Deployment targets</h3>
          <p className="text-xs text-muted-foreground">
            Provision an isolated container running a Kata server, reached over localhost.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          Add deployment target
        </Button>
      </div>

      {instanceEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No deployment targets configured. Add one to provision a container.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {instanceEntries.map(([id, config]) => {
            const summary = summaryById[id];
            const available = summary?.kind === "available";
            const reason = summary?.kind === "unavailable" ? summary.reason : undefined;
            const session = activeSession[id];
            const progress = testProgress[id] ?? [];
            const instanceBusy = busy[id];
            return (
              <li key={id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{config.displayName ?? id}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{config.driver}</Badge>
                      {available ? (
                        <Badge variant="default">available</Badge>
                      ) : reason ? (
                        <Badge variant="destructive">{reason}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={instanceBusy !== undefined || !available}
                      onClick={() => void handleTest(id)}
                    >
                      {instanceBusy === "test" ? "Testing…" : "Test connection"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={instanceBusy !== undefined || !available}
                      onClick={() => void handleStart(id)}
                    >
                      {instanceBusy === "start" ? "Starting…" : "Start session"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={instanceBusy !== undefined || session === undefined}
                      onClick={() => void handleDispose(id)}
                    >
                      {instanceBusy === "dispose" ? "Disposing…" : "Dispose"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={instanceBusy !== undefined}
                      onClick={() => handleRemove(id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {progress.length > 0 || instanceBusy === "test" ? (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {progress.join("\n")}
                  </pre>
                ) : null}
                {session ? (
                  <p className="text-xs text-muted-foreground">
                    Session ready: {session.httpBaseUrl} (env {session.environmentId})
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AddDeploymentTargetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingIds={new Set(instanceEntries.map(([id]) => id))}
        onAdd={(id, instance) => {
          updateSettings({
            sandboxProviderInstances: { ...instanceMap, [id]: instance },
          });
          setAddOpen(false);
        }}
      />
    </section>
  );
}

interface AddDeploymentTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIds: Set<string>;
  onAdd: (id: string, instance: SandboxProviderInstanceConfig) => void;
}

function AddDeploymentTargetDialog({
  open,
  onOpenChange,
  existingIds,
  onAdd,
}: AddDeploymentTargetDialogProps) {
  const [label, setLabel] = useState("");
  const [image, setImage] = useState("node:22-alpine");
  const [command, setCommand] = useState("katacode serve --port 13773");
  const [port, setPort] = useState("13773");
  const [error, setError] = useState<string | null>(null);

  const instanceId = useMemo(() => {
    const suffix = slugifyLabel(label) || "default";
    return `${DOCKER_KIND}_${suffix}`;
  }, [label]);

  const handleSubmit = useCallback(() => {
    if (existingIds.has(instanceId)) {
      setError(`Instance id '${instanceId}' already exists. Choose a different label.`);
      return;
    }
    const portNumber = Number(port);
    if (!Number.isFinite(portNumber) || portNumber <= 0) {
      setError("Container port must be a positive number.");
      return;
    }
    try {
      const brandedId = SandboxProviderInstanceId.make(instanceId);
      const instance: SandboxProviderInstanceConfig = {
        driver: DOCKER_KIND,
        enabled: true,
        ...(label.trim().length > 0 ? { displayName: label.trim() } : {}),
        config: { image, command, port: portNumber },
      };
      onAdd(brandedId as string, instance);
      setLabel("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid instance id.");
    }
  }, [existingIds, instanceId, label, image, command, port, onAdd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add container deployment target</DialogTitle>
          <DialogDescription>
            Provisions an isolated Docker container running a Kata server, reached over localhost.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sandbox-label">Label</Label>
            <Input
              id="sandbox-label"
              value={label}
              placeholder="e.g. Work"
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Instance id: {instanceId}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sandbox-image">Image</Label>
            <Input id="sandbox-image" value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sandbox-command">Start command</Label>
            <Input
              id="sandbox-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sandbox-port">Container port</Label>
            <Input id="sandbox-port" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add target</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
