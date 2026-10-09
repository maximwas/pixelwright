import { readFileSync } from "node:fs";
import { type ApplyChange, designXml, type Snapshot, SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { applyDesign } from "../src/mcp/tools/apply.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A bridge over one snapshot: entries come from it (cut below the root when asked), apply answers what it was given. */
function bridgeOver(snapshot: Snapshot, { cut = false }: { cut?: boolean } = {}) {
  const requests: { op: string; input: Record<string, unknown> }[] = [];
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
    request: async (op, input) => {
      requests.push({
        op,
        input: input as Record<string, unknown>,
      });

      if (op === "entries") {
        return {
          roots: [
            {
              node: cut
                ? {
                    ...snapshot.root,
                    children: [],
                  }
                : snapshot.root,
              parent: null,
            },
          ],
          missing: [],
          styles: snapshot.styles,
          variables: snapshot.variables,
        };
      }

      const { changes } = input as { changes: ApplyChange[] };

      return {
        created: changes
          .filter((change) => change.kind === "create")
          .map((change) => ({
            line: change.line,
            ref: change.ref,
            id: `90:${change.line}`,
            tag: change.tag,
          })),
        changed: changes.flatMap((change) => (change.id === null ? [] : [change.id])),
        errors: [],
      };
    },
  };

  return {
    bridge,
    requests,
    sent: () => (requests.find(({ op }) => op === "apply")?.input.changes ?? []) as ApplyChange[],
  };
}

/** The Services row captured from Positivus, core's fixture. */
const ROW = SnapshotSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../packages/core/test/fixtures/positivus-services-row.json", import.meta.url), "utf8"),
  ),
);

describe("design_apply", () => {
  it("writes nothing for the XML design_read returned, sent back as it was", async () => {
    const { bridge, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: designXml(ROW).xml,
      dryRun: false,
    });

    expect(result).toEqual({
      created: [],
      changed: [],
      errors: [],
      dryRun: false,
    });
    expect(requests.map(({ op }) => op)).toEqual(["entries"]);
  });

  it("sends only what changed, in Figma's terms, with the layer's own layout around it", async () => {
    const xml = designXml(ROW).xml.replace('gap="40px"', 'gap="48px"');
    const { bridge, sent } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml,
      dryRun: false,
    });

    expect(result.errors).toEqual([]);
    expect(sent()).toEqual([
      expect.objectContaining({
        kind: "update",
        id: "2:4869",
        props: expect.objectContaining({ itemSpacing: 48 }),
      }),
    ]);
  });

  it("returns a parse error with its line and column and asks the plugin for nothing", async () => {
    const { bridge, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869">\n  <Text>Hi</Frame>',
      dryRun: false,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringMatching(/Expected <\/Text>/),
      }),
    ]);
    expect(requests).toEqual([]);
  });

  it("keeps writing the rest when an element has a bad attribute, and passes a dry run on", async () => {
    const { bridge, sent, requests } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869" gapp="8px" opacity="0.5"/>\n<Frame name="New" background="#FFF"/>',
      parent: "2:4766",
      dryRun: true,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        line: 1,
        attribute: "gapp",
        hint: expect.stringMatching(/gap/),
      }),
    ]);
    expect(sent().map((change) => [change.kind, change.props])).toEqual([
      ["update", { opacity: 0.5 }],
      [
        "create",
        expect.objectContaining({
          name: "New",
        }),
      ],
    ]);
    expect(requests.find(({ op }) => op === "apply")?.input).toMatchObject({
      parent: "2:4766",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
  });

  it("refuses moving a layer, into a new one, into another parent, next to another or in another order", async () => {
    const { bridge, sent } = bridgeOver(ROW);
    const result = await applyDesign(bridge, {
      xml: [
        '<Frame name="Row" display="flex"><Frame id="2:4870"/></Frame>',
        '<Frame id="2:4869"><Frame id="2:4877" opacity="0.5"/></Frame>',
        '<Frame id="2:4876" after="2:4870"/>',
      ].join("\n"),
      dryRun: false,
    });

    expect(result.errors.map(({ line, id, message }) => [line, id, message])).toEqual([
      [1, "2:4870", expect.stringMatching(/Moving a layer/)],
      [2, "2:4877", expect.stringMatching(/Moving a layer/)],
      [3, "2:4876", expect.stringMatching(/Moving a layer/)],
    ]);
    // What the layer itself was asked for still goes in.
    expect(sent().find((change) => change.id === "2:4877")?.props).toEqual({ opacity: 0.5 });

    const reordered = await applyDesign(bridgeOver(ROW).bridge, {
      xml: '<Frame id="2:4869"><Frame id="2:4876"/><Frame id="2:4870"/></Frame>',
      dryRun: false,
    });

    expect(reordered.errors).toEqual([
      expect.objectContaining({
        id: "2:4870",
        message: expect.stringMatching(/order/),
      }),
    ]);
  });

  it("refuses a layer whose state the read could not take, instead of writing it whole", async () => {
    const { bridge, sent } = bridgeOver(ROW, { cut: true });
    const result = await applyDesign(bridge, {
      xml: '<Frame id="2:4869" opacity="0.9"><Frame id="2:4870" opacity="0.5"/></Frame>',
      dryRun: false,
    });

    expect(result.errors).toEqual([
      expect.objectContaining({
        id: "2:4870",
        message: expect.stringMatching(/could not read/),
      }),
    ]);
    expect(sent().map((change) => change.id)).toEqual(["2:4869"]);
  });
});
