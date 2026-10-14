import pino from "pino";
import type { LogLevel } from "../types/logging.ts";
import { prepareLogFile } from "./log-file.ts";

/**
 * stdout belongs to MCP JSON-RPC, so logs go to stderr (fd 2), where MCP clients keep them per session. With a `file`,
 * they also go to the log every pixelwright process on this machine shares (`pixelwright logs`); each line has its pid.
 */
export function createLogger(level: LogLevel, file: string | null = null) {
  const options = {
    name: "pixelwright",
    level,
    redact: {
      paths: ["token", "*.token", "headers"],
      censor: "[redacted]",
    },
  };
  const stderr = pino.destination({
    dest: 2,
    sync: true,
  });

  const shared = file === null || !prepareLogFile(file) ? null : openShared(file);

  if (shared === null) {
    return pino(options, stderr);
  }

  return pino(
    options,
    pino.multistream([
      {
        stream: stderr,
        level,
      },
      {
        stream: shared,
        level,
      },
    ]),
  );
}

/** The shared log opened for appending; null when it cannot be (no permission, say): logs then go to stderr only. */
function openShared(file: string): ReturnType<typeof pino.destination> | null {
  try {
    return pino.destination({
      dest: file,
      sync: true,
      mode: 0o600,
    });
  } catch {
    return null;
  }
}
