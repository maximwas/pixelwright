import type { InjectionToken } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store/key-value-store.port.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { PluginMain } from "@/plugin/main/plugin.main.ts";

const SINGLETONS: [string, InjectionToken<unknown>][] = [
  ["UI_CHANNEL", UI_CHANNEL],
  ["KEY_VALUE_STORE", KEY_VALUE_STORE],
  ["PAIRING_STORE", PAIRING_STORE],
  ["WINDOW_HOST", WINDOW_HOST],
];

// No figma global here: building the container must not touch it, only start() does.
describe("PluginMain's composition", () => {
  it.each(SINGLETONS)("resolves %s, and a child container reaches the root's own instance", (_name, token) => {
    const container = new PluginMain().container();

    expect(container.get(token)).toBeDefined();
    expect(container.createChild().get(token)).toBe(container.get(token));
  });
});
