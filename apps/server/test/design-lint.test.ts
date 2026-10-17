import { BridgeError } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { lintDesign } from "../src/features/design-lint/lint-design.ts";
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

const lint = (view: ReturnType<typeof scopeBridge>, within?: string) =>
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
    expect(result.findings.map(({ id }) => id)).toEqual(["1:1"]);
  });
});
