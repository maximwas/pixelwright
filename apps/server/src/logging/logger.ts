import pino from "pino";
import type { LogLevel } from "../types/logging.ts";

/** stdout belongs to MCP JSON-RPC, so logs go to stderr (fd 2), where MCP clients keep them per session. */
export function createLogger(level: LogLevel) {
  return pino(
    {
      name: "pixelwright",
      level,
      redact: {
        paths: ["token", "*.token", "headers"],
        censor: "[redacted]",
      },
    },
    pino.destination({
      dest: 2,
      sync: true,
    }),
  );
}
