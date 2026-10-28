import { injectable } from "@needle-di/core";
import type { HintFacts, StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PAIRING_CODE_HINT } from "./pairing-code-hint.constants.ts";

/** A plugin waits with a code in force: the model relays it and never types it (S-020, D-08). */
@injectable()
export class PairingCodeHint implements StatusHint {
  applies({ pairing }: HintFacts): boolean {
    return pairing !== null && pairing.code !== null;
  }

  text({ pairing }: HintFacts): string {
    return PAIRING_CODE_HINT.text(pairing?.code, CHANNEL.pluginName, pairing?.expiresInSeconds);
  }
}
