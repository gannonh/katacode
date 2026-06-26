/**
 * PiProvider — builds a `ServerProviderDraft` snapshot for a Pi provider
 * instance by discovering auth, models, skills, and slash commands through
 * the in-process Pi SDK.
 *
 * Pi sessions run through the bundled `@earendil-works/pi-coding-agent` SDK
 * (no spawned CLI app-server). `binaryPath` is used only for an optional CLI
 * version probe; a missing binary makes version metadata unavailable but
 * never blocks SDK-backed sessions.
 *
 * `checkPiProviderStatus` accepts an injectable `discover` effect so the
 * snapshot state matrix (SDK unavailable, binary missing, no auth models,
 * authenticated models) can be exercised by unit tests without a real Pi
 * installation.
 *
 * @module provider/Layers/PiProvider
 */
import {
  AuthStorage,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  type PromptTemplate,
  type Skill,
} from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import type {
  ModelCapabilities,
  PiSettings,
  ProviderOptionDescriptor,
  ServerProviderModel,
  ServerProviderSkill,
  ServerProviderSlashCommand,
} from "@kata-sh/code-contracts";
import { createModelCapabilities } from "@kata-sh/code-shared/model";
import { resolveSpawnCommand } from "@kata-sh/code-shared/shell";

import { expandHomePath } from "../../pathExpansion.ts";
import {
  AUTH_PROBE_TIMEOUT_MS,
  buildServerProvider,
  parseGenericCliVersion,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";

const PI_PRESENTATION = { displayName: "Pi" } as const;

/**
 * Canonical pi thinking levels (see `@earendil-works/pi-ai` `ThinkingLevel`).
 * `"off"` disables thinking; the rest map to provider-specific values.
 */
const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
type PiThinkingLevel = (typeof PI_THINKING_LEVELS)[number];

const PI_THINKING_LEVEL_LABELS: Readonly<Record<PiThinkingLevel, string>> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
};

const VERSION_PROBE_TIMEOUT_MS = 4_000;

export interface PiDiscoveryInput {
  readonly agentDir: string;
  readonly binaryPath: string;
  readonly customModels: ReadonlyArray<string>;
  readonly cwd: string;
  readonly environment?: NodeJS.ProcessEnv;
}

export interface PiDiscoveryResult {
  /** CLI version reported by `binaryPath --version`, or null when absent. */
  readonly version: string | null;
  /** Runtime-discovered, authenticated Pi models mapped to Kata entries. */
  readonly models: ReadonlyArray<ServerProviderModel>;
  readonly skills: ReadonlyArray<ServerProviderSkill>;
  readonly slashCommands: ReadonlyArray<ServerProviderSlashCommand>;
}

/**
 * Pi model slugs are provider-qualified (`provider/model`) so the model
 * picker can disambiguate models that share an id across providers.
 */
export function piModelSlug(model: Pick<Model, "provider" | "id">): string {
  return `${model.provider}/${model.id}`;
}

/**
 * A thinking level is supported when the model's `thinkingLevelMap` does not
 * explicitly disable it. Missing keys fall back to the provider default
 * (supported); an explicit `null` marks the level unsupported. `"off"` is
 * always available — it simply disables thinking.
 */
function isThinkingLevelSupported(
  model: Pick<Model, "reasoning" | "thinkingLevelMap">,
  level: PiThinkingLevel,
): boolean {
  if (level === "off") return true;
  if (!model.reasoning) return false;
  const map = model.thinkingLevelMap;
  if (!map) return true;
  const mapped = (map as Record<string, string | null>)[level];
  return mapped === undefined ? true : mapped !== null;
}

/**
 * Build a model's `ModelCapabilities` with a single `thinkingLevel` select
 * descriptor containing exactly the SDK-supported thinking levels for that
 * model. See acceptance criterion 4.
 */
