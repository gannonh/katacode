/**
 * `SandboxService` — server-side orchestration for sandbox deployment targets.
 * Builds a `SandboxProviderRegistry` with the Docker driver registered,
 * materializes instances from settings, and implements the `sandbox.*` RPC
 * handlers: list, test connection (streaming), start session (provision +
 * Connect-register), dispose.
 *
 * Phase 1: the Docker driver over the raw Engine API. Connect auto-registration
 * (per-deployment link via `environmentKeys` + `reconcileDesiredCloudLink`) is
 * wired as a hook; the loopback endpoint is returned for the deploying desktop
 * regardless. The "second paired client reaches it via Connect" slice (AC-1.11)
 * is exercised via the relay managed-endpoint path and recorded as manual UAT.
 *
 * @module SandboxService
 */
import * as NodeCrypto from "node:crypto";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  type AdvertisedEndpoint,
  type AdvertisedEndpointProvider,
  type ServerSettings,
} from "@kata-sh/code-contracts";
import { createAdvertisedEndpoint } from "@kata-sh/code-shared/advertisedEndpoint";
import {
  type SandboxProviderInstanceConfigMap,
  SandboxProviderInstanceId,
} from "@kata-sh/code-contracts/sandboxProviderInstance";
import {
  type SandboxInstanceSummary,
  type SandboxTestConnectionProgressEvent,
  SandboxRpcError,
} from "@kata-sh/code-contracts/sandboxRpc";
import { SandboxProviderRegistry } from "@kata-sh/code-sandbox/registry";
import { SandboxProviderError, type SandboxHandle } from "@kata-sh/code-sandbox/driver";
import { DockerSandboxProvider, dockerConfigDecoder } from "@kata-sh/code-sandbox-docker";
import { reconcileDesiredCloudLink } from "../cloud/http.ts";

/** A sandbox `AdvertisedEndpointProvider` (manual kind; container-sourced). */
const SANDBOX_ENDPOINT_PROVIDER: AdvertisedEndpointProvider = {
  id: "sandbox-container",
  label: "Container",
  kind: "manual",
  isAddon: false,
};

function buildRegistry(): SandboxProviderRegistry {
  const registry = new SandboxProviderRegistry();
  registry.register(DockerSandboxProvider, dockerConfigDecoder);
  return registry;
}

type Materialized = ReturnType<SandboxProviderRegistry["materializeOne"]>;

function toSummary(inst: Materialized): Effect.Effect<SandboxInstanceSummary, never> {
  if (inst.kind === "unavailable") {
    return Effect.succeed({
      kind: "unavailable",
      instanceId: inst.instanceId,
      reason: inst.reason,
      message: inst.message,
    });
  }
  return Effect.gen(function* () {
    const descriptor = yield* inst.driver.describe();
    return {
      kind: "available",
      instanceId: inst.instanceId,
      driver: descriptor.kind as string,
      reachabilityKind: descriptor.reachabilityKind,
      supportsSnapshot: descriptor.supportsSnapshot,
      supportsRenewTimeout: descriptor.supportsRenewTimeout,
    };
  });
}

/** Turn an effect into an Either-shaped { _tag: "Left"|"Right" } without `Effect.either`. */
function either<A, E>(
  eff: Effect.Effect<A, E>,
): Effect.Effect<{ _tag: "Left"; left: E } | { _tag: "Right"; right: A }, never> {
  return Effect.matchEffect(eff, {
    onFailure: (left) => Effect.succeed<{ _tag: "Left"; left: E }>({ _tag: "Left", left }),
    onSuccess: (right) => Effect.succeed<{ _tag: "Right"; right: A }>({ _tag: "Right", right }),
  });
}

/** Map a driver `SandboxProviderError` to the RPC `SandboxRpcError`. */
function mapDriverError(e: SandboxProviderError): SandboxRpcError {
  const reason =
    e.reason === "invalid-config"
      ? "invalid-config"
      : e.reason === "unreachable"
        ? "unreachable"
        : e.reason === "provision-failed" ||
            e.reason === "dispose-failed" ||
            e.reason === "exec-failed"
          ? "provision-failed"
          : "internal";
  return new SandboxRpcError({ reason, message: e.message });
}

/** Map a registry unavailable reason to an RPC error. */
function registryError(
  reason: "unknown-driver" | "disabled" | "invalid-config",
  message: string,
): SandboxRpcError {
  return new SandboxRpcError({
    reason: reason === "disabled" ? "invalid-config" : reason,
    message,
  });
}

