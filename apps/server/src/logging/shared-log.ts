import { closeSync, fstatSync, mkdirSync, openSync, renameSync, statSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { LOG_FILE_MAX_BYTES } from "../constants/logging.ts";

/**
 * The log every pixelwright process on this machine shares, as one of them writes it, line by line. A write that finds
 * the file past LOG_FILE_MAX_BYTES sets it aside as `.1` (replacing the previous one), whichever process writes then;
 * a process whose file another one set aside opens the new one. So every running server writes to the file
 * `pixelwright logs` follows, however long it runs.
 */
export class SharedLog {
  readonly #path: string;
  #fd: number;

  constructor(path: string, fd: number) {
    this.#path = path;
    this.#fd = fd;
  }

  /** The shared log opened for appending (its folder made, owner only); null when it cannot be: then stderr alone. */
  static open(path: string): SharedLog | null {
    try {
      mkdirSync(dirname(path), {
        recursive: true,
        mode: 0o700,
      });

      return new SharedLog(path, openSync(path, "a", 0o600));
    } catch {
      return null;
    }
  }

  /** pino's destination: a log that cannot be written is not the server's failure, so nothing is thrown. */
  write(line: string): boolean {
    try {
      this.#follow();
      writeSync(this.#fd, line);
    } catch {
      // The line goes to stderr all the same.
    }

    return true;
  }

  /** The file at the path, reopened when another process set it aside, and set aside when it grew past its size. */
  #follow(): void {
    const current = statSync(this.#path, { throwIfNoEntry: false });

    if (current === undefined || current.ino !== fstatSync(this.#fd).ino) {
      this.#reopen();
    } else if (current.size > LOG_FILE_MAX_BYTES) {
      this.#setAside();
    }
  }

  #setAside(): void {
    try {
      renameSync(this.#path, `${this.#path}.1`);
    } catch {
      // Another process set it aside first: its new file is the one to write to.
    }

    this.#reopen();
  }

  #reopen(): void {
    const fd = openSync(this.#path, "a", 0o600);

    closeSync(this.#fd);
    this.#fd = fd;
  }
}
