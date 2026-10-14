import { describe, expect, it } from "vitest";
import {
  type ApplyElement,
  changeOf,
  designXml,
  type LayerNow,
  readApply,
  type Snapshot,
  type SnapshotNode,
  unchangedAttributes,
  type XmlChild,
} from "../../src/index.ts";
import { CHANGE_CASES, EDIT_CASES, type NowCase, READ_CASES } from "../helpers/apply-cases.ts";
import { everyHintSnapshot } from "../helpers/every-hint.ts";
import { fixture, nodesOf } from "../helpers/fixtures.ts";
import { everyMotionSnapshot } from "../helpers/motion.ts";
import { oddTextSnapshot } from "../helpers/odd-text.ts";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The snapshots reads and edits are sent back against, by the name their goldens carry. */
const SNAPSHOTS = {
  "orbit-customers": () => fixture("orbit-customers"),
  "orbit-desktop-top": () => fixture("orbit-desktop-top"),
  "orbit-plans": () => fixture("orbit-plans"),
  "orbit-pricing": () => fixture("orbit-pricing"),
  // The pricing screen in a Display P3 file: the same numbers, read as P3.
  "orbit-pricing.p3": () => ({
    ...fixture("orbit-pricing"),
    colorProfile: "DISPLAY_P3",
  }),
  "odd-text": oddTextSnapshot,
  "every-hint": everyHintSnapshot,
  "every-motion": everyMotionSnapshot,
} satisfies Record<string, () => Snapshot>;

/**
 * design_apply's reading and translation as the code before the rewrite did them: every read case's elements and
 * errors (apply-read.json), every change case's changes with their sources and errors (apply-changes.json), and for
 * every edit sent against a snapshot's layers, what the layer already holds and the change left to write
 * (apply-edits.json). A rewrite must reproduce them byte for byte.
 */
describe("golden apply", () => {
  it("keeps what the reader makes of every case, word for word", async () => {
    const reads = Object.fromEntries(
      Object.entries(READ_CASES).map(([name, xml]) => {
        const { elements, errors } = readApply(xml);

        return [
          name,
          {
            elements: elements.map(elementView),
            errors,
          },
        ];
      }),
    );

    await expect(json(reads)).toMatchFileSnapshot("__golden__/apply-read.json");
  });

  it("keeps every case's changes, the attribute each property came from, and their errors", async () => {
    const changes = Object.fromEntries(
      Object.entries(CHANGE_CASES).map(([name, { xml, now }]) => {
        const { elements, errors } = readApply(xml);

        // A change case is about the translation: what the reader refuses belongs to the read cases.
        expect(errors, name).toEqual([]);
        expect(elements.length, name).toBeGreaterThan(0);

        return [name, elements.map((element, index) => changeOf(element, index === 0 ? layerNow(now) : undefined))];
      }),
    );

    await expect(json(changes)).toMatchFileSnapshot("__golden__/apply-changes.json");
  });

  it("keeps what a layer holds of an edit sent against it, and the change left to write", async () => {
    const edits = Object.fromEntries(
      Object.entries(EDIT_CASES).map(([name, { snapshot: named, xml }]) => {
        const snapshot = SNAPSHOTS[named]();
        const layerOf = layerFinder(snapshot);
        const { elements, errors } = readApply(xml);

        // An edit case is about the comparison: what the reader refuses belongs to the read cases.
        expect(errors, name).toEqual([]);

        return [
          name,
          elements.map((element) => {
            const now = unchangedAttributes(element, layerOf(element), snapshot);

            return {
              held: heldView(now),
              ...changeOf(element, now),
            };
          }),
        ];
      }),
    );

    await expect(json(edits)).toMatchFileSnapshot("__golden__/apply-edits.json");
  });
});

/**
 * What each layer already holds of a read sent back (unchangedAttributes): the element's attributes it has, sorted,
 * whether its text reads the same, whether it shows, and what design_read writes for it in its parent. Each layer is
 * compared twice: as an element of the whole read (nested ones only as their parent holds them), and alone, as the
 * top of its own read, compared as that read's root and in its parent, as design_apply compares a top-level element.
 * For the four Orbit fixtures, the pricing screen in a Display P3 file, and the odd-text, every-hint and every-motion
 * snapshots.
 */
describe.each(Object.entries(SNAPSHOTS))("golden unchanged (%s)", (name, snapshotOf) => {
  it("keeps what each layer already holds of the read, and of its own read", async () => {
    const snapshot = snapshotOf();
    const layerOf = layerFinder(snapshot);
    const held = Object.fromEntries(
      readBack(snapshot).map((element) => {
        const layer = layerOf(element);
        const alone = topOf({
          ...snapshot,
          root: layer.node,
        });

        return [
          layer.node.id,
          {
            inRead: heldView(unchangedAttributes(element, layer, snapshot)),
            alone: heldView(unchangedAttributes(alone, layer, snapshot)),
          },
        ];
      }),
    );

    await expect(json(held)).toMatchFileSnapshot(`__golden__/${name}.unchanged.json`);
  });
});

/** design_read's XML of a snapshot as design_apply reads it back: it reads without an error. */
function readBack(snapshot: Snapshot): ApplyElement[] {
  const { elements, errors } = readApply(designXml(snapshot).xml);

  expect(errors).toEqual([]);

  return elements;
}

/** A layer with the parent it sits in, as design_apply's entries give it. */
type Layer = { node: SnapshotNode; parent: SnapshotNode | null };

/** The layer an element names in the snapshot: every element these goldens compare names one. */
function layerFinder(snapshot: Snapshot): (element: ApplyElement) => Layer {
  const layers = new Map(nodesOf(snapshot).map((entry) => [entry.node.id, entry]));

  return (element) => {
    const layer = element.id === null ? undefined : layers.get(element.id);

    if (layer === undefined) {
      throw new Error(`<${element.tag}> at line ${element.line} names no layer of the snapshot`);
    }

    return layer;
  };
}

/** The element at the top of a snapshot's read: its root's. */
function topOf(snapshot: Snapshot): ApplyElement {
  const [top] = readBack(snapshot);

  if (top === undefined) {
    throw new Error(`the read of ${snapshot.root.id} has no element`);
  }

  return top;
}

function heldView({ attributes, text, visible, current }: LayerNow) {
  return {
    attributes: [...attributes].sort(),
    text,
    visible,
    current,
  };
}

/** A case's `now` as unchangedAttributes gives it: nothing held, the text not read, the layer shown, unless it says. */
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

/**
 * An element as the golden keeps it: a Text's content as the pieces design_apply writes (a text, or a span's
 * attributes and characters, each where it starts), so the golden pins what the reader reads, not how it holds it.
 */
function elementView(element: ApplyElement) {
  return element.content === undefined
    ? element
    : {
        ...element,
        content: element.content.map(pieceOf),
      };
}

function pieceOf(child: XmlChild) {
  return child.kind === "text"
    ? {
        line: child.line,
        column: child.column,
        kind: "text",
        value: child.value,
      }
    : {
        line: child.line,
        column: child.column,
        kind: "span",
        attributes: child.props,
        value: charactersOf(child.children),
      };
}

function charactersOf(children: readonly XmlChild[]): string {
  return children.map((child) => (child.kind === "text" ? child.value : charactersOf(child.children))).join("");
}
