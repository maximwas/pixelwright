import type { InjectionToken } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch/edits-switch.port.ts";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store/key-value-store.port.ts";
import { SERVER_EVENTS } from "@/core/ports/server-events/server-events.port.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { SERVER_RPC } from "@/plugin/adapters/host/server-rpc/server-rpc.tokens.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { WINDOW_HOST } from "@/plugin/adapters/host/window-host/window-host.tokens.ts";
import { Operation } from "@/plugin/app/operation/operation.ts";
import { OPERATION_FACTORY, OPERATION_RUNNER } from "@/plugin/app/operation-runner/operation-runner.tokens.ts";
import { OPERATION_TURNS } from "@/plugin/app/operation-turns/operation-turns.tokens.ts";
import { PLUGIN_INFO_PUBLISHER } from "@/plugin/app/plugin-info-publisher/plugin-info-publisher.ts";
import { PluginMain } from "@/plugin/main/plugin.main.ts";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";

const SINGLETONS: [string, InjectionToken<unknown>][] = [
  ["UI_CHANNEL", UI_CHANNEL],
  ["KEY_VALUE_STORE", KEY_VALUE_STORE],
  ["PAIRING_STORE", PAIRING_STORE],
  ["WINDOW_HOST", WINDOW_HOST],
  ["EDITS_SWITCH", EDITS_SWITCH],
  ["SERVER_RPC", SERVER_RPC],
  ["SERVER_EVENTS", SERVER_EVENTS],
  ["DOCUMENT_EVENTS", DOCUMENT_EVENTS],
  ["PLUGIN_INFO_PUBLISHER", PLUGIN_INFO_PUBLISHER],
  ["OPERATION_TURNS", OPERATION_TURNS],
  ["OPERATION_RUNNER", OPERATION_RUNNER],
];

// No figma global here: building the container must not touch it, only start() does.
describe("PluginMain's composition", () => {
  it.each(SINGLETONS)("resolves %s, and a child container reaches the root's own instance", (_name, token) => {
    const container = new PluginMain().container();

    expect(container.get(token)).toBeDefined();
    expect(container.createChild().get(token)).toBe(container.get(token));
  });
});

describe("PluginMain's op runtime", () => {
  it("builds a fresh op for every contract in the catalog, each call its own", () => {
    const factory = new PluginMain().container().get(OPERATION_FACTORY);

    for (const contract of OP_CONTRACTS.all()) {
      const first = factory.create({
        contract,
        input: {},
      });

      expect(first).toBeInstanceOf(Operation);
      expect(
        factory.create({
          contract,
          input: {},
        }),
      ).not.toBe(first);
    }
  });
});
