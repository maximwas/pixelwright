import { inject, injectable } from "@needle-di/core";
import { LOGGER } from "../../../../core/ports/logger/logger.port.ts";
import type { MessageSocket } from "../../../../shared/protocol/message-socket.types.ts";
import { BRIDGE_CONFIG } from "../bridge-config/bridge-config.tokens.ts";
import { PAIRING_CODES } from "../pairing-codes/pairing-codes.tokens.ts";
import { PluginConnection } from "../plugin-connection/plugin-connection.ts";
import { SESSION_REGISTRY } from "../sessions/session-registry/session-registry.tokens.ts";
import type { UpgradeRejection } from "../upgrade-guard/upgrade-guard.types.ts";

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
