import { injectable } from "@needle-di/core";
import { PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link/plugin-link.constants.ts";
import { BRIDGE_ROLE_HINT } from "@/server/adapters/bridge/hints/bridge-role-hint/bridge-role-hint.constants.ts";
import type { HintFacts, StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

/** First row: a bridge that is off, broken, handed over or out of reach says so before anything else. */
@injectable()
export class BridgeRoleHint implements StatusHint {
  applies({ role }: HintFacts): boolean {
    return role !== PLUGIN_LINK_ROLE.owner && role !== PLUGIN_LINK_ROLE.peer;
  }

  text(facts: HintFacts): string | null {
    switch (facts.role) {
      case PLUGIN_LINK_ROLE.disabled:
        return BRIDGE_ROLE_HINT.disabled;
      case PLUGIN_LINK_ROLE.failed:
        return BRIDGE_ROLE_HINT.failed(facts.failure);
      case PLUGIN_LINK_ROLE.handedOver:
        return BRIDGE_ROLE_HINT.handedOver;
      case PLUGIN_LINK_ROLE.unavailable:
        return this.#unavailable(facts);
      default:
        return null;
    }
  }

  /** Who holds the port, as far as the way it closed this server's socket tells. */
  #unavailable({ closeCode, port }: HintFacts): string {
    if (closeCode === CLOSE_CODE.handedOver) {
      return BRIDGE_ROLE_HINT.takingOver(port);
    }

    return closeCode === CLOSE_CODE.versionMismatch
      ? BRIDGE_ROLE_HINT.otherVersion(port)
      : BRIDGE_ROLE_HINT.notPixelwright(port);
  }
}
