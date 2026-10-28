import type { Logger as Pino } from "pino";
import type { LogFields, Logger } from "@/core/ports/logger/logger.port.ts";

/**
 * The Logger port over one pino logger; a child is the same over pino's child, carrying its fields. The pino logger is
 * built at the first line, not with the object: a constructor only stores what it is given.
 */
export class PinoLines implements Logger {
  readonly #create: () => Pino;
  #pino: Pino | undefined;

  constructor(create: () => Pino) {
    this.#create = create;
  }

  trace(
    message: string,
    fields: LogFields = {},
  ): void {
    this.#logger().trace(fields, message);
  }

  debug(
    message: string,
    fields: LogFields = {},
  ): void {
    this.#logger().debug(fields, message);
  }

  info(
    message: string,
    fields: LogFields = {},
  ): void {
    this.#logger().info(fields, message);
  }

  warn(
    message: string,
    fields: LogFields = {},
  ): void {
    this.#logger().warn(fields, message);
  }

  error(
    message: string,
    fields: LogFields = {},
  ): void {
    this.#logger().error(fields, message);
  }

  child(fields: LogFields): Logger {
    return new PinoLines(() => this.#logger().child(fields));
  }

  #logger(): Pino {
    this.#pino ??= this.#create();

    return this.#pino;
  }
}
