import { type FileHandle, open } from "node:fs/promises";
import { inject, injectable } from "@needle-di/core";
import { prettyFactory } from "pino-pretty";
import { LOG_POLL_MS, LOG_READ, LOG_TAIL, LOGS_TEXT, PRETTY_OPTIONS } from "@/cli/logs/logs.constants.ts";
import { COMMAND, EXIT_CODE } from "@/cli/main/cli.constants.ts";
import { CLI_STREAMS, LOGS_SETTINGS } from "@/cli/main/cli.tokens.ts";
import type { CliCommand } from "@/cli/main/cli.types.ts";
import { SHARED_LOG_FILE } from "@/server/adapters/logging/logging.constants.ts";

/**
 * `pixelwright logs` (S-065): the last lines of the shared log every server writes, then each line any of them
 * appends, until Ctrl+C. The file is polled (B-062). When a server sets it aside as .1 past 5 MiB (SharedLogFile does
 * the rotation), the rest of the old file is read from .1 first, then the new file from its start; a file that got
 * shorter is read again from its start.
 */
@injectable()
export class LogFollower implements CliCommand {
  readonly name = COMMAND.logs;
  readonly #settings;
  readonly #streams;
  #inode: number | null = null;
  #offset = 0;
  #partial = "";

  constructor(settings = inject(LOGS_SETTINGS), streams = inject(CLI_STREAMS)) {
    this.#settings = settings;
    this.#streams = streams;
  }

  /** Follows until Ctrl+C ends the process. */
  async run(): Promise<number> {
    await this.follow();

    return EXIT_CODE.ok;
  }

  /** Prints the tail, then what is appended, until `signal` stops it; without one, for as long as the process runs. */
  async follow(signal?: AbortSignal): Promise<void> {
    const pretty = prettyFactory({ ...PRETTY_OPTIONS, colorize: this.#streams.stdout.isTTY ?? false });
    const print = (line: string) => this.#print(pretty(line));
    let reading = this.#tail(print);

    await reading;
    this.#print(LOGS_TEXT.following(this.#settings.file));

    // Reads one after another: a slow read never overlaps the next poll.
    const timer = setInterval(() => {
      reading = reading.then(() => this.#readNew(print)).catch(() => undefined);
    }, LOG_POLL_MS);

    await new Promise<void>((resolve) => {
      signal?.addEventListener(LOG_READ.abort, () => resolve(), { once: true });
    });
    clearInterval(timer);
    await reading;
  }

  /** The file's last lines; where reading goes on from. */
  async #tail(print: (line: string) => void): Promise<void> {
    const handle = await open(this.#settings.file, LOG_READ.flag).catch(() => null);

    if (handle === null) {
      return;
    }

    try {
      const { ino, size } = await handle.stat();
      const length = Math.min(size, LOG_TAIL.bytes);
      const { buffer } = await handle.read(Buffer.alloc(length), 0, length, size - length);

      this.#inode = ino;
      this.#offset = size;
      this.#lines(buffer.toString(LOG_READ.encoding)).slice(-LOG_TAIL.lines).forEach(print);
    } finally {
      await handle.close();
    }
  }

  /** What the file gained since the last read; the size and inode come from the open file, so a rename between counts. */
  async #readNew(print: (line: string) => void): Promise<void> {
    const handle = await open(this.#settings.file, LOG_READ.flag).catch(() => null);

    if (handle === null) {
      return;
    }

    try {
      const { ino, size } = await handle.stat();

      if (ino !== this.#inode) {
        await this.#drainSetAside(print);
        this.#inode = ino;
        this.#offset = 0;
        this.#partial = "";
      } else if (size < this.#offset) {
        this.#offset = 0;
        this.#partial = "";
      }

      await this.#readFrom(handle, size, print);
    } finally {
      await handle.close();
    }
  }

  /** The old file's lines written since the last read: .1 is that file when its inode is the one being followed. */
  async #drainSetAside(print: (line: string) => void): Promise<void> {
    const handle =
      this.#inode === null
        ? null
        : await open(SHARED_LOG_FILE.setAside(this.#settings.file), LOG_READ.flag).catch(() => null);

    if (handle === null) {
      return;
    }

    try {
      const { ino, size } = await handle.stat();

      if (ino === this.#inode) {
        await this.#readFrom(handle, size, print);
      }
    } finally {
      await handle.close();
    }
  }

  async #readFrom(
    handle: FileHandle,
    size: number,
    print: (line: string) => void,
  ): Promise<void> {
    if (size <= this.#offset) {
      return;
    }

    const length = size - this.#offset;
    const { buffer } = await handle.read(Buffer.alloc(length), 0, length, this.#offset);
    const lines = (this.#partial + buffer.toString(LOG_READ.encoding)).split(LOG_READ.newline);

    this.#offset = size;
    this.#partial = lines.pop() ?? "";
    this.#lines(lines.join(LOG_READ.newline)).forEach(print);
  }

  #lines(text: string): string[] {
    return text.split(LOG_READ.newline).filter((line) => line.trim() !== "");
  }

  #print(text: string): void {
    this.#streams.stdout.write(text.trimEnd() + LOG_READ.newline);
  }
}
