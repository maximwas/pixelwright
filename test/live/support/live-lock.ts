import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** One live run on this machine at a time: Figma, Test MCP and the bridge port are shared. */
const LIVE_LOCK_PATH = join(homedir(), CHANNEL.home, "live-run.lock");

/**
 * The live-run lock: a file made with `wx`, so only one run creates it, holding the run's pid. A lock whose process is
 * gone (a run killed before its teardown) is stale and taken over.
 */
export class LiveLock {
  readonly #path: string;

  constructor(path = LIVE_LOCK_PATH) {
    this.#path = path;
  }

  acquire(): void {
    mkdirSync(dirname(this.#path), { recursive: true });

    try {
      this.#create();
    } catch {
      const holder = Number(readFileSync(this.#path, "utf8"));

      if (this.#alive(holder)) {
        throw new Error(
          `Another live run (pid ${holder}) holds ${this.#path}: wait for it to end, or delete the file if it is gone.`,
        );
      }

      rmSync(this.#path, { force: true });
      this.#create();
    }
  }

  release(): void {
    rmSync(this.#path, { force: true });
  }

  #create(): void {
    const descriptor = openSync(this.#path, "wx");

    writeSync(descriptor, String(process.pid));
    closeSync(descriptor);
  }

  /** Signal 0 only asks whether the process exists; EPERM means it does, under another user. */
  #alive(pid: number): boolean {
    try {
      process.kill(pid, 0);

      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }
}
