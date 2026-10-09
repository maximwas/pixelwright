import { describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { withAction } from "../src/view/recent-actions.ts";

describe("plugin operations", () => {
  it("answers ping and refuses an operation it does not have", async () => {
    await expect(runOperation("ping", null)).resolves.toEqual({ pong: true });
    await expect(runOperation("format_disk", null)).rejects.toMatchObject({ code: "UNKNOWN_OP" });
  });

  it("lists what the model asked for, not status probes", () => {
    const first = withAction([], "outline", 1);

    expect(first).toEqual([
      {
        op: "outline",
        at: 1,
      },
    ]);
    expect(withAction(first, "ping", 2)).toBe(first);
  });
});
