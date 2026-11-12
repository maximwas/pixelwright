import type { RawTokens } from "../../src/tokens/raw-tokens.ts";
import type { Snapshot, SnapshotNode } from "../../src/types/snapshot.ts";

/** color/brand after the designer's edit: #4433EE. */
export const EDITED_BRAND = {
  r: 0x44 / 255,
  g: 0x33 / 255,
  b: 0xee / 255,
  a: 1,
};

const BRAND = "VariableID:54:153";
const SPACE_8 = "VariableID:54:160";

/** A read's tokens as raw tokens: one collection, one mode, each variable at the value the read gives it. */
export function rawTokensOf(snapshot: Snapshot): RawTokens {
  return {
    collections: [
      {
        id: "VC:orbit",
        name: "Orbit",
        remote: false,
        defaultModeId: "M:1",
        modes: [
          {
            modeId: "M:1",
            name: "Default",
          },
        ],
      },
    ],
    variables: Object.entries(snapshot.variables).map(([id, variable]) => ({
      id,
      name: variable.name,
      collectionId: "VC:orbit",
      resolvedType: variable.resolvedType,
      scopes: [],
      valuesByMode: { "M:1": variable.value },
    })),
    external: {},
    styles: [],
  };
}

/** The Orbit pricing read with every Icon/Check drawing hashed as this version of the icon. */
export function withIconPaths(snapshot: Snapshot, version: string): Snapshot {
  const copy = structuredClone(snapshot);

  for (const node of layersOf(copy.root)) {
    if (node.type === "VECTOR" && node.name === "Check") {
      node.pathHash = `check-${version}`;
    }
  }

  return copy;
}

/**
 * The designer's illustrative edits to Orbit's pricing page since a baseline was saved: the footnote and the Pro price,
 * the features' gap in all three cards, the check icon redrawn, the sticker removed, a trial line added, the nav
 * reordered, and color/brand's value.
 */
export function editedPricing(snapshot: Snapshot): Snapshot {
  const copy = withIconPaths(snapshot, "v2");
  const node = (id: string) => {
    const found = layersOf(copy.root).find((layer) => layer.id === id);

    if (found === undefined) {
      throw new Error(`The Orbit fixture has no ${id}.`);
    }

    return found;
  };
  const footnote = node("54:316");

  if (footnote.text !== undefined) {
    footnote.text.characters = "Prices in USD, billed yearly.";
    footnote.text.segments = footnote.text.segments.map((segment) => ({
      ...segment,
      characters: "Prices in USD, billed yearly.",
      end: 29,
    }));
  }

  const pro = node("54:268").instance;

  if (pro !== undefined) {
    pro.properties["Price#54:9"] = {
      type: "TEXT",
      value: "$14",
    };
  }

  for (const card of ["I54:244;54:213", "I54:268;54:213", "I54:292;54:213"]) {
    const features = node(card);

    features.itemSpacing = 8;
    features.boundVariables = {
      ...features.boundVariables,
      itemSpacing: {
        type: "VARIABLE_ALIAS",
        id: SPACE_8,
      },
    };
  }

  removeChild(node("54:434"), "54:450");
  addTrial(node("54:239"), node("54:242"));
  swapFirstTwo(node("54:232"));
  copy.variables[BRAND] = {
    ...(copy.variables[BRAND] ?? {
      name: "color/brand",
      collection: "Orbit",
      resolvedType: "COLOR",
      remote: false,
    }),
    value: EDITED_BRAND,
  };

  return copy;
}

function layersOf(root: SnapshotNode): SnapshotNode[] {
  return [root, ...(root.children ?? []).flatMap(layersOf)];
}

function removeChild(parent: SnapshotNode, id: string): void {
  parent.children = (parent.children ?? []).filter((child) => child.id !== id);
  parent.childCount = parent.children.length;
}

/** A trial line under the lede, as the lede is set. */
function addTrial(copy: SnapshotNode, lede: SnapshotNode): void {
  const trial = structuredClone(lede);

  trial.id = "61:12";
  trial.name = "Trial";

  if (trial.text !== undefined) {
    trial.text.characters = "14-day free trial of Pro.";
    trial.text.segments = trial.text.segments.slice(0, 1).map((segment) => ({
      ...segment,
      characters: "14-day free trial of Pro.",
      start: 0,
      end: 25,
    }));
  }

  copy.children = [...(copy.children ?? []), trial];
  copy.childCount = copy.children.length;
}

function swapFirstTwo(parent: SnapshotNode): void {
  const [first, second, ...rest] = parent.children ?? [];

  if (first !== undefined && second !== undefined) {
    parent.children = [second, first, ...rest];
  }
}
