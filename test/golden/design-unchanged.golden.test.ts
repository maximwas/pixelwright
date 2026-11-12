import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ApplyElement } from "@/core/apply/apply.types.ts";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { LayerEntry } from "@/core/apply/plan/plan.types.ts";
import { UNCHANGED } from "@/core/apply/plan/unchanged.ts";
import { WRITE_PLANNER } from "@/core/apply/plan/write-planner.ts";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { DESIGN_BUILDER, type DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { Color } from "@/core/kernel/color/color.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { fixture } from "./support/design-classes.ts";

/** The server's own planner and design_read, as the root binds them. */
const container = new ServerMain({
  home: mkdtempSync(join(tmpdir(), "pixelwright-unchanged-")),
  logLevel: "silent",
  pluginBridge: false,
  bridgePort: 0,
  pluginOrigins: [],
  projectDir: tmpdir(),
}).container();
const planner = container.get(WRITE_PLANNER);
const design = container.get(DESIGN_XML);

/** design_read's XML of a read, sent back to the same layers: what the plan writes, and its errors. */
function roundTrip(model: ReadModel): unknown {
  const { elements, errors } = new ApplyRead().read(design.read(model).xml);
  const plan = planner.plan(elements, CurrentLayers.of([model], []));

  return { written: plan.written.map(({ ref, sources }) => ({ ref, sources })), errors: [...errors, ...plan.errors] };
}

/**
 * The round-trip proof (D-19, C-170): every Orbit layer design_read writes, sent back as it was written, plans zero
 * writes, in an sRGB file and in a Display P3 one (whose colours design_read writes as P3).
 */
describe.each(["orbit-customers", "orbit-desktop-top", "orbit-plans", "orbit-pricing"])(
  "golden unchanged (%s)",
  (name) => {
    it("plans zero writes for its own read", () => {
      const result = {
        srgb: roundTrip(fixture(name)),
        p3: roundTrip({ ...fixture(name), colorProfile: "DISPLAY_P3" }),
      };
      const golden = readFileSync(new URL(`./__golden__/${name}.unchanged.json`, import.meta.url), "utf8");

      expect(`${JSON.stringify(result, null, 2)}\n`).toBe(golden);
    });
  },
);

const unchanged = container.get(UNCHANGED);

/** A white card with a 1px black inside border, alone in an auto layout parent, in a read of `colorProfile`. */
function card(fields: Partial<ReadLayer> = {}, colorProfile?: string): { entry: LayerEntry; layers: CurrentLayers } {
  const layer: ReadLayer = {
    id: "81:2",
    name: "Card",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    childCount: 0,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    ...fields,
  };
  const root: ReadLayer = {
    ...layer,
    id: "81:1",
    name: "List",
    layoutMode: "VERTICAL",
    children: [layer],
    childCount: 1,
  };
  const layers = CurrentLayers.of(
    [
      {
        model: 1,
        profile: "apply",
        root,
        styles: {},
        variables: {},
        ...(colorProfile === undefined ? {} : { colorProfile }),
      },
    ],
    [],
  );
  const entry = layers.entry("81:2");

  if (entry === undefined) {
    throw new Error("no entry");
  }

  return { entry, layers };
}

function element(attributes: Record<string, string>): ApplyElement {
  return { line: 1, column: 1, tag: "Frame", id: "81:2", ref: "81:2", parent: null, index: 0, attributes };
}

describe("Unchanged", () => {
  // D-19: equal as the writers read them, not as text: another spelling of the same colour and border is held.
  it("judges an attribute in CSS space, not as formatted text", () => {
    const now = unchanged.of(element({ background: "rgb(255, 255, 255)", border: "solid 1px black" }), card().entry);

    expect([...now.attributes]).toEqual(["background", "border"]);
  });

  // C-170: in a Display P3 file an sRGB colour is also tried in the file's space.
  it("holds an sRGB colour a Display P3 file has as its P3 value", () => {
    const red = Color.parse("#ff0000")?.to("display-p3").channels() ?? { r: 0, g: 0, b: 0 };
    const { entry } = card({ fills: [{ type: "SOLID", color: red }] }, "DISPLAY_P3");

    expect([...unchanged.of(element({ background: "#ff0000" }), entry).attributes]).toEqual(["background"]);
  });

  // D-18: a hidden layer sent back with display="none" stays hidden; any other display shows it.
  it("holds display none on a hidden layer only", () => {
    const { entry } = card({ visible: false });

    expect([...unchanged.of(element({ display: "none" }), entry).attributes]).toEqual(["display"]);
    expect([...unchanged.of(element({ display: "flex" }), entry).attributes]).toEqual([]);
  });

  // C-170, D-19: a layer is rendered once per call (as root and as child), however many elements name it.
  it("renders a layer once per call", () => {
    const builder: DesignBuilder = container.get(DESIGN_BUILDER);
    const render = vi.spyOn(builder, "element");
    const { entry } = card();

    unchanged.of(element({ background: "#fff" }), entry);
    unchanged.of(element({ border: "none" }), entry);

    expect(render).toHaveBeenCalledTimes(2);

    unchanged.of(element({ background: "#fff" }), card().entry);

    expect(render).toHaveBeenCalledTimes(4);
    render.mockRestore();
  });
});