export function piModelCapabilities(
  model: Pick<Model, "reasoning" | "thinkingLevelMap">,
): ModelCapabilities {
  const supported = PI_THINKING_LEVELS.filter((level) => isThinkingLevelSupported(model, level));
  if (supported.length <= 1) {
    return createModelCapabilities({ optionDescriptors: [] });
  }
  const descriptor: ProviderOptionDescriptor = {
    id: "thinkingLevel",
    label: "Thinking",
    type: "select",
    options: supported.map((level) =>
      level === "off"
        ? { id: level, label: PI_THINKING_LEVEL_LABELS[level], isDefault: true }
        : { id: level, label: PI_THINKING_LEVEL_LABELS[level] },
    ),
    currentValue: "off",
  };
  return createModelCapabilities({ optionDescriptors: [descriptor] });
}

/**
 * Map Pi SDK models into Kata `ServerProviderModel` entries. Only
 * authenticated models (registry `getAvailable`) are passed in by the
 * discovery layer, so the picker never offers a model the user cannot run.
 */
export function mapPiModels(
  models: ReadonlyArray<Model>,
  customModels: ReadonlyArray<string>,
): ReadonlyArray<ServerProviderModel> {
  const discovered: ServerProviderModel[] = models.map((model) => ({
    slug: piModelSlug(model),
    name: model.name,
    subProvider: model.provider,
    isCustom: false,
    capabilities: piModelCapabilities(model),
  }));

  const seen = new Set(discovered.map((model) => model.slug));
  const customEntries: ServerProviderModel[] = [];
  for (const candidate of customModels) {
    const slug = candidate.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    customEntries.push({ slug, name: slug, isCustom: true, capabilities: null });
  }
  return [...discovered, ...customEntries];
}

export function mapPiSkills(skills: ReadonlyArray<Skill>): ReadonlyArray<ServerProviderSkill> {
  return skills.map((skill) => {
    const mapped: ServerProviderSkill = {
      name: skill.name,
      path: skill.filePath,
      enabled: true,
    };
    if (skill.description) mapped.description = skill.description;
    if (skill.source) mapped.scope = skill.source;
    return mapped;
  });
}

export function mapPiSlashCommands(
  prompts: ReadonlyArray<PromptTemplate>,
): ReadonlyArray<ServerProviderSlashCommand> {
  return prompts
    .filter((prompt) => prompt.name.startsWith("/"))
    .map((prompt) => {
      const name = prompt.name.replace(/^\//, "");
      const command: ServerProviderSlashCommand = {
        name,
        input: { hint: "Message" },
      };
      if (prompt.description) command.description = prompt.description;
      return command;
    });
}

/** Resolve the effective agent directory, expanding `~` and falling back to the SDK default. */
export function resolvePiAgentDir(agentDir: string): string {
  const trimmed = agentDir.trim();
  return trimmed.length > 0 ? expandHomePath(trimmed) : getAgentDir();
}

const probePiVersion = (
  binaryPath: string,
  environment: NodeJS.ProcessEnv,
): Effect.Effect<string | null, unknown, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const command = binaryPath || "pi";
    const spawnCommand = yield* resolveSpawnCommand(command, ["--version"], {
      env: environment,
    });
    return yield* spawnAndCollect(
      command,
      ChildProcess.make(spawnCommand.command, spawnCommand.args, {
        env: environment,
        shell: spawnCommand.shell,
      }),
    ).pipe(
      Effect.timeout(Duration.millis(VERSION_PROBE_TIMEOUT_MS)),
      Effect.flatMap((result) =>
        Effect.succeed(parseGenericCliVersion(`${result.stdout}\n${result.stderr}`)),
      ),
      Effect.catchAll(() => Effect.succeed<string | null>(null)),
    );
  });

/**
 * Real SDK discovery: CLI version probe + `ModelRegistry.getAvailable()` for
 * authenticated models + `DefaultResourceLoader` for skills and prompt
 * commands. Returns the mapped `PiDiscoveryResult`. Tests inject a fake
 * `discover` into `checkPiProviderStatus` instead.
 */
