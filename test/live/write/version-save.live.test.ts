import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

/** Versions cannot be deleted from Test MCP's history (T-181, A§15.12): only with the switch. */
const VERSIONS = process.env.PIXELWRIGHT_LIVE_VERSIONS === "1";

describe("write/version_save", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    // The weekly support sentence off: answers stay exact, and the home's week is not spent by a test (T-006).
    client = await new LiveClient().connect({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("refuses a baseline the project does not keep, before anything is saved (T-180)", async () => {
    await expect(
      client.call("version_save", { file, title: "live test refused", baselines: ["live-no-such-baseline"] }),
    ).rejects.toThrow("No baseline named live-no-such-baseline");
  });

  it.skipIf(!VERSIONS)(
    "saves a named version, then refuses the same title in the file for ten minutes (T-180, T-181)",
    async () => {
      const title = `live test ${new Date().toISOString()}`;

      expect(await client.call("version_save", { file, title })).toMatchObject({
        id: expect.any(String),
        title,
        file: { name: "Test MCP" },
        baselines: [],
      });
      await expect(client.call("version_save", { file, title })).rejects.toThrow(
        `A version named ${title} was saved here`,
      );
    },
  );
});
