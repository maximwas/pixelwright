import { afterEach, describe, expect, it, vi } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

describe("save_version", () => {
  it("saves a named version in the file's history, and only with Allow edits on", async () => {
    const { figma } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
      }),
    );
    const saved: string[] = [];

    Object.assign(figma, {
      saveVersionHistoryAsync: async (title: string) => {
        saved.push(title);

        return { id: "v-42" };
      },
    });

    plugin.services.edits.allow(false);
    await expect(plugin.run("save_version", { title: "Before hero" })).rejects.toMatchObject({
      code: "EDITS_DISABLED",
    });
    expect(saved).toEqual([]);

    plugin.services.edits.allow(true);
    expect(await plugin.run("save_version", { title: "Before hero" })).toEqual({ id: "v-42" });
    expect(saved).toEqual(["Before hero"]);
    plugin.services.edits.allow(false);
  });

  it("passes the description on to Figma and gives it back", async () => {
    const { figma } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
      }),
    );
    const saved: unknown[][] = [];

    Object.assign(figma, {
      saveVersionHistoryAsync: async (...args: unknown[]) => {
        saved.push(args);

        return { id: "v-43" };
      },
    });
    plugin.services.edits.allow(true);

    expect(
      await plugin.run("save_version", {
        title: "Built: pricing",
        description: "Saved by Pixelwright.",
      }),
    ).toEqual({
      id: "v-43",
      description: "Saved by Pixelwright.",
    });
    expect(saved).toEqual([["Built: pricing", "Saved by Pixelwright."]]);
    plugin.services.edits.allow(false);
  });

  it("waits until Pixelwright's last write has settled before it saves, and not when there was none", async () => {
    vi.useFakeTimers();

    const { figma } = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
      }),
    );
    const savedAt: number[] = [];

    Object.assign(figma, {
      saveVersionHistoryAsync: async () => {
        savedAt.push(Date.now());

        return { id: "v-44" };
      },
    });
    plugin.services.edits.allow(true);

    const start = Date.now();

    await plugin.run("save_version", { title: "Nothing written" });
    plugin.services.journal.noteOwnWrite();

    const waiting = plugin.run("save_version", { title: "Right after a write" });

    await vi.advanceTimersByTimeAsync(1_100);
    await waiting;

    expect(savedAt[0]).toBe(start);
    expect((savedAt[1] ?? 0) - start).toBeGreaterThanOrEqual(1_000);
    plugin.services.edits.allow(false);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
