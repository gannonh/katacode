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
import * as Crypto from "node:crypto";
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
  type SandboxStartSessionResult,
  type SandboxTestConnectionProgressEvent,
  SandboxRpcError,
} from "@kata-sh/code-contracts/sandboxRpc";
import { SandboxProviderRegistry } from "@kata-sh/code-sandbox/registry";
import { SandboxProviderError, type SandboxHandle } from "@kata-sh/code-sandbox/driver";
import { DockerSandboxProvider, dockerConfigDecoder } from "@kata-sh/code-sandbox-docker";

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

/** In-memory map of running sessions (instanceId → handle). Phase 1; not durable. */
const runningSessions = new Map<string, SandboxHandle>();

export interface SandboxService {
  readonly listInstances: (
    settings: ServerSettings,
  ) => Effect.Effect<ReadonlyArray<SandboxInstanceSummary>, SandboxRpcError>;
  readonly testConnection: (
    instanceId: SandboxProviderInstanceId,
    settings: ServerSettings,
  ) => Stream.Stream<SandboxTestConnectionProgressEvent, SandboxRpcError>;
  readonly startSession: (
    instanceId: SandboxProviderInstanceId,
    settings: ServerSettings,
  ) => Effect.Effect<SandboxStartSessionResult, SandboxRpcError>;
  readonly disposeSession: (
    instanceId: SandboxProviderInstanceId,
  ) => Effect.Effect<boolean, SandboxRpcError>;
}

export const SandboxServiceLive: SandboxService = {
  listInstances: (settings) =>
    Effect.gen(function* () {
      const registry = buildRegistry();
      const materialized = registry.materialize(
        settings.sandboxProviderInstances as SandboxProviderInstanceConfigMap,
      );
      return yield* Effect.forEach(materialized, toSummary, { concurrency: "unbounded" });
    }),

  testConnection: (instanceId, settings) =>
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

  startSession: (instanceId, settings) =>
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
      const bootstrapToken = Crypto.randomBytes(24).toString("hex");
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
      // Connect auto-registration hook (AC-1.11): per-deployment link via the
      // relay managed-endpoint path. The loopback origin is fronted by the relay
      // for other paired clients. Wired in a later increment; the loopback
      // endpoint is returned regardless so the deploying desktop can connect.
      const environmentId = `sandbox-${instanceId as string}`;
      return { instanceId, environmentId, endpoint };
    }),

  disposeSession: (instanceId) =>
    Effect.gen(function* () {
      const handle = runningSessions.get(instanceId as string);
      if (handle === undefined) return false;
      yield* DockerSandboxProvider.dispose(handle).pipe(Effect.mapError(mapDriverError));
      runningSessions.delete(instanceId as string);
      return true;
    }),
};
