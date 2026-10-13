import { describe, expect, it } from "vitest";
import { auditDesign } from "../src/checks/audit-design.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

describe("design_audit", () => {
  it("audits the layer named, read whole", async () => {
    const asked: unknown[] = [];
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
        asked.push([op, input]);

        return {
          root: {
            id: "1:1",
            name: "Card",
            type: "FRAME",
            visible: true,
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            childCount: 0,
            layoutMode: "VERTICAL",
            itemSpacing: 10,
          },
          styles: {},
          variables: {},
        };
      },
    };

    await expect(auditDesign(bridge, { node: "1:1" })).resolves.toMatchObject({
      spacing: [
        {
          value: 10,
          count: 1,
        },
      ],
      notes: [expect.stringMatching(/10px is off the 4px grid/)],
    });
    expect(asked).toEqual([
      [
        "snapshot",
        {
          node: "1:1",
          css: "none",
        },
      ],
    ]);
  });
});
