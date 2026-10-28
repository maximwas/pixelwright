import { inject, injectable } from "@needle-di/core";
import { type Logger as Pino, pino } from "pino";
import type { LogFields, Logger } from "@/core/ports/logger.port.ts";
import { LOG_LEVEL, REDACTED, REDACTED_PATHS } from "@/server/adapters/logging/logging.constants.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "@/server/adapters/logging/logging.tokens.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * The server's root logger: JSON lines with time, level, pid, version and channel to every destination (stderr and the
 * shared file), secrets redacted, errors with their type, code, stack and cause (plan 3.2). A child is the same over
 * pino's child, carrying its fields. The pino logger is built at the first line, not with the object: a constructor
 * only stores what it is given.
 */
@injectable()
export class PinoLogger implements Logger {
  readonly #settings;
  readonly #destinations;
  /** Builds the pino logger at the first line: the root's own, or for a child, a child of its parent's. */
  #create = (): Pino => this.#root();
  #pino: Pino | undefined;

  constructor(settings = inject(LOG_SETTINGS), destinations = inject(LOG_DESTINATIONS, { multi: true })) {
    this.#settings = settings;
    this.#destinations = destinations;
  }

  trace(message: string, fields: LogFields = {}): void {
    this.#logger().trace(fields, message);
  }

  debug(message: string, fields: LogFields = {}): void {
    this.#logger().debug(fields, message);
  }

  info(message: string, fields: LogFields = {}): void {
    this.#logger().info(fields, message);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.#logger().warn(fields, message);
  }

  error(message: string, fields: LogFields = {}): void {
    this.#logger().error(fields, message);
  }

  child(fields: LogFields): Logger {
    const child = new PinoLogger(this.#settings, this.#destinations);

    child.#create = () => this.#logger().child(fields);

    return child;
  }

  #logger(): Pino {
    this.#pino ??= this.#create();

    return this.#pino;
  }

  #root(): Pino {
    return pino(
      {
        level: this.#settings.level,
        base: { pid: process.pid, version: VERSION, channel: CHANNEL.name },
        redact: { paths: REDACTED_PATHS, censor: REDACTED },
        serializers: { err: pino.stdSerializers.errWithCause },
      },
      // The logger filters by its level; every destination takes what it lets through.
      pino.multistream(this.#destinations.map((stream) => ({ stream, level: LOG_LEVEL.trace }))),
    );
  }
}
