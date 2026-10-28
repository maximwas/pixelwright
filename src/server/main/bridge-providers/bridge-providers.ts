import { join } from "node:path";
import type { Container } from "@needle-di/core";
import { PLUGIN_LINK } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import { BRIDGE_FILE } from "@/server/adapters/bridge/bridge-config/bridge-config.constants.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/bridge-config/bridge-config.tokens.ts";
import { BridgeConfig } from "@/server/adapters/bridge/bridge-config/bridge-config.ts";
import { BRIDGE_LISTENER } from "@/server/adapters/bridge/bridge-listener/bridge-listener.tokens.ts";
import { BridgeListener } from "@/server/adapters/bridge/bridge-listener/bridge-listener.ts";
import { STATUS_HINT_ORDER } from "@/server/adapters/bridge/hints/status-hints/status-hints.constants.ts";
import { STATUS_HINT_RULES, STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import { StatusHints } from "@/server/adapters/bridge/hints/status-hints/status-hints.ts";
import { NoBridge } from "@/server/adapters/bridge/no-bridge/no-bridge.ts";
import { OWNER_BRIDGE } from "@/server/adapters/bridge/owner-bridge/owner-bridge.tokens.ts";
import { OwnerBridge } from "@/server/adapters/bridge/owner-bridge/owner-bridge.ts";
import { OWNER_PEERS, OwnerPeers } from "@/server/adapters/bridge/owner-peers/owner-peers.ts";
import { OWNER_ROUTER, OwnerRouter } from "@/server/adapters/bridge/owner-router/owner-router.ts";
import { PAIRING_CODES } from "@/server/adapters/bridge/pairing-codes/pairing-codes.tokens.ts";
import { PairingCodes } from "@/server/adapters/bridge/pairing-codes/pairing-codes.ts";
import { PEER_BRIDGE, PeerBridge } from "@/server/adapters/bridge/peer-bridge/peer-bridge.ts";
import { PluginBridge } from "@/server/adapters/bridge/plugin-bridge/plugin-bridge.ts";
import { PLUGIN_CONNECTIONS } from "@/server/adapters/bridge/plugin-connections/plugin-connections.tokens.ts";
import { PluginConnections } from "@/server/adapters/bridge/plugin-connections/plugin-connections.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry/session-registry.tokens.ts";
import { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry/session-registry.ts";
import { UPGRADE_GUARD } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.tokens.ts";
import { UpgradeGuard } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.ts";
import type { ServerConfig } from "@/server/main/config-reader/config-reader.types.ts";

/**
 * The bridge's bindings: its settings, bridge.json, pairing codes, the session registry, the plugin connections, the
 * upgrade guard, the listener and the status hint table in priority order, and PLUGIN_LINK: the owner, or NoBridge
 * with PIXELWRIGHT_PLUGIN_BRIDGE=off.
 */
export class BridgeProviders {
  register(
    container: Container,
    { bridgePort, pluginOrigins, home, pluginBridge }: ServerConfig,
  ): void {
    this.#bindHints(container);
    container
      .bind({
        provide: BRIDGE_SETTINGS,
        useValue: {
          port: bridgePort,
          pluginOrigins,
          configFile: join(home, BRIDGE_FILE),
        },
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
        provide: SESSION_REGISTRY,
        useClass: SessionRegistry,
      })
      .bind({
        provide: PLUGIN_CONNECTIONS,
        useClass: PluginConnections,
      })
      .bind({
        provide: UPGRADE_GUARD,
        useClass: UpgradeGuard,
      })
      .bind({
        provide: BRIDGE_LISTENER,
        useClass: BridgeListener,
      });
    this.#bindRoles(container, pluginBridge);
  }

  /** The roles PluginBridge picks from at start (S-030), and the owner's peers; off binds NoBridge. */
  #bindRoles(
    container: Container,
    pluginBridge: boolean,
  ): void {
    container
      .bind({
        provide: OWNER_BRIDGE,
        useClass: OwnerBridge,
      })
      .bind({
        provide: OWNER_ROUTER,
        useClass: OwnerRouter,
      })
      .bind({
        provide: OWNER_PEERS,
        useClass: OwnerPeers,
      })
      .bind({
        provide: PEER_BRIDGE,
        useClass: PeerBridge,
      })
      .bind({
        provide: PLUGIN_LINK,
        useClass: pluginBridge ? PluginBridge : NoBridge,
      });
  }

  /** The status hint table: its rows in priority order, and the table that tries them. */
  #bindHints(container: Container): void {
    for (const rule of STATUS_HINT_ORDER) {
      container.bind({
        provide: STATUS_HINT_RULES,
        multi: true,
        useClass: rule,
      });
    }

    container.bind({
      provide: STATUS_HINTS,
      useClass: StatusHints,
    });
  }
}
