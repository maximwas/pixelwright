import { mkdirSync, unwatchFile, watch, watchFile } from "node:fs";
import { open, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { LOG_POLL_MS, LOG_TAIL_LINES } from "../constants/logging.ts";
import { prettyLine } from "./pretty-line.ts";

/**
 * Prints the last lines of the shared log, then every line any pixelwright process appends, until the signal stops it
 * (Ctrl+C ends the command). A file that got shorter was set aside by a writing process: it is followed from its start.
 */
export async function followLog(file: string, print: (line: string) => void, signal?: AbortSignal): Promise<void> {
  await new LogFollower(file, print).follow(signal);
}

/** One follow of the shared log: how far it has read, the start of a line not ended yet, and the read in flight. */
class LogFollower {
  readonly #file: string;
  readonly #print: (line: string) => void;
  #offset = 0;
  #partial = "";
  #reading: Promise<void> = Promise.resolve();

  constructor(file: string, print: (line: string) => void) {
    this.#file = file;
    this.#print = print;
  }

  async follow(signal?: AbortSignal): Promise<void> {
    const file = this.#file;

    // A machine whose servers have not written yet has no logs folder: made here, so it can be watched.
    mkdirSync(dirname(file), {
      recursive: true,
      mode: 0o700,
    });

    this.#offset = await sizeOf(file);
    await printTail(file, this.#offset, this.#print);
    this.#print(`— following ${file} (Ctrl+C to stop) —`);

    const read = () => {
      this.#reading = this.#reading.then(
        () => this.#readNew(),
        () => this.#readNew(),
      );
    };
    // The folder watch sees a file set aside or made anew at once; the poll sees lines written through an open file.
    const watcher = watch(dirname(file), (_event, changed) => {
      if (changed === null || changed === basename(file)) {
        read();
      }
    });

    watchFile(file, { interval: LOG_POLL_MS }, read);
    await stopped(signal);
    watcher.close();
    unwatchFile(file, read);
    await this.#reading;
  }

  async #readNew(): Promise<void> {
    const size = await sizeOf(this.#file);

    if (size < this.#offset) {
      this.#offset = 0;
      this.#partial = "";
    }

    if (size === this.#offset) {
      return;
    }

    const handle = await open(this.#file, "r");

    try {
      const buffer = Buffer.alloc(size - this.#offset);

      await handle.read(buffer, 0, buffer.length, this.#offset);
      this.#offset = size;

      const lines = `${this.#partial}${buffer.toString("utf8")}`.split("\n");

      this.#partial = lines.pop() ?? "";

      for (const line of lines.filter((candidate) => candidate.trim() !== "")) {
        this.#print(prettyLine(line));
      }
    } finally {
      await handle.close();
    }
  }
}

async function sizeOf(file: string): Promise<number> {
  return (await stat(file).catch(() => null))?.size ?? 0;
}

/** Resolves when the signal stops the follow: at once when it already has. */
function stopped(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
    }

    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
}

async function printTail(file: string, size: number, print: (line: string) => void): Promise<void> {
  if (size === 0) {
    return;
  }

  const handle = await open(file, "r");

  try {
    const length = Math.min(size, 256 * 1024);
    const buffer = Buffer.alloc(length);

    await handle.read(buffer, 0, length, size - length);

    for (const line of buffer
      .toString("utf8")
      .split("\n")
      .filter((candidate) => candidate.trim() !== "")
      .slice(-LOG_TAIL_LINES)) {
      print(prettyLine(line));
    }
  } finally {
    await handle.close();
  }
}
