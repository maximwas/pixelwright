import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LOGGER } from "@/core/ports/logger.port.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/listener/bridge-config.ts";
import type { UpgradeRejection } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import { PAIRING_CODES } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { PluginConnection } from "@/server/adapters/bridge/plugin/plugin-connection.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";

/**
 * The plugin side of the owner's port, a Factory: one PluginConnection for each plugin socket the upgrade guard let
 * in, all over the same singletons (bridge.json's keys, the pairing codes, the session registry, the log). A refused
 * plugin upgrade goes to the registry for the status hint (S-003).
 */
@injectable()
export class PluginConnections {
  readonly #keys;
  readonly #pairing;
  readonly #sessions;
  readonly #logger;

  constructor(
    keys = inject(BRIDGE_CONFIG),
    pairing = inject(PAIRING_CODES),
    sessions = inject(SESSION_REGISTRY),
    logger = inject(LOGGER),
  ) {
    this.#keys = keys;
    this.#pairing = pairing;
    this.#sessions = sessions;
    this.#logger = logger;
  }

  /** A plugin socket the guard let in: its handshake starts now. */
  open(socket: MessageSocket): void {
    new PluginConnection(socket, {
      keys: this.#keys,
      pairing: this.#pairing,
      sessions: this.#sessions,
      logger: this.#logger,
    }).start();
  }

  /** A plugin's window the guard refused, by Host or Origin. */
  rejected(rejection: UpgradeRejection): void {
    this.#sessions.rejected(rejection);
  }
}

export const PLUGIN_CONNECTIONS = new InjectionToken<PluginConnections>("PluginConnections");
