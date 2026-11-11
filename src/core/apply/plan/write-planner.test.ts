import { describe, expect, it } from "vitest";
import type { ApplyChange, ApplyElement } from "@/core/apply/apply.types.ts";
import { Assessor } from "@/core/apply/plan/assessor.ts";
import { ChangeOf } from "@/core/apply/plan/change-of.ts";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { LayerReads } from "@/core/apply/plan/layer-reads.ts";
import { PlacedLayers } from "@/core/apply/plan/placed-layers.ts";
import { PlannedComponents } from "@/core/apply/plan/planned-components.ts";
import { Unchanged } from "@/core/apply/plan/unchanged.ts";
import { WritePlanner } from "@/core/apply/plan/write-planner.ts";
import { CssReader } from "@/core/css/css-reader.ts";
import { GapReader } from "@/core/css/groups/layout/gap-reader.ts";
import { GridWriter } from "@/core/css/groups/layout/grid-writer.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { LayoutWriter } from "@/core/css/groups/layout/layout-writer.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";
import { WriteRegistry } from "@/core/css/registry/write-registry.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { FigmaPropsSchema } from "@/shared/write-intents/write-intent.schema.ts";

const split = new CssSplit();
const format = new NumberFormat();
const lengths = new CssLength(new CssVar(split), format, new TokenNames());
const gaps = new GapReader(lengths, split);
const reads = new LayerReads();
const placed = new PlacedLayers();
const planner = new WritePlanner(
  reads,
  new Assessor(new Unchanged(new CssReader(new GroupRegistry([new LayoutGroup(lengths, format)]))), reads),
  new ChangeOf(new WriteRegistry([new LayoutWriter(lengths, split, gaps, new GridWriter(lengths, split, gaps))])),
  placed,
);

function layer(id: string, fields: Partial<ReadLayer> = {}): ReadLayer {
  return { id, name: id, type: "FRAME", visible: true, x: 0, y: 0, width: 10, height: 10, childCount: 0, ...fields };
}

function element(fields: Partial<ApplyElement> & { attributes: Record<string, string> }): ApplyElement {
  return { line: 1, column: 1, tag: "Frame", id: null, ref: "new:1", parent: null, index: 0, ...fields };
}

function change(ref: string, fields: Partial<ApplyChange> = {}): ApplyChange {
  return {
    line: 1,
    column: 1,
    kind: "update",
    ref,
    id: ref,
    tag: "Frame",
    parent: null,
    index: 0,
    props: {},
    sources: {},
    ...fields,
  };
}

/** The layers of a read: a card in auto layout with two children, padding 32 and gap 8, and the ids the file lacks. */
function card(missing: string[] = []): CurrentLayers {
  const children = [layer("81:2"), layer("81:3")];
  const root = layer("81:1", {
    layoutMode: "HORIZONTAL",
    paddingTop: 32,
    paddingRight: 32,
    paddingBottom: 32,
    paddingLeft: 32,
    itemSpacing: 8,
    children,
    childCount: 2,
  });
  const model: ReadModel = {
    model: 1,
    profile: "apply",
    root,
    styles: {},
    variables: {},
    page: { id: "0:1", name: "Page" },
  };

  return CurrentLayers.of([model], missing);
}

