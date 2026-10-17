import { join } from "node:path";
import { homeDir } from "../bridge/bridge-config.ts";
import { UPDATE_CHECK_INTERVAL_MS, UPDATE_STATE_FILE } from "../constants/updates.ts";
import { LatestVersion } from "./latest-version.ts";

/**
 * Asks for the newest Pixelwright now and once a day after, telling the bridge's plugin windows each time it is
 * known. The timer never keeps the process alive: the server ends with its MCP client.
 */
export function watchLatest(bridge: { announceLatest(version: string): void }, enabled: boolean): void {
  const latest = new LatestVersion({
    file: join(homeDir(), UPDATE_STATE_FILE),
    enabled,
  });
  const tell = () =>
    void latest.check().then((version) => {
      if (version !== null) {
        bridge.announceLatest(version);
      }
    });

  tell();
  setInterval(tell, UPDATE_CHECK_INTERVAL_MS).unref();
}
