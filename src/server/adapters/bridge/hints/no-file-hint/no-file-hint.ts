import { injectable } from "@needle-di/core";
import { CHANNEL } from "../../../../../shared/protocol/channel.constants.ts";
import type { StatusHint } from "../status-hints/status-hints.types.ts";

/** Last row, always applies: the bridge is up and no file is connected yet. */
@injectable()
export class NoFileHint implements StatusHint {
  applies(): boolean {
    return true;
  }

  text(): string {
    return `No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → ${CHANNEL.pluginName}, and keep the plugin window open.`;
  }
}
