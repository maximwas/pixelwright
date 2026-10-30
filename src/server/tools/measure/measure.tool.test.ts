import { describe, expect, it } from "vitest";
import { Measure } from "@/core/inspect/measure.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { SelectedLayer } from "@/server/app/scope/selected-layer.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { MeasureTool } from "@/server/tools/measure/measure.tool.ts";
import type { InspectInput, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";

/** Two cards in a row as the inspect op reads them, 16 px apart; 9:9 is no layer. */
function inspected({ nodes }: InspectInput): InspectRaw {
  const card = (id: string, x: number) => {
    const box = { x, y: 0, width: 100, height: 50 };

    return {
      id,
      name: `Card ${id}`,
      type: "FRAME",
      visible: true,
      ...box,
      childCount: 0,
      parent: null,
      box,
      paintedBox: null,
      parentBox: null,
      parentPadding: null,
    };
  };
  const cards = [card("1:1", 0), card("1:2", 116)];

  return {
    origin: null,
    layers: cards.filter(({ id }) => nodes.includes(id)),
    missing: nodes.filter((id) => id === "9:9"),
    styles: {},
    variables: {},
  };
}

/** A plugin whose selection holds `selected` and whose inspect op answers `inspected`; each request is recorded. */
class InspectPlugin implements PluginLink {
  readonly requests: { op: string; input: unknown }[] = [];
  readonly #selected: readonly string[];
  readonly #inspected: (input: InspectInput) => InspectRaw;

  constructor(selected: readonly string[], inspected: (input: InspectInput) => InspectRaw) {
    this.#selected = selected;
    this.#inspected = inspected;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    this.requests.push({ op, input });

    return op === "selection"
      ? { nodes: this.#selected.map((id) => ({ id, name: id, type: "FRAME", box: null })) }
      : this.#inspected(input as InspectInput);
  }
}

function tool(selected: readonly string[] = []) {
  const plugin = new InspectPlugin(selected, inspected);
  const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);

  return { plugin, measure: new MeasureTool(session, new SelectedLayer(), new Measure(new NumberFormat())) };
}

// T-084: the layers named in order, read by the inspect op in page px, measured by core.
describe("the measure tool", () => {
  it("measures the layers named in order, from their layout boxes, and names the missing ones", async () => {
    const { plugin, measure } = tool();
    const answer = (await measure.execute({ nodes: ["1:1", "1:2", "9:9"] })).structuredContent;

    expect(plugin.requests).toEqual([{ op: "inspect", input: { nodes: ["1:1", "1:2", "9:9"] } }]);
    expect(answer).toMatchObject({
      measured: "box",
      missing: ["9:9"],
      pairs: [
        { gap: { x: 16, y: -50 }, summary: expect.stringMatching(/^1:2 "Card 1:2" is 16 px right of 1:1 "Card 1:1"/) },
      ],
    });
  });

  it("refuses fewer than two layers, naming what it found", async () => {
    await expect(tool(["1:1", "9:9"]).measure.execute({})).rejects.toThrow(
      "Measuring takes two layers or more: only one of 1:1, 9:9 is a layer of this file.",
    );
  });
});
