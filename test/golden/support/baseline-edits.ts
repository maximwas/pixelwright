import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** color/brand after the designer's edit: #4433EE. */
const EDITED_BRAND = { r: 0x44 / 255, g: 0x33 / 255, b: 0xee / 255, a: 1 };

const BRAND = "VariableID:54:153";
const SPACE_8 = "VariableID:54:160";

/** A read's tokens as raw tokens: one collection, one mode, each variable at the value the read gives it. */
export function rawTokensOf(model: ReadModel): RawTokens {
  return {
    collections: [
      {
        id: "VC:orbit",
        name: "Orbit",
        remote: false,
        defaultModeId: "M:1",
        modes: [{ modeId: "M:1", name: "Default" }],
      },
    ],
    variables: Object.entries(model.variables).map(([id, variable]) => ({
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
export function withIconPaths(model: ReadModel, version: string): ReadModel {
  const copy = structuredClone(model);

  for (const layer of layersOf(copy.root)) {
    if (layer.type === "VECTOR" && layer.name === "Check") {
      layer.pathHash = `check-${version}`;
    }
  }

  return copy;
}

/**
 * The designer's illustrative edits to Orbit's pricing page since a baseline was saved: the footnote and the Pro price,
 * the features' gap in all three cards, the check icon redrawn, the sticker removed, a trial line added, the nav
 * reordered, and color/brand's value.
 */
export function editedPricing(model: ReadModel): ReadModel {
  const copy = withIconPaths(model, "v2");
  const layer = (id: string) => {
    const found = layersOf(copy.root).find((each) => each.id === id);

    if (found === undefined) {
      throw new Error(`The Orbit fixture has no ${id}.`);
    }

    return found;
  };
  const footnote = layer("54:316");

  if (footnote.text !== undefined) {
    footnote.text.characters = "Prices in USD, billed yearly.";
    footnote.text.segments = footnote.text.segments.map((segment) => ({
      ...segment,
      characters: "Prices in USD, billed yearly.",
      end: 29,
    }));
  }

  const pro = layer("54:268").instance;

  if (pro !== undefined) {
    pro.properties = { ...pro.properties, "Price#54:9": { type: "TEXT", value: "$14" } };
  }

  for (const card of ["I54:244;54:213", "I54:268;54:213", "I54:292;54:213"]) {
    const features = layer(card);

    features.itemSpacing = 8;
    features.boundVariables = { ...features.boundVariables, itemSpacing: { type: "VARIABLE_ALIAS", id: SPACE_8 } };
  }

  removeChild(layer("54:434"), "54:450");
  addTrial(layer("54:239"), layer("54:242"));
  swapFirstTwo(layer("54:232"));

  const brand = copy.variables[BRAND];

  if (brand !== undefined) {
    copy.variables[BRAND] = { ...brand, value: EDITED_BRAND };
  }

  return copy;
}

function layersOf(root: ReadLayer): ReadLayer[] {
  return [root, ...(root.children ?? []).flatMap(layersOf)];
}

function removeChild(parent: ReadLayer, id: string): void {
  parent.children = (parent.children ?? []).filter((child) => child.id !== id);
  parent.childCount = parent.children.length;
}

/** A trial line under the lede, as the lede is set. */
function addTrial(copy: ReadLayer, lede: ReadLayer): void {
  const trial = structuredClone(lede);

  trial.id = "61:12";
  trial.name = "Trial";

  if (trial.text !== undefined) {
    trial.text.characters = "14-day free trial of Pro.";
    trial.text.segments = trial.text.segments
      .slice(0, 1)
      .map((segment) => ({ ...segment, characters: "14-day free trial of Pro.", start: 0, end: 25 }));
  }

  copy.children = [...(copy.children ?? []), trial];
  copy.childCount = copy.children.length;
}

function swapFirstTwo(parent: ReadLayer): void {
  const [first, second, ...rest] = parent.children ?? [];

  if (first !== undefined && second !== undefined) {
    parent.children = [second, first, ...rest];
  }
}
