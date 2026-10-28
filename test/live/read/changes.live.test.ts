import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { until } from "../support/until.ts";

const NAME = "live:changes:rectangle";

/** A foreground tab hears of a change in well under a second; the journal is read again until it has. */
const CHANGE_WAIT_MS = 5_000;

interface Change {
  readonly id: string;
  readonly name: string;
  readonly change: string;
  readonly by: string;
  readonly page: string;
}

// It writes through execute, so no retry.
describe("read/changes", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists a layer execute made as pixelwright's, after the cursor it was asked from (T-035, D-53, A§15.9)", async () => {
    const { cursor } = await client.call("changes_since", { file });
    const made = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
const rectangle = figma.createRectangle();
rectangle.name = ${JSON.stringify(NAME)};
section.appendChild(rectangle);
return rectangle.id;`,
    });
    const change = await until(async () => {
      const { changes } = await client.call("changes_since", { file, cursor });

      return (changes as Change[]).find(({ id }) => id === made.result) ?? null;
    }, CHANGE_WAIT_MS);

    expect(change).toMatchObject({
      id: made.result,
      name: NAME,
      change: "created",
      by: "pixelwright",
      page: "Start here",
    });
  });
});
