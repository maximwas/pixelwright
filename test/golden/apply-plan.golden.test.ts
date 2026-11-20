import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ApplyElement } from "@/core/apply/apply.types.ts";
import { CHANGE_OF } from "@/core/apply/plan/change-of.ts";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { LayerEntry, LayerNow } from "@/core/apply/plan/plan.types.ts";
import { UNCHANGED } from "@/core/apply/plan/unchanged.ts";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { ServerMain } from "@/server/main/server.main.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { CHANGE_CASES, EDIT_CASES, type NowCase } from "./cases/apply-plan.cases.ts";
import { fixture } from "./support/design-classes.ts";
import { oddTextModel } from "./support/odd-text.ts";

/** The server's own change and comparison halves, as the root binds them. */
const container = new ServerMain({
  home: mkdtempSync(join(tmpdir(), "pixelwright-apply-plan-")),
  logLevel: "silent",
  pluginBridge: false,
  bridgePort: 0,
  pluginOrigins: [],
  projectDir: tmpdir(),
}).container();
const changeOf = container.get(CHANGE_OF);
const unchanged = container.get(UNCHANGED);
const design = container.get(DESIGN_XML);
const reader = new ApplyRead();

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
/**
 * D-19: the one edit 0.9.0 answers on purpose otherwise. Unchanged judges in CSS space, so the layer's own colour in
 * lower case is held and nothing is written; 0.7.0 compared the text, held only id and wrote the fills again.
 */
const KNOWN = "the layer's hex colour in lower case";

const golden = (name: string) => readFileSync(new URL(`./__golden__/${name}`, import.meta.url), "utf8");

/** The reads edits are sent against, by the name their goldens carry. */
const MODELS: Readonly<Record<string, () => ReadModel>> = {
  "orbit-customers": () => fixture("orbit-customers"),
  "orbit-plans": () => fixture("orbit-plans"),
  "orbit-pricing": () => fixture("orbit-pricing"),
  "orbit-pricing.p3": () => ({ ...fixture("orbit-pricing"), colorProfile: "DISPLAY_P3" }),
};

/**
 * design_apply's planning as 0.7.0 did it, byte for byte (C-196..C-198): every change case's changes with their sources
 * and errors, what a layer holds of every edit sent against it and the change left to write, and what each layer of
 * the odd-text read holds of the read sent back.
 */
describe("golden apply plan", () => {
  it("keeps every case's changes, the attribute each property came from, and their errors", () => {
    const changes = Object.fromEntries(
      Object.entries(CHANGE_CASES).map(([name, { xml, now }]) => {
        const { elements, errors } = reader.read(xml);

        // A change case is about the translation: what the reader refuses belongs to the read cases.
        expect(errors, name).toEqual([]);
        expect(elements.length, name).toBeGreaterThan(0);

        return [name, elements.map((element, index) => changeOf.of(element, index === 0 ? layerNow(now) : undefined))];
      }),
    );

    expect(Object.keys(changes)).toHaveLength(93);
    expect(json(changes)).toBe(golden("apply-changes.json"));
  });

  it("keeps what a layer holds of an edit sent against it, and the change left to write", () => {
    const edits = Object.fromEntries(
      Object.entries(EDIT_CASES).map(([name, { snapshot, xml }]) => {
        const layers = CurrentLayers.of([MODELS[snapshot]?.() ?? oddTextModel()], []);
        const { elements, errors } = reader.read(xml);

        expect(errors, name).toEqual([]);

        return [
          name,
          elements.map((element) => {
            const now = unchanged.of(element, entryOf(layers, element));

            return { held: heldView(now), ...changeOf.of(element, now) };
          }),
        ];
      }),
    );

    const [known] = edits[KNOWN] ?? [];

    expect(Object.keys(edits)).toHaveLength(20);
    expect([known?.held.attributes, known?.change.props, known?.change.sources]).toEqual([
      ["background", "id"],
      {},
      {},
    ]);
    expect(json({ ...edits, [KNOWN]: JSON.parse(golden("apply-edits.json"))[KNOWN] })).toBe(golden("apply-edits.json"));
  });

  // C-173, K-020: a style's values are the same CSS as a layer's, so they plan through the same writers.
  it("plans a style's values through the writers a layer's go through", () => {
    const styles = [
      ["Text", { font: "700 16px/24px 'Inter'", "letter-spacing": "0.1em", "text-transform": "uppercase" }],
      ["Frame", { background: "#F00" }],
      ["Frame", { "box-shadow": "0 1px 2px #000", filter: "blur(4px)" }],
    ] as const;

    for (const [tag, attributes] of styles) {
      const xml = `<${tag} id="1:1" ${Object.entries(attributes)
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ")}/>`;
      const [element] = reader.read(xml).elements;
      const layer = element === undefined ? undefined : changeOf.of(element).change.props;

      expect(changeOf.attributesProps(tag, attributes)).toEqual({ props: layer, errors: [] });
    }

    expect(changeOf.attributesProps("Text", { font: "huge" }).errors).toEqual([
      'font="huge" is not "[italic] weight size/line-height \'Family\'".',
    ]);
  });

  // Each layer compared twice: as an element of the whole read, and alone, as the top of its own read.
  it("keeps what each odd-text layer holds of the read, and of its own read", () => {
    const model = oddTextModel();
    const layers = CurrentLayers.of([model], []);
    const held = Object.fromEntries(
      readBack(model).map((element) => {
        const entry = entryOf(layers, element);
        const [alone] = readBack({ ...model, root: entry.layer });

        if (alone === undefined) {
          throw new Error(`the read of ${entry.layer.id} has no element`);
        }

        return [
          entry.layer.id,
          { inRead: heldView(unchanged.of(element, entry)), alone: heldView(unchanged.of(alone, entry)) },
        ];
      }),
    );

    expect(json(held)).toBe(golden("odd-text.unchanged.json"));
  });
});

/** design_read's XML of a read as design_apply reads it back: it reads without an error. */
function readBack(model: ReadModel): ApplyElement[] {
  const { elements, errors } = reader.read(design.read(model).xml);

  expect(errors).toEqual([]);

  return elements;
}

/** The layer an element names in the read: every element these goldens compare names one. */
function entryOf(layers: CurrentLayers, element: ApplyElement): LayerEntry {
  const entry = element.id === null ? undefined : layers.entry(element.id);

  if (entry === undefined) {
    throw new Error(`<${element.tag}> at line ${element.line} names no layer of the read`);
  }

  return entry;
}

function heldView({ attributes, text, visible, current }: LayerNow) {
  return { attributes: [...attributes].sort(), text, visible, current };
}

/** A case's `now` as Unchanged gives it: nothing held, the text not read, the layer shown, unless it says. */
function layerNow(now: NowCase | undefined): LayerNow | undefined {
  return now === undefined
    ? undefined
    : {
      attributes: new Set(now.unchanged ?? []),
      text: now.text ?? false,
      visible: now.visible ?? true,
      current: now.current ?? {},
    };
}