export const discoverPiProvider = Effect.fn("discoverPiProvider")(function* (input: {
  readonly agentDir: string;
  readonly binaryPath: string;
  readonly customModels: ReadonlyArray<string>;
  readonly cwd: string;
  readonly environment?: NodeJS.ProcessEnv;
}): Effect.fn.Return<PiDiscoveryResult, never, ChildProcessSpawner.ChildProcessSpawner> {
  const environment = input.environment ?? process.env;
  const version = yield* probePiVersion(input.binaryPath, environment).pipe(
    Effect.catchAll(() => Effect.succeed<string | null>(null)),
  );

  const raw = yield* Effect.promise(async () => {
    const authStorage = input.agentDir
      ? AuthStorage.create(`${input.agentDir}/auth.json`)
      : AuthStorage.create();
    const modelRegistry = input.agentDir
      ? ModelRegistry.create(authStorage, `${input.agentDir}/models.json`)
      : ModelRegistry.create(authStorage);

    const loader = new DefaultResourceLoader({
      cwd: input.cwd,
      agentDir: input.agentDir || getAgentDir(),
    });
    await loader.reload();

    return {
      models: modelRegistry.getAvailable(),
      skills: loader.getSkills(),
      prompts: loader.getPrompts(),
    };
  });

  return {
    version,
    models: mapPiModels(raw.models as ReadonlyArray<Model>, input.customModels),
    skills: mapPiSkills(raw.skills as ReadonlyArray<Skill>),
    slashCommands: mapPiSlashCommands(raw.prompts as ReadonlyArray<PromptTemplate>),
  };
});

const emptyPiModelsFromSettings = (piSettings: PiSettings): ReadonlyArray<ServerProviderModel> =>
  piSettings.customModels.map((candidate) => {
    const slug = candidate.trim();
    return { slug, name: slug, isCustom: true, capabilities: null };
  });

export const makePendingPiProvider = (piSettings: PiSettings): Effect.Effect<ServerProviderDraft> =>
  Effect.gen(function* () {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const models = emptyPiModelsFromSettings(piSettings);

    if (!piSettings.enabled) {
      return buildServerProvider({
        presentation: PI_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Pi is disabled in Kata Code settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Pi provider status has not been checked in this session yet.",
      },
    });
  });

/**
 * Build a Pi provider snapshot. The `discover` parameter defaults to the real
 * SDK discovery and is injectable so the four criterion-3 states can be
 * asserted in tests.
 */
export const checkPiProviderStatus = Effect.fn("checkPiProviderStatus")(function* (
  piSettings: PiSettings,
  discover: (input: {
    readonly agentDir: string;
    readonly binaryPath: string;
    readonly customModels: ReadonlyArray<string>;
    readonly cwd: string;
    readonly environment?: NodeJS.ProcessEnv;
  }) => Effect.Effect<
    PiDiscoveryResult,
    unknown,
    ChildProcessSpawner.ChildProcessSpawner
  > = discoverPiProvider,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const fallbackModels = emptyPiModelsFromSettings(piSettings);

  if (!piSettings.enabled) {
    return buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: false,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Pi is disabled in Kata Code settings.",
      },
    });
  }

  const agentDir = resolvePiAgentDir(piSettings.agentDir);
  const discovery = yield* discover({
    agentDir,
    binaryPath: piSettings.binaryPath,
    customModels: piSettings.customModels,
    cwd: process.cwd(),
    environment,
  }).pipe(Effect.timeoutOption(Duration.millis(AUTH_PROBE_TIMEOUT_MS)), Effect.result);

  if (Result.isFailure(discovery)) {
    const error = discovery.failure;
    return buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: piSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: false,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: `Pi SDK provider probe failed: ${
          error instanceof Error ? error.message : String(error)
        }.`,
      },
    });
  }

  if (Option.isNone(discovery.success)) {
    return buildServerProvider({
      presentation: PI_PRESENTATION,
      enabled: piSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "Timed out while checking the Pi provider status.",
      },
    });
  }

  const result = discovery.success.value;
  const hasAuthenticatedModels = result.models.some((model) => !model.isCustom);

  return buildServerProvider({
    presentation: PI_PRESENTATION,
    enabled: piSettings.enabled,
    checkedAt,
    models: result.models,
    skills: result.skills,
    slashCommands: result.slashCommands,
    probe: {
      installed: true,
      version: result.version,
      status: hasAuthenticatedModels ? "ready" : "error",
      auth: hasAuthenticatedModels ? { status: "authenticated" } : { status: "unauthenticated" },
      ...(hasAuthenticatedModels
        ? {}
        : {
            message:
              "Pi has no authenticated models. Configure Pi auth or an API key and try again.",
          }),
    },
  });
});
