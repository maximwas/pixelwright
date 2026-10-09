import { readFileSync } from "node:fs";
import { type ApplyChange, designXml, type Snapshot, SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { applyDesign } from "../src/mcp/tools/apply.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

/** A bridge over one snapshot: entries come from it, apply answers what it was given. */
function bridgeOver(snapshot: Snapshot) {
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
              node: snapshot.root,
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
});
