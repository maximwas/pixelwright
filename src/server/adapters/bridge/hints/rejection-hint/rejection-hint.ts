import { injectable } from "@needle-di/core";
import type { HintFacts, StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { REJECTION_HINT } from "./rejection-hint.constants.ts";

/** No file, but a connection was refused: a plugin set up wrong, or a stranger knocking (S-003). */
@injectable()
export class RejectionHint implements StatusHint {
  applies({ rejection }: HintFacts): boolean {
    return rejection !== null;
  }

  text({ rejection }: HintFacts): string {
    return REJECTION_HINT.text(rejection?.origin, rejection?.reason, CHANNEL.pluginName);
  }
}
