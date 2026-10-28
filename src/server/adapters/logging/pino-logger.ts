import { inject, injectable } from "@needle-di/core";
import { pino } from "pino";
import { CHANNEL } from "../../../shared/protocol/channel.constants.ts";
import { VERSION } from "../../../shared/version/version.constants.ts";
import { REDACTED, REDACTED_PATHS } from "./logging.constants.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "./logging.tokens.ts";
import { PinoLines } from "./pino-lines.ts";

/**
 * The server's root logger: JSON lines with time, level, pid, version and channel to every destination (stderr and the
 * shared file), secrets redacted, errors with their type, code, stack and cause (plan 3.2).
 */
@injectable()
export class PinoLogger extends PinoLines {
  constructor(settings = inject(LOG_SETTINGS), destinations = inject(LOG_DESTINATIONS, { multi: true })) {
    super(
      pino(
        {
          level: settings.level,
          base: {
            pid: process.pid,
            version: VERSION,
            channel: CHANNEL.name,
          },
          redact: {
            paths: REDACTED_PATHS,
            censor: REDACTED,
          },
          serializers: { err: pino.stdSerializers.errWithCause },
        },
        // The logger filters by its level; every destination takes what it lets through.
        pino.multistream(
          destinations.map((stream) => ({
            stream,
            level: "trace",
          })),
        ),
      ),
    );
  }
}
