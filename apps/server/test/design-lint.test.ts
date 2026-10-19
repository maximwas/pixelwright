import { BridgeError } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { lintDesign } from "../src/features/design-lint/lint-design.ts";
import { DesignLintInputSchema } from "../src/features/design-lint/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { scopeBridge } from "./helpers/scope-bridge.ts";

/** A frame left with Figma's default name, filled with a style, read as its own snapshot. */
const snapshotOf = (input: unknown) => {
  const { node } = input as { node: string };

  return {
    root: {
      id: node,
      name: `Frame ${node.replace(":", "")}`,
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      childCount: 0,
      fillStyleId: "S:paper",
      fills: [
        {
          type: "SOLID",
          visible: true,
          color: {
            r: 1,
            g: 1,
            b: 1,
          },
        },
      ],
    },
    styles: {},
    variables: {},
  };
};

const WHITE = [
  {
    type: "SOLID",
    visible: true,
    color: {
      r: 1,
      g: 1,
      b: 1,
    },
  },
];

/** A white label in a frame of no fill (1:1), on a white screen the plugin reads above it when asked for ancestors. */
const screenPart = (input: unknown) => {
  const box = {
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };
  const content = {
    ...box,
    id: "1:1",
    name: "Content",
    type: "FRAME",
    childCount: 1,
    fills: [],
  };
  const characters = "Hello";
  const label = {
    ...box,
    id: "1:2",
    name: "Label",
    type: "TEXT",
    childCount: 0,
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [
        {
          characters,
          start: 0,
          end: characters.length,
          fontName: {
            family: "Inter",
            style: "Regular",
          },
          fontSize: 16,
          fontWeight: 400,
          textDecoration: "NONE",
          textCase: "ORIGINAL",
          lineHeight: { unit: "AUTO" },
          letterSpacing: {
            unit: "PIXELS",
            value: 0,
          },
          fills: WHITE,
          fillStyleId: "",
          textStyleId: "",
        },
      ],
    },
  };
  const screen = {
    ...box,
    id: "1:0",
    name: "Screen",
    type: "FRAME",
    childCount: 1,
    fills: WHITE,
    children: [content],
  };

  return {
    root: {
      ...content,
      children: [label],
    },
    ...((input as { ancestors?: boolean }).ancestors ? { ancestors: [screen] } : {}),
    styles: {},
    variables: {},
  };
};

const ANSWERS = {
  snapshot: snapshotOf,
  bind: () => {
    throw new BridgeError("UNKNOWN_OP", "Unknown operation: bind");
  },
  components: {
    components: [],
    more: false,
  },
};

const lint = (view: ReturnType<typeof scopeBridge>, within?: string | string[]) =>
  lintDesign(new PluginClient(view.bridge), {
    ...(within === undefined ? {} : { within }),
    severity: "info",
    limit: 100,
  });

