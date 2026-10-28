import { closeSync, fstatSync, mkdirSync, openSync, renameSync, statSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { inject, injectable } from "@needle-di/core";
import type { DestinationStream } from "pino";
import { LOG_SETTINGS } from "./logging.tokens.ts";
import { LOG_FILE_MAX_BYTES } from "./shared-log-file.constants.ts";

/**
 * The log every server of this channel shares, written line by line (S-065). A write that finds the file past 5 MiB
 * sets it aside as `.1`, whichever process writes then; a process whose file another one set aside opens the new one.
 * No rotation library does this across processes: pino-roll and rotating-file-stream rotate inside one process.
 */
@injectable()
export class SharedLogFile implements DestinationStream {
  readonly #path: string;
  /** undefined until the first line opens the file; null when it could not be opened. */
  #fd: number | null | undefined;
  /** The full file could not be set aside: written on, tried again once it changes. */
  #stuck = false;

  constructor(settings = inject(LOG_SETTINGS)) {
    this.#path = settings.file;
  }

  /** pino's destination: a log that cannot be written is not the server's failure, so nothing is thrown. */
  write(line: string): boolean {
    try {
      this.#fd ??= this.#open();
      this.#follow();

      if (typeof this.#fd === "number") {
        writeSync(this.#fd, line);
      }
    } catch {
      // The line is on stderr all the same.
    }

    return true;
  }

  /** The file at the path, reopened when another process set it aside, set aside when it grew past its size. */
  #follow(): void {
    if (typeof this.#fd !== "number") {
      return;
    }

    const current = statSync(this.#path, { throwIfNoEntry: false });

    if (current === undefined || current.ino !== fstatSync(this.#fd).ino) {
      this.#reopen();
    } else if (current.size > LOG_FILE_MAX_BYTES && !this.#stuck) {
      this.#setAside();
    }
  }

  #setAside(): void {
    try {
      renameSync(this.#path, `${this.#path}.1`);
    } catch (error) {
      // Another process set it aside first: its new file is the one to write to. Any other refusal leaves the file
      // where it is, written on, and not tried on every line.
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        this.#stuck = true;

        return;
      }
    }

    this.#reopen();
  }

  #reopen(): void {
    const fd = this.#open();

    if (fd !== null && typeof this.#fd === "number") {
      closeSync(this.#fd);
      this.#fd = fd;
      this.#stuck = false;
    }
  }

  /** The file opened for appending, its folder made, both for the owner only; null when it cannot be. */
  #open(): number | null {
    try {
      mkdirSync(dirname(this.#path), {
        recursive: true,
        mode: 0o700,
      });

      return openSync(this.#path, "a", 0o600);
    } catch {
      return null;
    }
  }
}
