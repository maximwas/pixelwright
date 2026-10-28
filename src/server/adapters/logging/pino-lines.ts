import type { Logger as Pino } from "pino";
import type { LogFields, Logger } from "../../../core/ports/logger.port.ts";

/** The Logger port over one pino logger; a child is the same over pino's child, carrying its fields. */
export class PinoLines implements Logger {
  readonly #pino: Pino;

  constructor(pino: Pino) {
    this.#pino = pino;
  }

  trace(message: string, fields: LogFields = {}): void {
    this.#pino.trace(fields, message);
  }

  debug(message: string, fields: LogFields = {}): void {
    this.#pino.debug(fields, message);
  }

  info(message: string, fields: LogFields = {}): void {
    this.#pino.info(fields, message);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.#pino.warn(fields, message);
  }

  error(message: string, fields: LogFields = {}): void {
    this.#pino.error(fields, message);
  }

  child(fields: LogFields): Logger {
    return new PinoLines(this.#pino.child(fields));
  }
}
