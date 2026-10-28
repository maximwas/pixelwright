import { injectable } from "@needle-di/core";
import { NO_FILE_HINT } from "@/server/adapters/bridge/hints/no-file-hint/no-file-hint.constants.ts";
import type { StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** Last row, always applies: the bridge is up and no file is connected yet. */
@injectable()
export class NoFileHint implements StatusHint {
  applies(): boolean {
    return true;
  }

  text(): string {
    return NO_FILE_HINT.text(CHANNEL.pluginName);
  }
}
