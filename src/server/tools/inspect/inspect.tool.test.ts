import { describe, expect, it } from "vitest";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { InspectViewSchema } from "@/core/inspect/inspect.schema.ts";
import { InspectFills } from "@/core/inspect/inspect-fills.ts";
import { InspectLayout } from "@/core/inspect/inspect-layout.ts";
import { InspectView } from "@/core/inspect/inspect-view.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
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
import { InspectTool } from "@/server/tools/inspect/inspect.tool.ts";
import type { InspectedLayer, InspectInput, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const solid = new SolidPaint(names);
const lengths = new CssLength(new CssVar(new CssSplit()), format, names);
const paints = new PaintList(
  solid,
  new GradientCss(new GradientGeometry(), solid, lengths, format),
  new ImagePaint(new CssUrl(new CssSplit())),
  names,
);
const view = new InspectView(
  format,
  new InspectFills(paints, solid, names),
  new InteractionAttributes(new EasingCss(format)),
  new InspectLayout(new LayoutGroup(lengths, format), lengths),
);

/** A rule 100 px wide at (0, 100), its centred stroke painting half a pixel out; and a 200 px ring. */
const layer = (
  id: string,
  box: InspectedLayer["box"],
  paintedBox: InspectedLayer["paintedBox"] = null,
) => ({
  id,
  name: id,
  type: "LINE",
  visible: true,
  ...box,
  childCount: 0,
  parent: null,
  box,
  paintedBox,
  parentBox: null,
  parentPadding: null,
});
const RULE = layer("2:4", { x: 0, y: 100, width: 100, height: 0 }, { x: -0.5, y: 99.5, width: 101, height: 1 });

/**
 * The ring 2:9 at the top left of section 2:1, which sits at (300, 300) on the page: the op gives its box from the
 * origin it is asked for; 9:9 is no layer.
 */
function inspected({ nodes = [], relativeTo }: InspectInput): InspectRaw {
  const ring = layer("2:9", {
    x: relativeTo === "2:1" ? 0 : 300,
    y: relativeTo === "2:1" ? 0 : 300,
    width: 200,
    height: 200,
  });

  return {
    origin: null,
    layers: nodes.flatMap((id) => (id === "2:9" ? [ring] : id === "9:9" ? [] : [{ ...RULE, id }])),
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

  return { plugin, inspect: new InspectTool(session, new SelectedLayer(), view) };
}

// T-080: the selection by default; it works with Allow edits off, as the op asks for none.
describe("the inspect tool", () => {
  it("inspects the selection when no layers are named, and gives the view", async () => {
    const { plugin, inspect } = tool(["2:4"]);
    const answer = (await inspect.execute({})).structuredContent;

    expect(plugin.requests).toEqual([
      { op: "selection", input: {} },
      { op: "inspect", input: { nodes: ["2:4"] } },
    ]);
    expect(answer).toMatchObject({
      relativeTo: "the page",
      layers: [{ paintedBox: { x: -0.5, y: 99.5, width: 101, height: 1 } }],
    });
  });

  it("says what to do when nothing is selected and no layers are named", async () => {
    await expect(tool().inspect.execute({})).rejects.toThrow(/select.*nodes/);
  });

  // O-014: a selection past 100 is cut, and the answer says how many it left.
  it("reads the first 100 layers of a bigger selection and says how many it left", async () => {
    const { plugin, inspect } = tool(Array.from({ length: 101 }, (_slot, index) => `3:${index + 1}`));
    const answer = (await inspect.execute({})).structuredContent;

    expect((plugin.requests[1]?.input as InspectInput | undefined)?.nodes).toHaveLength(100);
    expect(answer).toMatchObject({ left: 1 });
  });
});

// T-082: around a layer's centre read in the boxes' origin, or a point.
describe("inspect around", () => {
  it("measures from the centre of the layer around names, read in the same origin as the boxes", async () => {
    const answer = (await tool().inspect.execute({ nodes: ["2:4"], relativeTo: "2:1", around: "2:9" }))
      .structuredContent;

    expect(answer).toMatchObject({
      around: { x: 100, y: 100 },
      layers: [{ center: { x: 50, y: 100 }, distance: 50, angle: 270 }],
    });
  });

  it("measures from a point given in the boxes' origin", async () => {
    const answer = (await tool().inspect.execute({ nodes: ["2:4"], around: { x: 50, y: 0 } })).structuredContent;

    expect(answer).toMatchObject({ around: { x: 50, y: 0 }, layers: [{ distance: 100, angle: 180 }] });
  });

  it("says so when the layer around names is not in the file", async () => {
    await expect(tool().inspect.execute({ nodes: ["2:4"], around: "9:9" })).rejects.toThrow(
      "around: 9:9 is not a layer of this file.",
    );
  });
});

const RUN = {
  fontName: { family: "Inter", style: "Regular" },
  fontWeight: 400,
  textDecoration: "NONE",
  textCase: "ORIGINAL",
};

/** A text of two runs: "Save " in 14 px, "20%" in 16 px bold and underlined. */
const MIXED = {
  ...layer("4:1", { x: 0, y: 0, width: 80, height: 20 }),
  type: "TEXT",
  text: {
    characters: "Save 20%",
    textAutoResize: "WIDTH_AND_HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    segments: [
      {
        ...RUN,
        characters: "Save ",
        start: 0,
        end: 5,
        fontSize: 14,
        lineHeight: { unit: "AUTO" },
        letterSpacing: { unit: "PERCENT", value: 0 },
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
        fillStyleId: "",
        textStyleId: "",
      },
      {
        ...RUN,
        fontName: { family: "Inter", style: "Bold" },
        fontWeight: 700,
        textDecoration: "UNDERLINE",
        characters: "20%",
        start: 5,
        end: 8,
        fontSize: 16,
        lineHeight: { unit: "AUTO" },
        letterSpacing: { unit: "PERCENT", value: 0 },
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
        fillStyleId: "",
        textStyleId: "",
      },
    ],
  },
};

const answerOf = (raw: Partial<InspectRaw>, input: Record<string, unknown> = {}) =>
  new InspectTool(
    new PluginSession(
      "6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13",
      new InspectPlugin([], () => ({ origin: null, layers: [], missing: [], styles: {}, variables: {}, ...raw })),
      [],
    ),
    new SelectedLayer(),
    view,
  )
    .execute({ nodes: ["4:1"], ...input })
    .then((result) => result.structuredContent as Record<string, any>);

// RG-3: what agents wrote plugin code for: text runs, the parent's layout, the way up, a subtree, only some groups.
describe("inspect: runs, parent layout, path, subtree and fields", () => {
  it("lists a mixed text's runs with font, size, decoration and colour, and none for a text of one style", async () => {
    const [mixed] = (await answerOf({ layers: [MIXED] })).layers;
    const [single] = (
      await answerOf({ layers: [{ ...MIXED, text: { ...MIXED.text, segments: MIXED.text.segments.slice(0, 1) } }] })
    ).layers;

    expect(mixed.text.segments).toEqual([
      {
        start: 0,
        end: 5,
        characters: "Save ",
        fontFamily: "Inter",
        fontStyle: "Regular",
        fontSize: 14,
        textDecoration: "NONE",
        fill: "#000",
      },
      {
        start: 5,
        end: 8,
        characters: "20%",
        fontFamily: "Inter",
        fontStyle: "Bold",
        fontSize: 16,
        textDecoration: "UNDERLINE",
        fill: "#F00",
      },
    ]);
    expect(single.text.segments).toBeUndefined();
  });

  it("gives a layer in auto layout its parent's layout as CSS longhands, and the way up with ids", async () => {
    const child = {
      ...layer("4:2", { x: 0, y: 0, width: 10, height: 10 }),
      parentLayout: {
        childCount: 3,
        layoutMode: "HORIZONTAL",
        itemSpacing: 8,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
      },
      path: [{ id: "1:2", name: "Card", type: "FRAME" }],
    };
    const [read] = (await answerOf({ layers: [child] })).layers;

    expect(read.parentLayout).toMatchObject({ display: "flex", gap: 8, "padding-left": 4 });
    expect(read.path).toEqual([{ id: "1:2", name: "Card", type: "FRAME" }]);
  });

  it("asks the op for a subtree and says which layers it left", async () => {
    const plugin = new InspectPlugin([], () => ({
      origin: null,
      layers: [MIXED],
      missing: [],
      more: true,
      leftIds: ["4:9"],
      styles: {},
      variables: {},
    }));
    const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", plugin, []);
    const answer = (
      await new InspectTool(session, new SelectedLayer(), view).execute({ within: "4:0", depth: 2, fields: ["text"] })
    ).structuredContent;

    expect(plugin.requests).toEqual([{ op: "inspect", input: { within: "4:0", depth: 2, fields: ["text"] } }]);
    expect(answer).toMatchObject({ more: true, leftIds: ["4:9"] });
  });

  it("keeps only the named groups, besides the id, name and type", async () => {
    const [read] = (await answerOf({ layers: [MIXED] }, { fields: ["text"] })).layers;

    expect(Object.keys(read).sort()).toEqual(["id", "name", "text", "type"]);
  });

  it("gives an answer that fits the output schema when box, center and parent are not asked for", async () => {
    const answer = await answerOf({ layers: [MIXED] }, { fields: ["layout"] });

    expect(InspectViewSchema.safeParse(answer).success).toBe(true);
  });

  it("refuses within together with nodes", async () => {
    await expect(answerOf({ layers: [MIXED] }, { within: "4:0", nodes: ["4:1"] })).rejects.toThrow(/exactly one/);
  });
});
