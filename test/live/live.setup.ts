import type { TestProject } from "vitest/node";
import { LiveChecks } from "./support/live-checks.ts";
import { LiveClient } from "./support/live-client.ts";
import { LiveLock } from "./support/live-lock.ts";
import { TEST_MCP } from "./support/test-mcp.ids.ts";

/** What every live test file gets: the file to name, and the scratch Section once a write tool can make it. */
export interface LiveContext {
  readonly file: string;
  readonly scratch: string | null;
}

declare module "vitest" {
  export interface ProvidedContext {
    live: LiveContext;
  }
}

/**
 * The live run's global setup (A§10.5): the lock, then one server that owns the bridge for the whole run, so the
 * plugin stays connected; it waits for Test MCP and checks it is the visible tab with Allow edits on. Each test file's
 * own server joins it as a peer (R-036). Teardown stops it and frees the lock.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const lock = new LiveLock();

  lock.acquire();

  try {
    const owner = await new LiveClient().connect();

    try {
      const { status, file } = await owner.waitForTestMcp();
      const problem =
        (status.server as { role: string }).role === "owner"
          ? new LiveChecks().problem(file)
          : "Another Pixelwright New server owns the bridge: close the other MCP client sessions of this checkout and run again.";

      if (problem !== null) {
        throw new Error(problem);
      }
    } catch (error) {
      await owner.close();

      throw error;
    }

    project.provide("live", { file: TEST_MCP.file, scratch: null });

    return async () => {
      await owner.close();
      lock.release();
    };
  } catch (error) {
    lock.release();

    throw error;
  }
}
