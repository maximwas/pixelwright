import type { TestProject } from "vitest/node";
import { LiveCleanup } from "./support/cleanup.ts";
import { LiveChecks } from "./support/live-checks.ts";
import { LiveClient } from "./support/live-client.ts";
import { LiveLock } from "./support/live-lock.ts";
import { TEST_MCP } from "./support/test-mcp.ids.ts";

/** What every live test file gets: the file to name, and the id of the scratch Section its layers go in. */
export interface LiveContext {
  readonly file: string;
  readonly scratch: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    live: LiveContext;
  }
}

/**
 * The live run's global setup (A§10.5): the lock, then one server that owns the bridge for the whole run, so the
 * plugin stays connected; it waits for Test MCP, checks it is the visible tab with Allow edits on, and makes the
 * "Live tests" Section on "Start here". Each test file's own server joins it as a peer (R-036). Teardown removes every
 * `live:` layer, stops the server and frees the lock.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const lock = new LiveLock();

  lock.acquire();

  try {
    const owner = await new LiveClient().connect();

    const cleanup = new LiveCleanup(owner);
    let scratch: string;

    try {
      const { status, file } = await owner.waitForTestMcp();
      const problem =
        (status.server as { role: string }).role === "owner"
          ? new LiveChecks().problem(file)
          : "Another Pixelwright New server owns the bridge: close the other MCP client sessions of this checkout and run again.";

      if (problem !== null) {
        throw new Error(problem);
      }

      scratch = await cleanup.scratch();
    } catch (error) {
      await owner.close();

      throw error;
    }

    project.provide("live", { file: TEST_MCP.file, scratch });

    return async () => {
      try {
        await cleanup.sweep();
      } finally {
        await owner.close();
        lock.release();
      }
    };
  } catch (error) {
    lock.release();

    throw error;
  }
}
