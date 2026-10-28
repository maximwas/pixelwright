import { randomUUID } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inject, injectable } from "@needle-di/core";
import { writeFileSync as writeAtomically } from "atomically";
import * as zod from "zod/mini";
import type { JsonFile } from "../../../../core/ports/json-file/json-file.port.ts";
import { LOGGER } from "../../../../core/ports/logger/logger.port.ts";

/**
 * JSON files of the home folder, private to the user (folder 0700, file 0600). A read never throws: a missing file is
 * the fallback quietly, a broken one the fallback with a warning that names the schema's issues but never the content,
 * which may hold a token or keys. A write replaces the file in one rename (atomically), so no reader sees half of it.
 */
@injectable()
export class AtomicJsonFile implements JsonFile {
  readonly #logger;
  /** zod/mini carries no messages of its own: English ones name what was expected, never the value found. */
  readonly #messages = zod.locales.en().localeError;

  constructor(logger = inject(LOGGER)) {
    this.#logger = logger;
  }

  read<Schema extends zod.ZodMiniType>(
    path: string,
    schema: Schema,
    fallback: zod.output<Schema>,
  ): zod.output<Schema> {
    const json = this.#json(path);

    if (json === undefined) {
      return fallback;
    }

    const parsed = zod.safeParse(schema, json, { error: this.#messages });

    if (parsed.success) {
      return parsed.data;
    }

    this.#logger.warn("file does not match its schema: read as the default", {
      component: "server",
      file: path,
      issues: parsed.error.issues.map(({ path: at, message }) => `${at.join(".") || "(top)"}: ${message}`),
    });

    return fallback;
  }

  write(
    path: string,
    value: unknown,
  ): void {
    this.#writing(path, () => writeAtomically(path, this.#text(value), { mode: 0o600 }));
  }

  ensure(
    path: string,
    initial: unknown,
  ): void {
    this.#writing(path, () => {
      // link(2) of a private temp file is an atomic "create if absent": two servers starting at once agree on one file.
      const temp = `${path}.${randomUUID()}.tmp`;

      writeFileSync(temp, this.#text(initial), {
        mode: 0o600,
        flag: "wx",
      });

      try {
        linkSync(temp, path);
      } catch (error) {
        if (this.#code(error) !== "EEXIST") {
          throw error;
        }

        this.#tighten(path);
      } finally {
        unlinkSync(temp);
      }
    });
  }

  /** The file's JSON; undefined when it is missing or unreadable, or not JSON. */
  #json(path: string): unknown {
    let text: string;

    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      if (this.#code(error) !== "ENOENT") {
        this.#unreadable(path, this.#code(error));
      }

      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      // JSON.parse's message quotes the text around the error: never logged.
      this.#unreadable(path, "not JSON");

      return undefined;
    }
  }

  /** Runs a write in the file's folder, made for the user only; a failure is logged with its code, then thrown. */
  #writing(
    path: string,
    write: () => void,
  ): void {
    try {
      mkdirSync(dirname(path), {
        recursive: true,
        mode: 0o700,
      });
      write();
    } catch (error) {
      this.#logger.warn("file could not be written", {
        component: "server",
        file: path,
        reason: this.#code(error),
      });

      throw error;
    }
  }

  /** A file someone opened to others is made the user's alone again. */
  #tighten(path: string): void {
    if ((statSync(path).mode & 0o077) !== 0) {
      chmodSync(path, 0o600);
    }
  }

  #unreadable(
    path: string,
    reason: string,
  ): void {
    this.#logger.warn("file could not be read: read as the default", {
      component: "server",
      file: path,
      reason,
    });
  }

  #text(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  #code(error: unknown): string {
    return error instanceof Error && "code" in error ? String(error.code) : "unknown";
  }
}
