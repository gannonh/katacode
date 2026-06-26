import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@kata-sh/code-contracts";

import { BUILT_IN_DRIVERS } from "../builtInDrivers.ts";
import { deriveProviderInstanceConfigMap } from "./ProviderInstanceRegistryHydration.ts";

describe("deriveProviderInstanceConfigMap", () => {
  it("includes the built-in Pi provider instance from legacy settings", () => {
    expect(BUILT_IN_DRIVERS.map((driver) => driver.driverKind)).toContain(
      ProviderDriverKind.make("pi"),
    );

    const configMap = deriveProviderInstanceConfigMap(DEFAULT_SERVER_SETTINGS);
    const piInstance = configMap[ProviderInstanceId.make("pi")];

    expect(piInstance?.driver).toBe(ProviderDriverKind.make("pi"));
    expect(piInstance?.config).toEqual(DEFAULT_SERVER_SETTINGS.providers.pi);
  });
});
