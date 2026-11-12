import { describe, expect, it } from "vitest";
import { PwUtils, type TreeElement } from "@/server/adapters/sandbox/guest/pw-utils.ts";

/** One turn of the event loop: long enough for every call started at once to be in flight together. */
async function turn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1));
}

/** pw as utils calls it: nodesFind finds `count` texts, inspect answers each id after a turn, its calls counted. */
class FakePw {
  readonly finds: object[] = [];
  readonly inspects: { nodes: string[]; file?: string }[] = [];
  maxInFlight = 0;
  #inFlight = 0;
  readonly #count: number;

  constructor(count: number) {
    this.#count = count;
  }

  async nodesFind(args: object) {
    this.finds.push(args);

    const nodes = Array.from({ length: this.#count }, (_unused, index) => ({
      id: `1:${index}`,
      name: `Text ${index}`,
      type: "TEXT",
      box: null,
      path: ["Page", "Card"],
    }));

    return { nodes, more: true };
  }

  async inspect(args: { nodes: string[]; file?: string }) {
    this.inspects.push(args);
    this.#inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.#inFlight);
    await turn();
    this.#inFlight -= 1;

    const layers = args.nodes.map((id) => ({
      id,
      name: "inspected",
      type: "TEXT",
      box: { x: 0, y: 0, width: 10, height: 20 },
      text: { fontSizes: [16] },
      fills: { css: "#000000" },
    }));

    return { relativeTo: "0:1", layers, missing: [] };
  }
}

const CARD: TreeElement = {
  id: "1:1",
  tag: "Frame",
  attributes: { name: "Card" },
  children: [
    {
      id: "1:2",
      tag: "Frame",
      attributes: { name: "Badge", display: "none" },
      children: [{ id: "1:3", tag: "Text", attributes: { name: "Label" }, text: "New", children: [] }],
    },
    { id: "1:4", tag: "Text", attributes: { name: "Title" }, text: "Pro", children: [] },
  ],
};

describe("PwUtils", () => {
  it("layers: finds, then inspects the ids in batches of 100, four at once, each find merged with its fields", async () => {
    const pw = new FakePw(650);
    const { layers, more } = await new PwUtils(pw).layers({ type: "TEXT", file: "Test MCP" }, { fields: ["text"] });

    expect(pw.finds).toEqual([{ type: "TEXT", file: "Test MCP" }]);
    expect(pw.inspects.map(({ nodes }) => nodes.length)).toEqual([100, 100, 100, 100, 100, 100, 50]);
    expect(pw.inspects.every(({ file }) => file === "Test MCP")).toBe(true);
    expect(pw.maxInFlight).toBe(4);
    expect(more).toBe(true);
    expect(layers).toHaveLength(650);
    expect(layers[649]).toEqual({
      id: "1:649",
      name: "Text 649",
      type: "TEXT",
      box: null,
      path: ["Page", "Card"],
      text: { fontSizes: [16] },
    });
  });

  it("layers: without fields, every inspect field over the find's", async () => {
    const { layers } = await new PwUtils(new FakePw(1)).layers({ name: "Text 0" });

    expect(layers).toEqual([
      {
        id: "1:0",
        name: "inspected",
        type: "TEXT",
        box: { x: 0, y: 0, width: 10, height: 20 },
        path: ["Page", "Card"],
        text: { fontSizes: [16] },
        fills: { css: "#000000" },
      },
    ]);
  });

  it("walk: depth first from the root, each element with its ancestors' names, depth, and hidden from an ancestor", () => {
    const seen: unknown[] = [];

    new PwUtils(new FakePw(0)).walk(CARD, (element, { path, depth, hidden }) => {
      seen.push([element.id, path, depth, hidden]);
    });

    expect(seen).toEqual([
      ["1:1", [], 0, false],
      ["1:2", ["Card"], 1, true],
      ["1:3", ["Card", "Badge"], 2, true],
      ["1:4", ["Card"], 1, false],
    ]);
  });

  it("find: every element the test passes, depth first", () => {
    const shown = new PwUtils(new FakePw(0)).find(CARD, (element, { hidden }) => element.tag === "Text" && !hidden);

    expect(shown.map(({ id }) => id)).toEqual(["1:4"]);
  });

  it("outlineTree: pw.outline's XML as elements, attributes unescaped, a hidden layer hidden to walk", () => {
    const utils = new PwUtils(new FakePw(0));
    const tree = utils.outlineTree(
      [
        '<Section id="81:1541" name="Start here" x="0" y="0">',
        '  <Instance id="81:1627" name="Install &lt;card&gt; &amp; &quot;more&quot;&#10;" $children="3"/>',
        '  <Frame id="81:1699" name="Notes" hidden="true">',
        '    <Text id="81:1700" name="Note"/>',
        "  </Frame>",
        "</Section>",
      ].join("\n"),
    );

    expect(tree).toEqual({
      id: "81:1541",
      tag: "Section",
      attributes: { id: "81:1541", name: "Start here", x: "0", y: "0" },
      children: [
        {
          id: "81:1627",
          tag: "Instance",
          attributes: { id: "81:1627", name: 'Install <card> & "more"\n', $children: "3" },
          children: [],
        },
        {
          id: "81:1699",
          tag: "Frame",
          attributes: { id: "81:1699", name: "Notes", hidden: "true" },
          children: [{ id: "81:1700", tag: "Text", attributes: { id: "81:1700", name: "Note" }, children: [] }],
        },
      ],
    });
    expect(utils.find(tree, (_element, { hidden }) => hidden).map(({ id }) => id)).toEqual(["81:1699", "81:1700"]);
  });

  it("map: at most limit at once, the answers in the items' order", async () => {
    let inFlight = 0;
    let most = 0;
    const answers = await new PwUtils(new FakePw(0)).map(
      [3, 1, 2, 0, 1],
      async (wait, index) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, wait * 3));
        inFlight -= 1;

        return `${index}:${wait}`;
      },
      { limit: 2 },
    );

    expect(answers).toEqual(["0:3", "1:1", "2:2", "3:0", "4:1"]);
    expect(most).toBe(2);
  });

  it("color: hex, rgb() and rgba() as 0-255 channels and alpha 0-1; null for what is no colour", () => {
    const { color } = new PwUtils(new FakePw(0));

    expect(color("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(color("#0080FFCC")).toEqual({ r: 0, g: 128, b: 255, a: 0.8 });
    expect(color("rgba(0, 128, 255, 0.5)")).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
    expect(color("rgb(0 128 255 / 50%)")).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
    expect(color("linear-gradient(#fff, #000)")).toBeNull();
  });

  it("color.same: two colours alike within a tolerance on each 0-255 channel", () => {
    const { color } = new PwUtils(new FakePw(0));

    expect(color.same("#000000", "rgb(0, 0, 0)")).toBe(true);
    expect(color.same("#000", "#010101")).toBe(false);
    expect(color.same("#000", "#010101", 1)).toBe(true);
    expect(color.same("#000", "#000000f0", 1)).toBe(false);
    expect(color.same("#000", "none")).toBe(false);
  });
});
