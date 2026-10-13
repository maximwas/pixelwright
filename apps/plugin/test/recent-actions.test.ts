import { describe, expect, it } from "vitest";
import { RECENT_ACTIONS } from "../src/constants/plugin.ts";
import type { RequestOutcome } from "../src/types/link.ts";
import { describeAction, withAction } from "../src/view/recent-actions.ts";

const ok = (result: unknown): RequestOutcome => ({
  ok: true,
  result,
});
const failed = (code: string): RequestOutcome => ({
  ok: false,
  error: {
    code,
    message: "it failed",
  },
});
const text = (op: string, input: unknown, outcome: RequestOutcome) => describeAction(op, input, outcome)?.text;

describe("the window's activity", () => {
  it("names what was read in plain words", () => {
    expect(
      [
        ["snapshot", {}],
        ["outline", {}],
        ["export", { offset: 0 }],
        ["image", { offset: 0 }],
        ["components", {}],
        ["variables", {}],
        ["find", {}],
        ["selection", {}],
        ["show", {}],
        ["inspect", {}],
      ].map(([op, input]) => text(op as string, input, ok({}))),
    ).toEqual([
      "Read a design",
      "Read the page outline",
      "Exported an image",
      "Exported an image",
      "Read components",
      "Read styles and variables",
      "Searched layers",
      "Read the selection",
      "Showed a layer",
      "Inspected layers",
    ]);
  });

  it("leaves out the steps of another action: probes, reads before a write, file chunks", () => {
    expect(
      [
        ["ping", {}],
        ["entries", {}],
        ["upload", { offset: 0 }],
        ["export", { offset: 2_097_152 }],
        ["image", { offset: 2_097_152 }],
      ].map(([op, input]) => describeAction(op as string, input, ok({}))),
    ).toEqual([null, null, null, null, null]);
  });

  it("says what a write did, from its answer", () => {
    const applied = (created: number, changed: number, errors = 0, dryRun = false) =>
      text(
        "apply",
        { dryRun },
        ok({
          created: Array.from({ length: created }, (_, index) => ({ id: `1:${index}` })),
          changed: Array.from({ length: changed }, (_, index) => `2:${index}`),
          errors: Array.from({ length: errors }, () => ({
            line: 1,
            column: 1,
            message: "x",
          })),
        }),
      );

    expect(applied(3, 2)).toBe("Made 3 layers, changed 2");
    expect(applied(1, 0)).toBe("Made 1 layer");
    expect(applied(0, 1)).toBe("Changed 1 layer");
    expect(applied(0, 0)).toBe("Changed nothing");
    expect(applied(1, 0, 2)).toBe("Made 1 layer (2 errors)");
    expect(applied(0, 0, 0, true)).toBe("Checked a change");
    expect(applied(0, 0, 1, true)).toBe("Checked a change (1 error)");
    expect(
      text(
        "delete",
        {},
        ok({
          deleted: ["1:1", "1:2"],
          errors: [],
        }),
      ),
    ).toBe("Deleted 2 layers");
    expect(
      text(
        "execute",
        {},
        ok({
          result: 1,
          logs: [],
        }),
      ),
    ).toBe("Ran code");
    expect(
      text(
        "tokens_apply",
        { dryRun: false },
        ok({
          created: [
            {
              kind: "variable",
              name: "a",
            },
            {
              kind: "paint",
              name: "b",
            },
          ],
          updated: [
            {
              kind: "variable",
              name: "c",
            },
          ],
          errors: [],
        }),
      ),
    ).toBe("Made 2 tokens, changed 1");
    expect(
      text(
        "tokens_apply",
        { dryRun: true },
        ok({
          created: [],
          updated: [],
          errors: [],
        }),
      ),
    ).toBe("Checked tokens");
    expect(
      describeAction(
        "execute",
        {},
        ok({
          result: null,
          logs: [],
          error: "Error: boom",
        }),
      ),
    ).toEqual({
      text: "Ran code — failed",
      warning: true,
      refused: false,
    });
  });

  it("marks a write refused while Allow edits is off, and a request that failed", () => {
    expect(describeAction("apply", {}, failed("EDITS_DISABLED"))).toEqual({
      text: "Edit refused: Allow edits is off",
      warning: true,
      refused: true,
    });
    expect(describeAction("snapshot", {}, failed("NODE_NOT_FOUND"))).toEqual({
      text: "Read a design — failed",
      warning: true,
      refused: false,
    });
    expect(text("something_new", {}, ok({}))).toBe("something_new");
  });

  it("keeps the newest first, as many as the window shows", () => {
    const actions = Array.from({ length: RECENT_ACTIONS + 2 }, (_, index) => index).reduce(
      (list, index) =>
        withAction(list, {
          text: `Action ${index}`,
          at: index,
          warning: false,
        }),
      withAction([], {
        text: "First",
        at: 0,
        warning: false,
      }),
    );

    expect(actions).toHaveLength(RECENT_ACTIONS);
    expect(actions[0]?.text).toBe(`Action ${RECENT_ACTIONS + 1}`);
  });
});
