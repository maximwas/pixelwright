import { join } from "node:path";
import type { Container } from "@needle-di/core";
import { PLUGIN_LINK } from "../../../core/ports/plugin-link/plugin-link.port.ts";
import { BRIDGE_SETTINGS } from "../../adapters/bridge/bridge.tokens.ts";
import { BRIDGE_CONFIG } from "../../adapters/bridge/bridge-config/bridge-config.tokens.ts";
import { BridgeConfig } from "../../adapters/bridge/bridge-config/bridge-config.ts";
import { BRIDGE_LISTENER } from "../../adapters/bridge/bridge-listener/bridge-listener.tokens.ts";
import { BridgeListener } from "../../adapters/bridge/bridge-listener/bridge-listener.ts";
import { STATUS_HINT_ORDER } from "../../adapters/bridge/hints/status-hints/status-hints.constants.ts";
import { STATUS_HINT_RULES, STATUS_HINTS } from "../../adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import { StatusHints } from "../../adapters/bridge/hints/status-hints/status-hints.ts";
import { NoBridge } from "../../adapters/bridge/no-bridge/no-bridge.ts";
import { OwnerBridge } from "../../adapters/bridge/owner-bridge/owner-bridge.ts";
import { PAIRING_CODES } from "../../adapters/bridge/pairing-codes/pairing-codes.tokens.ts";
import { PairingCodes } from "../../adapters/bridge/pairing-codes/pairing-codes.ts";
import { UPGRADE_GUARD } from "../../adapters/bridge/upgrade-guard/upgrade-guard.tokens.ts";
import { UpgradeGuard } from "../../adapters/bridge/upgrade-guard/upgrade-guard.ts";
import type { ServerConfig } from "../config-reader/config-reader.types.ts";

/**
 * The bridge's bindings: its settings, bridge.json, pairing codes, the upgrade guard, the listener and the status hint
 * table in priority order, and PLUGIN_LINK: the owner, or NoBridge with PIXELWRIGHT_PLUGIN_BRIDGE=off.
 */
export class BridgeProviders {
  register(
    container: Container,
    { bridgePort, pluginOrigins, home, pluginBridge }: ServerConfig,
  ): void {
    for (const rule of STATUS_HINT_ORDER) {
      container.bind({
        provide: STATUS_HINT_RULES,
        multi: true,
        useClass: rule,
      });
    }

    container
      .bind({
        provide: BRIDGE_SETTINGS,
        useValue: {
          port: bridgePort,
          pluginOrigins,
          configFile: join(home, "bridge.json"),
        },
      })
      .bind({
        provide: STATUS_HINTS,
        useClass: StatusHints,
      })
      .bind({
        provide: BRIDGE_CONFIG,
        useClass: BridgeConfig,
      })
      .bind({
        provide: PAIRING_CODES,
        useClass: PairingCodes,
      })
      .bind({
        provide: UPGRADE_GUARD,
        useClass: UpgradeGuard,
      })
      .bind({
        provide: BRIDGE_LISTENER,
        useClass: BridgeListener,
      })
      // shortcut: owner or off until item 07's PluginBridge picks owner, peer or off at start.
      .bind({
        provide: PLUGIN_LINK,
        useClass: pluginBridge ? OwnerBridge : NoBridge,
      });
  }
}
