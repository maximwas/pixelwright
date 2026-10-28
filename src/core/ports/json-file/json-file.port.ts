import { InjectionToken } from "@needle-di/core";
import type * as zod from "zod/mini";

/** A JSON file of the server's home (bridge.json, the stores): read through a schema, written in one step. */
export interface JsonFile {
  /** The file as the schema reads it; the fallback when it is missing, not JSON or off the schema, never a throw. */
  read<Schema extends zod.ZodMiniType>(path: string, schema: Schema, fallback: zod.output<Schema>): zod.output<Schema>;
  /** Replaces the file at once, readable by the user only; throws when it cannot be written. */
  write(path: string, value: unknown): void;
  /** The file exists afterwards and only the user can read it: created with initial if absent, race-free. */
  ensure(path: string, initial: unknown): void;
}

export const JSON_FILE = new InjectionToken<JsonFile>("JsonFile");
