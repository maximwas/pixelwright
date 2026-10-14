import { join } from "node:path";
import { SUPPORT_LINKS } from "@pixelwright/core";
import serverPackage from "../package.json" with { type: "json" };
import { fileStore } from "./assets/written-files.ts";
import { bridgeConfigFile, homeDir, loadOrCreateBridgeConfig } from "./bridge/bridge-config.ts";
import { BridgeServer } from "./bridge/bridge-server.ts";
import { OwnerClient } from "./bridge/owner-client.ts";
import { PluginBridge } from "./bridge/plugin-bridge.ts";
import { FilePluginKeys } from "./bridge/plugin-keys.ts";
import { readConfig } from "./config/config.ts";
import { DEFAULT_BRIDGE_PORT } from "./constants/bridge.ts";
import { BRIDGE_INFO_EVENTS } from "./constants/logging.ts";
import { SUPPORT_STATE_FILE } from "./constants/support.ts";
import { createLogger } from "./logging/logger.ts";
import { createMcpServer } from "./mcp/mcp-server.ts";
import { SupportReminder } from "./support/support-reminder.ts";
import type { App } from "./types/app.ts";
import type { BridgeConfig } from "./types/bridge.ts";
import type { AppConfig } from "./types/config.ts";
import type { Logger } from "./types/logging.ts";

/** Wires the server together from its environment; the bridge starts trying to connect at once. */
export async function createApp(): Promise<App> {
  const config = readConfig(process.env);
  const logger = createLogger(config.logLevel, config.logFile);
  const bridge = await createBridge(config, logger);
  const server = createMcpServer({
    bridge,
    version: serverPackage.version,
    files: fileStore(),
    projectRoot: config.projectRoot ?? process.cwd(),
    support: new SupportReminder({
      file: join(homeDir(), SUPPORT_STATE_FILE),
      enabled: config.supportReminders,
      links: SUPPORT_LINKS,
    }),
  });

  return {
    server,
    bridge,
    logger,
    close: async () => {
      await Promise.allSettled([bridge.close(), server.close()]);
    },
  };
}

async function createBridge(config: AppConfig, logger: Logger): Promise<PluginBridge> {
  if (!config.bridgeEnabled) {
    return PluginBridge.disabled({
      port: DEFAULT_BRIDGE_PORT,
      logger,
    });
  }

  let bridgeConfig: BridgeConfig;

  try {
    bridgeConfig = loadOrCreateBridgeConfig({ warn: (message) => logger.warn(message) });
  } catch (error) {
    logger.error({ err: error }, "The plugin bridge's config could not be read");

    return PluginBridge.failed(error, {
      port: DEFAULT_BRIDGE_PORT,
      logger,
    });
  }

  const { port, token } = bridgeConfig;
  // A plugin coming and going is what a person following the logs looks for; the rest is detail.
  const log = (message: string, data: Record<string, unknown> = {}) =>
    BRIDGE_INFO_EVENTS.has(message) ? logger.info(data, message) : logger.debug(data, message);
  const server = new BridgeServer({
    port,
    token,
    pluginOrigins: config.pluginOrigins,
    serverVersion: serverPackage.version,
    log,
    // A deleted bridge.json revokes every key: the fallback rebuilds it with this process's port and token, no keys.
    keys: new FilePluginKeys(
      bridgeConfigFile(),
      () => ({
        ...bridgeConfig,
        pluginKeys: [],
      }),
      (message) => logger.warn(message),
    ),
  });

  return PluginBridge.connect(
    server,
    new OwnerClient({
      port,
      token,
      log,
    }),
    {
      port,
      logger,
    },
  );
}
