import { describe, expect, it } from "vitest";
import { DesignDiff } from "@/core/diff/design-diff.ts";
import { Fingerprint } from "@/core/diff/fingerprint.ts";
import { VariantDiff } from "@/core/diff/variant-diff.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { NodesDiffTool } from "@/server/tools/nodes-diff/nodes-diff.tool.ts";
import { VariantsReadTool } from "@/server/tools/variants-read/variants-read.tool.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { fixture, tree } from "./support/design-classes.ts";

const designs = new DesignDiff(tree, new Fingerprint());

/** Orbit's Customers block, and the same block under another id. */
const CUSTOMERS = fixture("orbit-customers");
const COPY = { ...CUSTOMERS, root: { ...CUSTOMERS.root, id: "9:1" } };

/** A variant of the Button set: a grey frame. */
function variant(
  id: string,
  name: string,
  x: number,
): ReadLayer {
  return {
    id,
    name,
    type: "COMPONENT",
    visible: true,
    x,
    y: 0,
    width: 120,
    height: 40,
    childCount: 0,
    fills: [{ type: "SOLID", visible: true, color: { r: 0.5, g: 0.5, b: 0.5 } }],
  };
}

const BUTTON: ReadModel = {
  model: 1,
  profile: "design",
  root: {
    id: "5:1",
    name: "Button",
    type: "COMPONENT_SET",
    visible: true,
    x: 0,
    y: 0,
    width: 300,
    height: 40,
    childCount: 2,
    children: [variant("5:2", "State=Default", 0), variant("5:3", "State=Hover", 140)],
  },
  styles: {},
  variables: {},
};

/** A plugin whose read op gives the models asked for, `cut` layers cut by the read's budget; its set op names 5:1. */
class ReadingPlugin implements PluginLink {
  readonly requests: { op: string; input: unknown }[] = [];
  readonly #models: readonly ReadModel[];
  readonly #cut: number;

  constructor(models: readonly ReadModel[], cut: number) {
    this.#models = models;
    this.#cut = cut;
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

    if (op === "set_of") {
      return { id: "5:1", name: "Button" };
    }

    const { nodes } = input as { nodes: string[] };

    return {
      reads: this.#models.filter(({ root }) => nodes.includes(root.id)),
      missing: [],
      cuts: Array.from({ length: this.#cut }, (_value, index) => ({ id: `7:${index}`, reason: "budget" })),
    };
  }
}

const session = (plugin: PluginLink) => new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);

// T-085, T-086, K-052: drawings are told apart by their paths' hash, which the read gives only when asked; a read the
// budget cut compares part of a tree, which the answer says.
describe("the diff tools over a read", () => {
  it("nodes_diff asks the read for the drawings' hashes and says the read was cut", async () => {
    const plugin = new ReadingPlugin([CUSTOMERS, COPY], 1);
    const answer = await new NodesDiffTool(session(plugin), designs).execute({ a: CUSTOMERS.root.id, b: COPY.root.id });

    expect(plugin.requests).toEqual([{ op: "read", input: expect.objectContaining({ pathHash: true }) }]);
    expect(answer.structuredContent).toMatchObject({ same: true, cut: expect.stringContaining("cut at 1 layer:") });
  });

  it("variants_read asks the read for the drawings' hashes and says the read was cut", async () => {
    const plugin = new ReadingPlugin([BUTTON], 2);
    const variants = new VariantDiff(designs, new NameValueList());
    const answer = await new VariantsReadTool(session(plugin), variants).execute({ node: "5:2" });

    expect(plugin.requests.map(({ op }) => op)).toEqual(["set_of", "read"]);
    expect(plugin.requests[1]?.input).toMatchObject({ nodes: ["5:1"], pathHash: true });
    expect(answer.structuredContent).toMatchObject({ cut: expect.stringContaining("cut at 2 layers:") });
  });
});
