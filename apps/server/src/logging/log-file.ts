import { mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { LOG_FILE_MAX_BYTES } from "../constants/logging.ts";

/**
 * Makes the shared log file ready: its folder exists (owner only), and a file past LOG_FILE_MAX_BYTES is set aside as
 * `.1`, replacing the previous one. False when the folder cannot be made: then logs go to stderr only.
 */
export function prepareLogFile(file: string): boolean {
  try {
    mkdirSync(dirname(file), {
      recursive: true,
      mode: 0o700,
    });

    if ((statSync(file, { throwIfNoEntry: false })?.size ?? 0) > LOG_FILE_MAX_BYTES) {
      renameSync(file, `${file}.1`);
    }

    return true;
  } catch {
    return false;
  }
}
