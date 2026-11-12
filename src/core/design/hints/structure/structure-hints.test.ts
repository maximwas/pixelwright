import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { ComponentAttributes } from "@/core/design/component/component-attributes.ts";
import type { ShownLayer } from "@/core/design/hints/hints.types.ts";
import { LayerHints } from "@/core/design/hints/layer-hints.ts";
import { LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { AlikeStructures } from "@/core/design/hints/structure/alike-structures.ts";
import { BakedPaints } from "@/core/design/hints/structure/baked-paints.ts";
import { LayerShape } from "@/core/design/hints/structure/layer-shape.ts";
import { SharedLayers } from "@/core/design/hints/structure/shared-layers.ts";
import { StructureHints } from "@/core/design/hints/structure/structure-hints.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { LayerSchema, type ReadLayer } from "@/shared/read-model/layer.schema.ts";

const format = new NumberFormat();
const shape = new LayerShape();
const hints = new LayerHints(
  new ComponentAttributes(new NameValueList(), new TokenNames()),
  new LayoutGuess(format),
  format,
  new StructureHints(format, new AlikeStructures(shape), new SharedLayers(shape), new BakedPaints(format)),
);

const RED = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };
const IMAGE = { type: "IMAGE", visible: true, scaleMode: "FILL", imageHash: "abc" };
const GRADIENT = {
  type: "GRADIENT_LINEAR",
  visible: true,
  gradientStops: [],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};

type Fields = Record<string, unknown> & { id: string; children?: object[] };

