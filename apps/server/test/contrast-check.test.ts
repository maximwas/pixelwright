import { describe, expect, it } from "vitest";
import { checkContrast } from "../src/checks/contrast-check.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A selected card whose one text sits on its fill, as the plugin's ops answer. */
const card = {
  root: {
    id: "1:1",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    childCount: 1,
    fills: [
      {
        type: "SOLID",
        visible: true,
        color: {
          r: 0,
          g: 0,
          b: 0,
        },
      },
    ],
    children: [
      {
        id: "1:2",
        name: "Label",
        type: "TEXT",
        visible: true,
        x: 10,
        y: 10,
        width: 80,
        height: 20,
        childCount: 0,
        text: {
          characters: "Hello",
          textAutoResize: "WIDTH_AND_HEIGHT",
          textAlignHorizontal: "LEFT",
          textAlignVertical: "TOP",
          segments: [
            {
              characters: "Hello",
              start: 0,
              end: 5,
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
              fillStyleId: "",
              textStyleId: "",
            },
          ],
        },
      },
    ],
  },
  styles: {},
  variables: {},
};

describe("contrast_check", () => {
  it("checks the selected layer's texts when no node is named", async () => {
    const asked: string[] = [];
    const bridge: BridgeView = {
      status: () => {
        throw new Error("not used");
      },
      pairing: () => null,
      plugins: () => [
        {
          session: "s1",
          info: pluginInfo(),
          active: true,
        },
      ],
      request: async (op) => {
        asked.push(op);

        return op === "selection"
          ? {
              nodes: [
                {
                  id: "1:1",
                  name: "Card",
                  type: "FRAME",
                  box: null,
                },
              ],
            }
          : card;
      },
    };

    await expect(checkContrast(bridge, {})).resolves.toMatchObject({
      summary: "1 texts: 0 below AA.",
      texts: [
        {
          name: "Label",
          ratio: 21,
          aaa: true,
        },
      ],
    });
    expect(asked).toEqual(["selection", "snapshot"]);
  });
});
