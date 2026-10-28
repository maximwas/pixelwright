import { injectable } from "@needle-di/core";
import type { StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { NO_FILE_HINT } from "./no-file-hint.constants.ts";

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
