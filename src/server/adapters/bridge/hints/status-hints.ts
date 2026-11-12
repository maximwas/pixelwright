import { InjectionToken, injectable } from "@needle-di/core";
import { PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link.constants.ts";
import type { PairingStatus, PluginLinkRole } from "@/core/ports/plugin-link.port.ts";
import {
  BRIDGE_ROLE_HINT,
  NO_FILE_HINT,
  PAIRING_CODE_HINT,
  PAIRING_LOCK_HINT,
  PROTOCOL_REFUSAL_HINT,
  REJECTION_HINT,
} from "@/server/adapters/bridge/hints/hints.constants.ts";
import type { UpgradeRejection } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import type { ProtocolRefusal } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { CLOSE_CODE, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";

/**
 * The status hint (S-035): what the user should do next, in words the model passes on. The rows are tried in priority
 * order: bridge state > pairing code > pairing pause > connected (no hint) > plugin of another protocol > refused
 * connection > no file. A code beats a connected file, so a second file's window still gets paired; a plugin turned
 * away for its protocol is surely ours, a refused connection maybe a stranger.
 */
@injectable()
export class StatusHints {
  hint(facts: HintFacts): string | null {
    const { pairing, refusal, rejection } = facts;

    // A bridge that is off, broken, handed over or out of reach says so before anything else.
    if (facts.role !== PLUGIN_LINK_ROLE.owner && facts.role !== PLUGIN_LINK_ROLE.peer) {
      return this.#bridgeRole(facts);
    }

    // A plugin waits with a code in force: the model relays it and never types it (S-020, D-08).
    if (pairing !== null && pairing.code !== null) {
      return PAIRING_CODE_HINT.text(pairing.code, CHANNEL.pluginName, pairing.expiresInSeconds);
    }

    // Pairing is paused after too many wrong codes: someone may be guessing (S-021).
    if (pairing !== null && pairing.lockedForSeconds !== null) {
      return PAIRING_LOCK_HINT.text(pairing.lockedForSeconds);
    }

    // A file is connected and nothing above went wrong: no hint at all.
    if (facts.files > 0) {
      return null;
    }

    if (refusal !== null) {
      return this.#protocolRefusal(refusal);
    }

    // No file, but a connection was refused: a plugin set up wrong, or a stranger knocking (S-003).
    if (rejection !== null) {
      return REJECTION_HINT.text(rejection.origin, rejection.reason, CHANNEL.pluginName);
    }

    // Last row, always applies: the bridge is up and no file is connected yet.
    return NO_FILE_HINT.text(CHANNEL.pluginName);
  }

  #bridgeRole(facts: HintFacts): string | null {
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

  /**
   * No file, but a plugin of another protocol was turned away with 4426 (S-003, S-004): an older plugin needs the one
   * that comes with this server, an older server needs updating. Named by its version, so the user knows which copy.
   */
  #protocolRefusal(refusal: ProtocolRefusal): string {
    const plugin = PROTOCOL_REFUSAL_HINT.plugin(CHANNEL.pluginName, refusal.pluginVersion);

    return refusal.protocol < PROTOCOL
      ? PROTOCOL_REFUSAL_HINT.older(plugin, refusal.protocol, PROTOCOL)
      : PROTOCOL_REFUSAL_HINT.newer(plugin, refusal.protocol, PROTOCOL);
  }
}

export const STATUS_HINTS = new InjectionToken<StatusHints>("StatusHints");

/** What status knows about the bridge when it picks a hint. */
export interface HintFacts {
  readonly role: PluginLinkRole;
  readonly port: number;
  /** Why the bridge could not start, when the role is failed. */
  readonly failure: string | null;
  /** How the owner closed this server's socket, when the role is unavailable. */
  readonly closeCode: number | null;
  readonly pairing: PairingStatus | null;
  /** Files whose plugin is connected. */
  readonly files: number;
  /** The last plugin upgrade the guard refused since a plugin connected. */
  readonly rejection: UpgradeRejection | null;
  /** The last plugin turned away for its protocol since a plugin connected. */
  readonly refusal: ProtocolRefusal | null;
}
