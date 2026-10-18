import { readFileSync } from "node:fs";
import { SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { compareStyles } from "../src/features/styles-compare/compare-styles.ts";
import { StylesCompareInputSchema } from "../src/features/styles-compare/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { recordingBridge } from "./helpers/recording-bridge.ts";

/** Orbit's customers section, core's fixture: a sticker turned -8deg in the accent colour, a title in Heading/H3. */
const CUSTOMERS = SnapshotSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../packages/core/test/fixtures/orbit-customers.json", import.meta.url), "utf8"),
  ),
);

describe("styles_compare", () => {
  it("holds a build's computed styles against each layer as design_read writes it in its parent", async () => {
    const { bridge, requests } = recordingBridge(CUSTOMERS, { missing: ["9:9"] });
    const result = await compareStyles(
      new PluginClient(bridge),
      StylesCompareInputSchema.parse({
        pairs: [
          {
            node: "54:450",
            label: ".sticker",
            css: {
              display: "flex",
              position: "absolute",
              left: "521px",
              top: "282.4px",
              paddingTop: "6px",
              paddingRight: "12px",
              paddingBottom: "6px",
              paddingLeft: "12px",
              transform: "matrix(0.990268, -0.139173, 0.139173, 0.990268, 0, 0)",
              overflowX: "hidden",
              overflowY: "hidden",
              borderTopLeftRadius: "999px",
              borderTopRightRadius: "999px",
              borderBottomRightRadius: "999px",
              borderBottomLeftRadius: "999px",
              backgroundColor: "rgb(255, 107, 61)",
            },
          },
          {
            node: "54:435",
            css: {
              position: "absolute",
              left: "40px",
              top: "40px",
              width: "251.3px",
              height: "30px",
              color: "rgb(20, 22, 31)",
              "font-family": '"Space Grotesk", sans-serif',
              "font-size": "24px",
              "font-weight": "600",
              "font-style": "normal",
              "line-height": "30px",
              "letter-spacing": "-0.24px",
            },
          },
          {
            node: "9:9",
            css: {},
          },
        ],
      }),
    );

    expect(requests).toEqual([
      {
        op: "entries",
        input: { ids: ["54:450", "54:435", "9:9"] },
        session: "s1",
      },
    ]);
    expect(result.layers).toEqual([
      {
        node: "54:450",
        name: "Sticker",
        tag: "Frame",
        label: ".sticker",
        matched: 16,
        mismatches: [],
        notGiven: [],
        notCompared: [],
      },
      {
        node: "54:435",
        name: "Title",
        tag: "Text",
        matched: 11,
        mismatches: [
          {
            property: "font-weight",
            design: "500",
            from: 'textStyle="Heading/H3"',
            build: "600",
          },
        ],
        notGiven: [],
        notCompared: [],
      },
    ]);
    expect(result.missing).toEqual(["9:9"]);
    expect(result.same).toBe(false);
  });
});