/** A layer named by its id: a 100×100 frame at the root's corner unless the fields say otherwise. */
function layer(fields: Fields): Record<string, unknown> {
  return {
    name: fields.id,
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}

/** A text of one run, hugging its lines unless `resize` says otherwise. */
function text(
  id: string,
  characters: string,
  fields: Record<string, unknown> = {},
  { resize = "WIDTH_AND_HEIGHT", family = "Inter" }: { resize?: string; family?: string } = {},
): Record<string, unknown> {
  const segment = {
    characters,
    start: 0,
    end: characters.length,
    fontName: { family, style: "Regular" },
    fontSize: 16,
    fontWeight: 400,
    textDecoration: "NONE",
    textCase: "ORIGINAL",
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PIXELS", value: 0 },
    fills: [],
    fillStyleId: "",
    textStyleId: "",
  };

  return layer({
    id,
    type: "TEXT",
    width: 200,
    height: 20,
    text: {
      characters,
      textAutoResize: resize,
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [segment],
    },
    ...fields,
  });
}

const rect = (id: string, fields: Record<string, unknown> = {}) =>
  layer({ id, type: "RECTANGLE", width: 40, height: 20, fills: [RED], ...fields });

/** The hints LayerHints gives on every visible layer of the tree, one per line. */
function read(root: Record<string, unknown>): string {
  const tree = zod.parse(LayerSchema, root);
  const shown: ShownLayer[] = [];
  const walk = (node: ReadLayer, parent: ReadLayer | null): void => {
    if (node.visible) {
      shown.push({ layer: node, parent });

      for (const child of node.children ?? []) {
        walk(child, node);
      }
    }
  };

  walk(tree, null);

  return hints.read(shown, tree).join("\n");
}

describe("look, not build (Q-001)", () => {
  const stack = (fields: Record<string, unknown>) =>
    layer({
      id: "1:1",
      layoutMode: "VERTICAL",
      width: 300,
      height: 200,
      children: [0, 1, 2].map((index) => rect(`1:${index + 2}`, { y: index * 30, ...fields })),
    });

  it("reads absolute children in an auto layout parent as a stack with its gap", () => {
    expect(read(stack({ layoutPositioning: "ABSOLUTE" }))).toContain(
      '1:1 "1:1": 3 children are placed absolutely inside an auto layout parent, likely a stack with gap 10px',
    );
  });

  it("leaves children in the flow alone", () => {
    expect(read(stack({}))).not.toContain("placed absolutely inside");
  });

  const row = (gap: Record<string, unknown>) =>
    layer({
      id: "1:1",
      layoutMode: "HORIZONTAL",
      width: 300,
      height: 40,
      children: [rect("1:2"), layer({ id: "1:3", x: 40, width: 24, height: 40, ...gap }), rect("1:4", { x: 64 })],
    });

  it("names an empty layer in a flow as a spacer", () => {
    expect(read(row({}))).toContain('empty layer spaces the flow (1:3 "1:3" 24px × 40px)');
  });

  it("leaves a layer that paints alone", () => {
    expect(read(row({ fills: [RED] }))).not.toContain("spaces the flow");
  });

  const title = (resize: string) =>
    layer({
      id: "1:1",
      layoutMode: "VERTICAL",
      width: 400,
      children: [text("1:2", "Plans\nand prices", { layoutSizingHorizontal: "FILL", width: 400 }, { resize })],
    });

  it("names a hugging text broken by hand", () => {
    expect(read(title("WIDTH_AND_HEIGHT"))).toContain('breaks its lines by hand and hugs them (1:2 "1:2")');
  });

  it("leaves a text that wraps in its width alone", () => {
    expect(read(title("HEIGHT"))).not.toContain("by hand");
  });
});

describe("gaps and components (Q-002)", () => {
  const dots = (xs: number[]) =>
    layer({ id: "1:1", width: 300, height: 40, children: xs.map((x, index) => rect(`1:${index + 2}`, { x })) });

  it("gives the gap of evenly spaced children without auto layout", () => {
    expect(read(dots([0, 50, 100]))).toContain('spaces its children evenly (1:1 "1:1": gap 10px)');
  });

  it("leaves uneven children alone", () => {
    expect(read(dots([0, 50, 120]))).not.toContain("evenly");
  });

  const cards = (fields: Record<string, unknown>) =>
    layer({
      id: "1:1",
      layoutMode: "VERTICAL",
      width: 400,
      height: 300,
      children: [2, 3, 4].map((index) =>
        layer({
          id: `1:${index}`,
          layoutMode: "HORIZONTAL",
          width: 400,
          height: 40,
          children: [rect(`1:${index}0`), text(`1:${index}1`, "Plan")],
          ...fields,
        }),
      ),
    });

  it("suggests a component for a structure built three times", () => {
    expect(read(cards({}))).toContain('without a component (1:2 "1:2" and 2 alike)');
  });

  it("leaves instances of a component alone", () => {
    const instance = { type: "INSTANCE", instance: { componentId: "9:1", componentName: "Card", properties: {} } };

    expect(read(cards(instance))).not.toContain("alike");
  });
});

describe("fixed sizes (Q-003)", () => {
  const column = (fields: Record<string, unknown>) =>
    layer({
      id: "1:1",
      layoutMode: "VERTICAL",
      width: 400,
      children: [
        text(
          "1:2",
          "Every plan includes unlimited projects.",
          { width: 240, height: 40, ...fields },
          { resize: "HEIGHT" },
        ),
      ],
    });

  it("asks for fill and a max width on a fixed-width text narrower than its column", () => {
    expect(read(column({}))).toMatch(
      /fixed width narrower than its column \(1:2 "1:2" 240px wide in 400px\): use fill \+ max-width/,
    );
  });

  it("leaves a text that fills its column alone", () => {
    expect(read(column({ layoutSizingHorizontal: "FILL", width: 400 }))).not.toContain("max-width");
  });

  const excerpt = (clips: boolean) =>
    layer({
      id: "1:1",
      clipsContent: clips,
      width: 200,
      height: 40,
      children: [text("1:2", "A long excerpt", { y: 20, height: 40 }, { resize: "HEIGHT" })],
    });

  it("names a fixed height that cuts its content", () => {
    expect(read(excerpt(true))).toContain('clips its content (1:1 "1:1" 40px tall cuts 1:2)');
  });

  it("leaves a frame that does not clip alone", () => {
    expect(read(excerpt(false))).not.toContain("cuts");
  });
});

describe("baked paints (Q-004, Q-005)", () => {
  const holder = (...children: object[]) => layer({ id: "1:1", width: 400, height: 200, children });

  it("asks for the raw image under a fade baked into its fills", () => {
    expect(read(holder(rect("1:2", { fills: [IMAGE, GRADIENT] })))).toMatch(
      /bakes a fade into an image \(1:2 "1:2"\): .*original: true/,
    );
  });

  it("names a gradient laid over a photo", () => {
    expect(read(holder(rect("1:2", { fills: [IMAGE] }), rect("1:3", { fills: [GRADIENT] })))).toContain(
      '1:3 "1:3" over 1:2',
    );
  });

  it("leaves a plain image alone", () => {
    expect(read(holder(rect("1:2", { fills: [IMAGE] })))).not.toContain("original: true");
  });

  it("gives a tiled texture's scale and a noise's size", () => {
    const tiled = rect("1:2", { fills: [{ ...IMAGE, scaleMode: "TILE", scalingFactor: 0.5 }] });
    const grain = rect("1:3", { fills: [], effects: [{ type: "NOISE", visible: true, noiseSize: 2 }] });

    expect(read(holder(tiled, grain))).toContain('tiled textures (1:2 "1:2" tiled at 0.5×; 1:3 "1:3" noise of 2px)');
  });

  it("leaves an image that fills its box alone", () => {
    expect(read(holder(rect("1:2", { fills: [IMAGE] })))).not.toContain("tiled");
  });
});

describe("states (Q-007)", () => {
  const frame = (
    id: string,
    x: number,
    type: string,
  ) =>
    layer({
      id,
      x,
      width: 400,
      height: 300,
      layoutMode: "VERTICAL",
      children: [0, 1, 2, 3, 4].map((index) => layer({ id: `${id}${index}`, type, width: 40, height: 10 })),
    });
  const page = (...children: object[]) => layer({ id: "0:1", width: 2000, height: 400, children });

  it("reads two top-level frames sharing most layers as states of one component", () => {
    expect(read(page(frame("1:1", 0, "RECTANGLE"), frame("2:1", 500, "RECTANGLE")))).toContain(
      '(1:1 "1:1" and 2:1 "2:1" share most of their layers)',
    );
  });

  it("leaves top-level frames of other structures alone", () => {
    expect(read(page(frame("1:1", 0, "RECTANGLE"), frame("2:1", 500, "ELLIPSE")))).not.toContain("share most");
  });
});

describe("fallback fonts (Q-008)", () => {
  it("names the texts laid out with a fallback font", () => {
    const price = text("1:2", "Price", { missingFont: true }, { family: "Switzer" });

    expect(read(layer({ id: "1:1", layoutMode: "VERTICAL", children: [price] }))).toContain(
      'Fonts missing on this machine (Switzer) in 1:2 "1:2"',
    );
  });
});
