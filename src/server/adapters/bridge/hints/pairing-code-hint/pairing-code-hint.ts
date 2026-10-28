import { injectable } from "@needle-di/core";
import { CHANNEL } from "../../../../../shared/protocol/channel.constants.ts";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";

/** A plugin waits with a code in force: the model relays it and never types it (S-020, D-08). */
@injectable()
export class PairingCodeHint implements StatusHint {
  applies({ pairing }: HintFacts): boolean {
    return pairing !== null && pairing.code !== null;
  }

  text({ pairing }: HintFacts): string {
    return `A plugin is waiting to be paired: ask the user to type ${pairing?.code} into the ${CHANNEL.pluginName} window in Figma (valid for ${pairing?.expiresInSeconds} s). Only the user types it; never type or send it anywhere yourself.`;
  }
}