describe("design_lint: what it reads", () => {
  it("lints the current page's top layers when nothing is selected, each read on its own", async () => {
    const view = scopeBridge({
      selection: [],
      pages: [
        {
          id: "0:1",
          name: "Pricing",
          nodes: [
            {
              id: "1:1",
              name: "Desktop",
            },
            {
              id: "1:2",
              name: "Mobile",
            },
          ],
        },
      ],
      answers: ANSWERS,
    });
    const result = await lint(view);

    expect(view.asked).toEqual([
      "selection",
      "file_map",
      "file_map",
      "snapshot",
      "snapshot",
      "bind (dry run)",
      "components",
    ]);
    expect(result.summary).toBe("2 findings in page Pricing: 0 errors, 0 warnings, 2 info.");
    expect(result.findings.map(({ rule, id }) => `${rule} ${id}`)).toEqual(["default-name 1:1", "default-name 1:2"]);
  });

  it("lints a list of frames each on its own, in one call", async () => {
    const view = scopeBridge({
      selection: [],
      answers: ANSWERS,
    });
    const result = await lint(view, ["1:1", "1:2"]);

    expect(view.asked).toEqual(["snapshot", "snapshot", "bind (dry run)", "components", "components"]);
    expect(result.summary).toBe("2 findings in 1:1, 1:2: 0 errors, 0 warnings, 2 info.");
    expect(result.findings.map(({ id }) => id)).toEqual(["1:1", "1:2"]);
    expect(DesignLintInputSchema.safeParse({ within: Array.from({ length: 31 }, (_, i) => `1:${i}`) }).success).toBe(
      false,
    );
  });

  it("still lints with a plugin older than tokens_bind, naming the tool in the fixes", async () => {
    const view = scopeBridge({
      selection: ["1:1"],
      answers: ANSWERS,
    });
    const result = await lint(view);

    expect(result.notes).toEqual([]);
    expect(result.findings.map(({ rule }) => rule)).toEqual(["default-name"]);
  });

  it("names a layer it could not read, and lints the rest", async () => {
    const view = scopeBridge({
      selection: ["1:1", "9:9"],
      answers: {
        ...ANSWERS,
        snapshot: (input: unknown) => {
          if ((input as { node: string }).node === "9:9") {
            throw new BridgeError("NODE_NOT_FOUND", "No node 9:9 in this file.");
          }

          return snapshotOf(input);
        },
      },
    });
    const result = await lint(view);

    expect(result.notes).toEqual(["9:9 was not read: No node 9:9 in this file."]);
    expect(result.summary).toBe(
      "Not checked: 1 of 2 layers could not be read (the notes say why). 1 findings in the rest: 0 errors, 0 warnings, 1 info.",
    );
    expect(result.findings.map(({ id }) => id)).toEqual(["1:1"]);
  });

  it("asks tokens_bind only about the layers it read, so one missing id in a list keeps the others' token hints", async () => {
    const view = scopeBridge({
      selection: [],
      answers: {
        ...ANSWERS,
        snapshot: (input: unknown) => {
          if ((input as { node: string }).node === "9:9") {
            throw new BridgeError("NODE_NOT_FOUND", "No node 9:9 in this file.");
          }

          return snapshotOf(input);
        },
        // As the plugin's bind: one root it cannot find fails the whole call.
        bind: ({ roots }: { roots: string[] }) => {
          if (roots.includes("9:9")) {
            throw new BridgeError("NODE_NOT_FOUND", "No node 9:9 in this file.");
          }

          return {
            bound: [],
            ambiguous: [],
            unmatched: [],
            remapped: [],
            layers: 0,
            errors: [],
            notes: [],
            more: false,
          };
        },
      },
    });
    const result = await lint(view, ["1:1", "9:9"]);

    expect(view.inputs.bind).toMatchObject({ roots: ["1:1"] });
    expect(result.notes).toEqual(["9:9 was not read: No node 9:9 in this file."]);
  });

  it("rates a part of a screen's texts against the screen's fill above it", async () => {
    const view = scopeBridge({
      selection: [],
      answers: {
        ...ANSWERS,
        snapshot: screenPart,
      },
    });
    const result = await lint(view, "1:1");

    expect(result.findings.filter(({ rule }) => rule === "contrast")).toMatchObject([
      {
        id: "1:2",
        severity: "error",
      },
    ]);
    expect(view.inputs.snapshot).toMatchObject({ ancestors: true });
  });

  it("fails, never answering no findings, when it could read none of the layers", async () => {
    const view = scopeBridge({
      selection: [],
      answers: {
        ...ANSWERS,
        snapshot: () => {
          throw new BridgeError("OP_FAILED", "Attempted to invoke callback with invalid id -32605");
        },
      },
    });

    await expect(lint(view, "3:603")).rejects.toMatchObject({
      code: "OP_FAILED",
      message: "3:603 was not read: Attempted to invoke callback with invalid id -32605",
    });
  });
});