/** Best-effort message from any error value (Connect/relay errors are a union). */
function errorToMessage(e: unknown): string {
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

/** In-memory map of running sessions (instanceId → handle). Phase 1; not durable. */
const runningSessions = new Map<string, SandboxHandle>();

/**
 * The live sandbox service. `startSession` requires the Kata Code Connect
 * service environment (read by `reconcileDesiredCloudLink`) in its context; the
 * other methods are self-contained. The `R` channel is inferred rather than
 * pinned so the Connect deps flow through to the ws handler runtime.
 */
export const SandboxServiceLive = {
  listInstances: (settings: ServerSettings) =>
    Effect.gen(function* () {
      const registry = buildRegistry();
      const materialized = registry.materialize(
        settings.sandboxProviderInstances as SandboxProviderInstanceConfigMap,
      );
      return yield* Effect.forEach(materialized, toSummary, { concurrency: "unbounded" });
    }),

  testConnection: (instanceId: SandboxProviderInstanceId, settings: ServerSettings) =>
    Stream.fromEffect(
      Effect.gen(function* () {
        const registry = buildRegistry();
        const config = (settings.sandboxProviderInstances as SandboxProviderInstanceConfigMap)[
          instanceId as SandboxProviderInstanceId
        ];
        if (config === undefined) {
          return yield* new SandboxRpcError({
            reason: "invalid-config",
            message: "instance not found",
          });
        }
        const inst = registry.materializeOne(instanceId, config);
        if (inst.kind !== "available") {
          return yield* registryError(inst.reason, inst.message);
        }
        const events: SandboxTestConnectionProgressEvent[] = [];
        const v = yield* either(inst.driver.validate(inst.config));
        events.push({
          stage: "validate",
          ok: v._tag === "Right",
          ...(v._tag === "Left" ? { detail: v.left.message } : {}),
        });
        if (v._tag === "Left") return events;
        const image = String((inst.config as { image?: string } | null)?.image ?? "node:22-alpine");
        const p = yield* either(
          inst.driver.provision({
            instanceId: instanceId as string,
            config: inst.config,
            image,
            env: [],
          }),
        );
        events.push({
          stage: "provision",
          ok: p._tag === "Right",
          ...(p._tag === "Left" ? { detail: p.left.message } : {}),
        });
        if (p._tag === "Left") return events;
        const d = yield* either(inst.driver.dispose(p.right));
        events.push({
          stage: "dispose",
          ok: d._tag === "Right",
          ...(d._tag === "Left" ? { detail: d.left.message } : {}),
        });
        events.push({ stage: "done", ok: d._tag === "Right" });
        return events;
      }),
    ).pipe(Stream.flatMap(Stream.fromIterable)),

  startSession: (instanceId: SandboxProviderInstanceId, settings: ServerSettings) =>
    Effect.gen(function* () {
      const registry = buildRegistry();
      const config = (settings.sandboxProviderInstances as SandboxProviderInstanceConfigMap)[
        instanceId as SandboxProviderInstanceId
      ];
      if (config === undefined) {
        return yield* new SandboxRpcError({
          reason: "invalid-config",
          message: "instance not found",
        });
      }
      const inst = registry.materializeOne(instanceId, config);
      if (inst.kind !== "available") {
        return yield* registryError(inst.reason, inst.message);
      }
      // Per-session Kata WebSocket auth token (required for non-loopback clients).
      // @effect-diagnostics-next-line effect(globalDateInEffect):off - random token, not a clock read.
      const bootstrapToken = NodeCrypto.randomBytes(24).toString("hex");
      const image = String((inst.config as { image?: string } | null)?.image ?? "node:22-alpine");
      const handle = yield* inst.driver
        .provision({
          instanceId: instanceId as string,
          config: inst.config,
          image,
          env: [["KATACODE_DESKTOP_BOOTSTRAP_TOKEN", bootstrapToken]],
        })
        .pipe(Effect.mapError(mapDriverError));
      runningSessions.set(instanceId as string, handle);
      const reach = yield* inst.driver
        .reachability(handle, 13773)
        .pipe(Effect.mapError(mapDriverError));
      const endpoint: AdvertisedEndpoint = createAdvertisedEndpoint({
        id: `sandbox-${instanceId as string}`,
        label: config.displayName ?? `Container ${instanceId as string}`,
        provider: SANDBOX_ENDPOINT_PROVIDER,
        httpBaseUrl: reach.httpBaseUrl,
        reachability: "loopback",
        source: "server",
      });
      // Connect auto-registration (AC-1.11): publish the container's loopback
      // origin to the relay via the existing `reconcileDesiredCloudLink` entry
      // point so every paired client (mobile, hosted web, other desktops) reaches
      // this deployment with no per-client setup. Each container has a distinct
      // origin (ephemeral host port) so its relay link is per-deployment. Requires
      // the deploying server to be Connect-authorized (a CLI token); a missing
      // token or relay failure surfaces as `connect-failed` (fail-loud, no silent
      // fallback). `apps/server/src/cloud/` is only called, not modified.
      const reachUrl = new URL(reach.httpBaseUrl);
      yield* reconcileDesiredCloudLink(`http://127.0.0.1:${reachUrl.port}`).pipe(
        Effect.mapError(
          (e) =>
            new SandboxRpcError({
              reason: "connect-failed",
              message: `Connect auto-registration failed: ${errorToMessage(e)}`,
            }),
        ),
      );
      const environmentId = `sandbox-${instanceId as string}`;
      return { instanceId, environmentId, endpoint };
    }),

  disposeSession: (instanceId: SandboxProviderInstanceId) =>
    Effect.gen(function* () {
      const handle = runningSessions.get(instanceId as string);
      if (handle === undefined) return false;
      yield* DockerSandboxProvider.dispose(handle).pipe(Effect.mapError(mapDriverError));
      runningSessions.delete(instanceId as string);
      return true;
      // Connect unlink: the existing cloud/ entry points expose no per-origin
      // unlink, so the relay link lapses when this loopback origin becomes
      // unreachable (container removed). AC-1.12: the deployment disappears from
      // the Connect pool once the container is gone.
    }),
};

export type SandboxService = typeof SandboxServiceLive;
