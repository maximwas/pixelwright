import { injectable } from "@needle-di/core";
import { CLOSE_ACTION, CLOSE_RULES } from "@/plugin-ui/link/stop-reasons/stop-reasons.constants.ts";
import type { CloseDecision } from "@/plugin-ui/link/stop-reasons/stop-reasons.types.ts";
import { PROTOCOL } from "@/shared/protocol/protocol.constants.ts";
import { ProtocolReason } from "@/shared/protocol/protocol-reason/protocol-reason.ts";

/** Stop or retry after a close (P-044, A§5.2), decided by the close table CLOSE_RULES, a Strategy table per code. */
@injectable()
export class StopReasons {
  decide(
    code: number,
    reason: string,
  ): CloseDecision {
    const olderServer = (ProtocolReason.parse(reason)?.protocol ?? PROTOCOL) < PROTOCOL;
    const rule = CLOSE_RULES.find((row) => row.code === code && (olderServer || !row.olderServer));

    return {
      action: rule?.action ?? CLOSE_ACTION.retry,
      text: rule?.text ?? null,
    };
  }
}
