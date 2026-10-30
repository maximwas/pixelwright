import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InjectionToken } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import { BUILD_STYLES } from "@/core/checks/build-styles/build-styles.ts";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { CLIENT_ROOTS } from "@/core/ports/client-roots.port.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { LOGGER } from "@/core/ports/logger.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { OUTLINE_XML } from "@/core/xml/outline/outline-xml.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { BRIDGE_LISTENER } from "@/server/adapters/bridge/listener/bridge-listener.ts";
import { UPGRADE_GUARD } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import { NoBridge } from "@/server/adapters/bridge/no-bridge.ts";
import { OWNER_BRIDGE } from "@/server/adapters/bridge/owner/owner-bridge.ts";
import { PAIRING_CODES } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { PLUGIN_CONNECTIONS } from "@/server/adapters/bridge/plugin/plugin-connections.ts";
import { PluginBridge } from "@/server/adapters/bridge/plugin-bridge.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { MCP_ROOTS } from "@/server/adapters/mcp/mcp-roots.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { WITHIN_SCOPE } from "@/server/app/scope/within-scope.ts";
import { TOOL_FACTORY, TOOL_RUNNER } from "@/server/app/tool-runner/tool-runner.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import { TOOL_CATALOG } from "@/server/tools/tool.catalog.ts";

/** The root as the server composes it, without start(): constructors touch nothing, so nothing listens. */
const root = (pluginBridge: boolean) =>
  new ServerMain({
    home: mkdtempSync(join(tmpdir(), "pixelwright-composition-")),
    logLevel: "silent",
    pluginBridge,
    bridgePort: 0,
    pluginOrigins: [],
    projectDir: tmpdir(),
  }).container();

const SINGLETONS: [string, InjectionToken<unknown>][] = [
  ["LOGGER", LOGGER],
  ["CLOCK", CLOCK],
  ["JSON_FILE", JSON_FILE],
  ["PLUGIN_LINK", PLUGIN_LINK],
  ["BRIDGE_SETTINGS", BRIDGE_SETTINGS],
  ["BRIDGE_CONFIG", BRIDGE_CONFIG],
  ["PAIRING_CODES", PAIRING_CODES],
  ["SESSION_REGISTRY", SESSION_REGISTRY],
  ["PLUGIN_CONNECTIONS", PLUGIN_CONNECTIONS],
  ["UPGRADE_GUARD", UPGRADE_GUARD],
  ["BRIDGE_LISTENER", BRIDGE_LISTENER],
  ["STATUS_HINTS", STATUS_HINTS],
  ["TOOL_CATALOG", TOOL_CATALOG],
  ["TOOL_FACTORY", TOOL_FACTORY],
  ["TOOL_RUNNER", TOOL_RUNNER],
  ["MCP_ROOTS", MCP_ROOTS],
  ["CLIENT_ROOTS", CLIENT_ROOTS],
  ["PROJECT_FOLDER", PROJECT_FOLDER],
  ["OUTLINE_XML", OUTLINE_XML],
  ["DESIGN_XML", DESIGN_XML],
  ["WITHIN_SCOPE", WITHIN_SCOPE],
  ["SELECTED_LAYER", SELECTED_LAYER],
  ["BUILD_STYLES", BUILD_STYLES],
];

describe("ServerMain's composition", () => {
  it.each(SINGLETONS)("resolves %s, and a child container reaches the root's own instance", (_name, token) => {
    const container = root(true);

    expect(container.get(token)).toBeDefined();
    expect(container.createChild().get(token)).toBe(container.get(token));
  });

  it("gives the project folder the roots the MCP endpoint asks: one McpRoots", () => {
    const container = root(true);

    expect(container.get(CLIENT_ROOTS)).toBe(container.get(MCP_ROOTS));
  });

  it("binds the owner as the plugin link, or NoBridge with the bridge off", () => {
    expect(root(true).get(PLUGIN_LINK)).toBeInstanceOf(PluginBridge);
    expect(root(false).get(PLUGIN_LINK)).toBeInstanceOf(NoBridge);
  });

  it("gives the owner, the listener and the plugin connections one session registry", async () => {
    const container = root(true);
    const sessions = container.get(SESSION_REGISTRY);

    sessions.refused({ protocol: 5, pluginVersion: "0.7.0" });

    expect((await container.get(OWNER_BRIDGE).state()).hint).toContain("0.7.0");
  });
});