describe("WritePlanner", () => {
  // C-034..C-040, C-171: only what the layer does not have, judged in CSS space, with the attribute each came from.
  it("plans the layout attributes a layer does not have yet", () => {
    const frame = element({ id: "81:1", ref: "81:1", attributes: { padding: "32px", gap: "12px" } });
    const plan = planner.plan([frame], card());

    expect(plan.errors).toEqual([]);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({
      kind: "update",
      id: "81:1",
      props: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
      sources: { itemSpacing: "gap" },
    });
    expect(plan.changes[0]?.props.padding).toBeUndefined();
    // C-181: what the planner makes is what the write-intent contract takes, and no other key.
    expect(FigmaPropsSchema.safeParse(plan.changes[0]?.props).success).toBe(true);
    expect(FigmaPropsSchema.safeParse({ itemSpacing: 12, unknown: 1 }).success).toBe(false);
  });

  // A dry run must not read "already as asked" where no writer handles the attribute yet.
  it("names the attributes no writer handles yet, per element, and keeps them out of the changes", () => {
    const frame = element({ id: "81:1", ref: "81:1", attributes: { background: "#f00", gap: "12px" } });
    const plan = planner.plan([frame], card());

    expect(plan.notWritten.get("81:1")).toEqual(["background"]);
    expect(plan.errors).toEqual([]);
    expect(Object.keys(plan.changes[0]?.props ?? {})).not.toContain("fills");
  });

  // C-168, B-027: a named layer the read could not take is refused; one the file lacks goes to the plugin.
  it("refuses a named layer the read could not take and sends one the file lacks", () => {
    const unread = element({ id: "9:9", ref: "9:9", attributes: { gap: "4px" } });
    const gone = element({ id: "9:8", ref: "9:8", attributes: { padding: "4px" } });
    const plan = planner.plan([unread, gone], card(["9:8"]));

    expect(plan.errors.map(({ id, message }) => [id, message])).toEqual([
      ["9:9", expect.stringContaining("could not read 9:9")],
    ]);
    expect(plan.changes.map(({ id }) => id)).toEqual(["9:8"]);
  });

  // C-169: what a call reads: the ids, the sources of copied layers, the layers copied.
  it("reads the ids, the compared sources and the copied layers once", () => {
    const copy = element({ ref: "new:2", attributes: { copyOf: "1:5" } });
    const inner = element({ ref: "new:3", parent: "new:2", copy: "new:2", source: "1:6", attributes: {} });
    const fresh = element({ ref: "new:4", parent: "new:2", copy: "new:2", attributes: {} });
    const frame = element({ id: "81:1", ref: "81:1", attributes: {} });

    expect(reads.ids([frame, copy, inner, fresh, frame])).toEqual(["81:1", "1:5", "1:6"]);
  });

  // C-174, B-025: nothing lays a layer out under a parent without flex or grid, or at the top level.
  it("places a layer by its edges where nothing lays it out", () => {
    const block = element({ ref: "new:1", attributes: { display: "block" } });
    const flex = element({ ref: "new:2", attributes: { display: "flex" } });
    const inBlock = element({ ref: "new:3", parent: "new:1", attributes: {} });
    const inFlex = element({ ref: "new:4", parent: "new:2", attributes: {} });
    const items = [block, flex, inBlock, inFlex].map((item) => ({ element: item }));
    const byRef = new Map(items.map((item) => [item.element.ref, item]));

    expect(items.map((item) => placed.isPlaced(item, byRef))).toEqual([true, true, true, false]);
  });
});

describe("WritePlanner send list", () => {
  // C-176: what writes something, plus the parents and neighbours of a layer made, so the plugin finds its place.
  it("sends what writes with the parents and neighbours of a layer made", () => {
    const parent = element({ id: "81:1", ref: "81:1", attributes: { gap: "12px" } });
    const next = element({ id: "81:2", ref: "81:2", parent: "81:1", index: 0, attributes: {} });
    const made = element({ ref: "new:1", parent: "81:1", index: 1, attributes: { display: "flex" } });
    const far = element({ id: "81:3", ref: "81:3", parent: "81:1", index: 2, attributes: {} });
    const plan = planner.plan([parent, next, made, far], card());

    expect(plan.send.map(({ ref }) => ref)).toEqual(["81:1", "81:2", "new:1", "81:3"]);
    expect(plan.written.map(({ ref }) => ref)).toEqual(["81:1", "new:1"]);
  });
});

describe("PlannedComponents", () => {
  // C-178: a dry run remembers the sets the XML makes, so instances after them validate.
  it("remembers a set with its variants and says what an instance lacks", () => {
    const planned = new PlannedComponents();
    const set = change("set", { kind: "create", tag: "ComponentSet", props: { name: "Button" } });
    const variant = change("v", { kind: "create", tag: "Component", parent: "set", props: { variant: { Size: "S" } } });
    const byRef = new Map([["set", set]]);

    planned.record(set, byRef);
    planned.record(variant, byRef);

    expect(planned.has("Button")).toBe(true);
    expect(planned.missingVariant("Button", { Size: "S" })).toBeNull();
    expect(planned.missingVariant("Button", { Size: "L" })).toBe("Button has no variant Size=L: it has Size=S.");
  });
});
