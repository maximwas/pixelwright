import { injectable } from "@needle-di/core";
import { CHANNEL } from "../../../../../shared/protocol/channel.constants.ts";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";

/** No file, but a connection was refused: a plugin set up wrong, or a stranger knocking (S-003). */
@injectable()
export class RejectionHint implements StatusHint {
  applies({ rejection }: HintFacts): boolean {
    return rejection !== null;
  }

  text({ rejection }: HintFacts): string {
    return `A connection from origin ${rejection?.origin ?? "(none)"} was refused (${rejection?.reason}): if it was not the ${CHANNEL.pluginName} plugin, ignore it.`;
  }
}
