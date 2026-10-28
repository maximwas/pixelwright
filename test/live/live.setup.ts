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
 * The live run's global setup (A§10.5): the lock, then one server that waits for Test MCP and checks it is the visible
 * tab with Allow edits on. Until the peer bridge (item 07) the server closes after the checks, and each test file's
 * own server becomes the owner in turn.
 */
export default async function setup(project: TestProject): Promise<() => void> {
  const lock = new LiveLock();

  lock.acquire();

  try {
    const client = await new LiveClient().connect();

    try {
      const { file } = await client.waitForTestMcp();
      const problem = new LiveChecks().problem(file);

      if (problem !== null) {
        throw new Error(problem);
      }
    } finally {
      await client.close();
    }

    project.provide("live", {
      file: TEST_MCP.file,
      scratch: null,
    });
  } catch (error) {
    lock.release();

    throw error;
  }

  return () => lock.release();
}
