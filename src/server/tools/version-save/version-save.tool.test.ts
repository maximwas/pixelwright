import { describe, expect, it } from "vitest";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { VersionTries } from "@/server/app/stores/version-tries.ts";
import { VersionSaveTool } from "@/server/tools/version-save/version-save.tool.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

const NOW = Date.parse("2026-11-11T09:00:00.000Z");

/** A tool on a fake session: Figma answers with `saved` (or throws it), and `current` waits for `gate` if given. */
function build(saved: PixelwrightError | undefined, gate: Promise<void> = Promise.resolve()) {
  const stamped: unknown[] = [];
  const session = new PluginSession(
    "session-1",
    {
      request: async () => {
        if (saved !== undefined) {
          throw saved;
        }

        return { id: "12:3" };
      },
    } as never,
    [],
  );
  const tries = new VersionTries({ now: () => NOW });
  const baselines = {
    named: async () => [],
    target: () => ({ session, notes: [] }),
    current: async () => await gate,
    stamp: async (_baselines: unknown, version: unknown) => {
      stamped.push(version);

      return { names: [], notes: [] };
    },
  };
  const tool = new VersionSaveTool(baselines as never, { files: () => [] } as never, tries, {
    due: () => null,
  } as never);

  return { tool, tries, stamped };
}

// T-180, T-181: the try is noted before any wait, a timeout keeps it, a clear refusal forgets it.
describe("VersionSaveTool", () => {
  it("refuses a second call with the same title while the first still checks its baselines", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { tool } = build(undefined, gate);
    const first = tool.execute({ title: "Before launch" });
    const second = tool.execute({ title: "Before launch" });

    await expect(second).rejects.toThrow("Before launch");
    release();
    await expect(first).resolves.toBeDefined();
  });

  it("keeps the try after a timeout: the version may be saved", async () => {
    const { tool, tries } = build(new PixelwrightError(ERROR_CODE.timeout, "slow"));

    await expect(tool.execute({ title: "Before launch" })).rejects.toThrow("slow");
    expect(() => tries.check("session-1", "Before launch")).toThrow();
  });

  it("forgets the try after a refusal, so the same title can be sent again", async () => {
    const { tool, tries } = build(new PixelwrightError(ERROR_CODE.opFailed, "Figma said no"));

    await expect(tool.execute({ title: "Before launch" })).rejects.toThrow("Figma said no");
    expect(() => tries.check("session-1", "Before launch")).not.toThrow();
  });

  it("stamps the time the injected clock gives", async () => {
    const { tool, stamped } = build(undefined);

    await tool.execute({ title: "Before launch" });

    expect(stamped).toEqual([{ id: "12:3", title: "Before launch", savedAt: "2026-11-11T09:00:00.000Z" }]);
  });
});
