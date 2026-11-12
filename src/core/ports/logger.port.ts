import { InjectionToken } from "@needle-di/core";

/** Context of a log line: ids, sizes, counts, ms; never arguments, results, XML, texts or layer names (plan 3.2). */
export type LogFields = Readonly<Record<string, unknown>>;

/** The only way anything logs. A child carries its fields on every line it writes. */
export interface Logger {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export const LOGGER = new InjectionToken<Logger>("Logger");
