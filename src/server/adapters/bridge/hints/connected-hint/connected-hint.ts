import { injectable } from "@needle-di/core";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";

/** A file is connected and nothing above went wrong: no hint at all. */
@injectable()
export class ConnectedHint implements StatusHint {
  applies({ files }: HintFacts): boolean {
    return files > 0;
  }

  text(): null {
    return null;
  }
}
