import { join } from "node:path";
import type { Container } from "@needle-di/core";
import { PACKAGE_REGISTRY } from "@/core/ports/package-registry.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import { STATUS_HINTS, StatusHints } from "@/server/adapters/bridge/hints/status-hints.ts";
import { BRIDGE_CONFIG, BridgeConfig } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { BRIDGE_LISTENER, BridgeListener } from "@/server/adapters/bridge/listener/bridge-listener.ts";
import { BRIDGE_FILE } from "@/server/adapters/bridge/listener/listener.constants.ts";
import { UPGRADE_GUARD, UpgradeGuard } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import { NoBridge } from "@/server/adapters/bridge/no-bridge.ts";
import { OWNER_BRIDGE, OwnerBridge } from "@/server/adapters/bridge/owner/owner-bridge.ts";
import { OWNER_PEERS, OwnerPeers } from "@/server/adapters/bridge/owner/owner-peers.ts";
import { OWNER_ROUTER, OwnerRouter } from "@/server/adapters/bridge/owner/owner-router.ts";
import { PEER_BRIDGE, PeerBridge } from "@/server/adapters/bridge/peer/peer-bridge.ts";
import { PAIRING_CODES, PairingCodes } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { PLUGIN_CONNECTIONS, PluginConnections } from "@/server/adapters/bridge/plugin/plugin-connections.ts";
import { PluginBridge } from "@/server/adapters/bridge/plugin-bridge.ts";
import { SESSION_REGISTRY, SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { NpmRegistry } from "@/server/adapters/http/npm-registry.ts";
import { LATEST_FILE } from "@/server/app/stores/stores.constants.ts";
import { UPDATE_SETTINGS, UPDATE_STATE, UpdateState } from "@/server/app/stores/update-state.ts";
import type { ServerConfig } from "@/server/main/config/config-reader.ts";
import { UPDATE_FEED, UpdateFeed } from "@/server/main/update-feed.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * The bridge's bindings: its settings, bridge.json, pairing codes, the session registry, the plugin connections, the
 * upgrade guard, the listener and the status hint table in priority order, and PLUGIN_LINK: the owner, or NoBridge
 * with PIXELWRIGHT_PLUGIN_BRIDGE=off; and the update banner's feed to the plugin windows.
 */
export class BridgeProviders {
  register(container: Container, config: ServerConfig): void {
    const { bridgePort, pluginOrigins, home, pluginBridge } = config;

    container
      .bind({ provide: STATUS_HINTS, useClass: StatusHints })
      .bind({
        provide: BRIDGE_SETTINGS,
        useValue: { port: bridgePort, pluginOrigins, configFile: join(home, BRIDGE_FILE) },
      })
      .bind({ provide: BRIDGE_CONFIG, useClass: BridgeConfig })
      .bind({ provide: PAIRING_CODES, useClass: PairingCodes })
      .bind({ provide: SESSION_REGISTRY, useClass: SessionRegistry })
      .bind({ provide: PLUGIN_CONNECTIONS, useClass: PluginConnections })
      .bind({ provide: UPGRADE_GUARD, useClass: UpgradeGuard })
      .bind({ provide: BRIDGE_LISTENER, useClass: BridgeListener });
    this.#bindRoles(container, pluginBridge);
    this.#bindUpdates(container, config);
  }

  /** The update banner (S-070): npm asked through latest.json in the home, what the windows hear and close. */
  #bindUpdates(container: Container, { home, updateCheck = false }: ServerConfig): void {
    container
      .bind({ provide: PACKAGE_REGISTRY, useClass: NpmRegistry })
      .bind({
        provide: UPDATE_SETTINGS,
        useValue: { file: join(home, LATEST_FILE), enabled: updateCheck, running: VERSION },
      })
      .bind({ provide: UPDATE_STATE, useClass: UpdateState })
      .bind({ provide: UPDATE_FEED, useClass: UpdateFeed });
  }

  /** The roles PluginBridge picks from at start (S-030), and the owner's peers; off binds NoBridge. */
  #bindRoles(container: Container, pluginBridge: boolean): void {
    container
      .bind({ provide: OWNER_BRIDGE, useClass: OwnerBridge })
      .bind({ provide: OWNER_ROUTER, useClass: OwnerRouter })
      .bind({ provide: OWNER_PEERS, useClass: OwnerPeers })
      .bind({ provide: PEER_BRIDGE, useClass: PeerBridge })
      .bind({ provide: PLUGIN_LINK, useClass: pluginBridge ? PluginBridge : NoBridge });
  }
}
