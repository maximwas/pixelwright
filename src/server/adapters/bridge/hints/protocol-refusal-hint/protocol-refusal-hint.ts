import { injectable } from "@needle-di/core";
import { CHANNEL } from "../../../../../shared/protocol/channel.constants.ts";
import { PROTOCOL } from "../../../../../shared/protocol/protocol.constants.ts";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";
import { PROTOCOL_REFUSAL_HINT } from "./protocol-refusal-hint.constants.ts";

/**
 * No file, but a plugin of another protocol was turned away with 4426 (S-003, S-004): an older plugin needs the one
 * that comes with this server, an older server needs updating. Named by its version, so the user knows which copy.
 */
@injectable()
export class ProtocolRefusalHint implements StatusHint {
  applies({ refusal }: HintFacts): boolean {
    return refusal !== null;
  }

  text({ refusal }: HintFacts): string | null {
    if (refusal === null) {
      return null;
    }

    const plugin = PROTOCOL_REFUSAL_HINT.plugin(CHANNEL.pluginName, refusal.pluginVersion);

    return refusal.protocol < PROTOCOL
      ? PROTOCOL_REFUSAL_HINT.older(plugin, refusal.protocol, PROTOCOL)
      : PROTOCOL_REFUSAL_HINT.newer(plugin, refusal.protocol, PROTOCOL);
  }
}
