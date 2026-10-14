import { watch } from "node:fs";
import { open, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { LOG_TAIL_LINES } from "../constants/logging.ts";
import { prettyLine } from "./pretty-line.ts";

/**
 * Prints the last lines of the shared log, then every line any pixelwright process appends, until the signal stops it
 * (Ctrl+C ends the command). A file that got shorter was set aside by a starting process: it is followed from its start.
 */
export async function followLog(file: string, print: (line: string) => void, signal?: AbortSignal): Promise<void> {
  let offset = 0;
  let pending = "";
  let reading = Promise.resolve();

  const readNew = async () => {
    const size = (await stat(file).catch(() => null))?.size ?? 0;

    if (size < offset) {
      offset = 0;
      pending = "";
    }

    if (size === offset) {
      return;
    }

    const handle = await open(file, "r");

    try {
      const buffer = Buffer.alloc(size - offset);

      await handle.read(buffer, 0, buffer.length, offset);
      offset = size;

      const lines = `${pending}${buffer.toString("utf8")}`.split("\n");

      pending = lines.pop() ?? "";

      for (const line of lines.filter((candidate) => candidate.trim() !== "")) {
        print(prettyLine(line));
      }
    } finally {
      await handle.close();
    }
  };

  const size = (await stat(file).catch(() => null))?.size ?? 0;

  offset = size;
  await printTail(file, size, print);
  print(`— following ${file} (Ctrl+C to stop) —`);

  const watcher = watch(dirname(file), (_event, changed) => {
    if (changed === null || changed === basename(file)) {
      reading = reading.then(readNew, readNew);
    }
  });

  await new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
    }

    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
  watcher.close();
  await reading;
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
