import { INFERRED_GROUPS, INFERRED_WORDS } from "@pixelwright/core";
import { plain } from "../../../utils/plain.ts";
import { STYLE_ID_FIELDS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";
import { isFilled, type References } from "../references.ts";

/** The styles the layer uses, the variables bound to its fields, and those Figma matches its raw values to. */
export function readTokens(entry: LayerEntry): void {
  const { layer, context } = entry;

  for (const key of STYLE_ID_FIELDS) {
    entry.put(key, layer[key], "");
  }

  if (isFilled(layer.boundVariables)) {
    entry.set("boundVariables", plain(layer.boundVariables));
  }

  const inferred = context.inferred ? inferredOf(layer, context.references) : {};

  if (Object.keys(inferred).length > 0) {
    entry.set("inferred", inferred);
  }
}

/**
 * Figma's own variable match for the layer's unbound spacing, radius, stroke and opacity fields, where it found exactly
 * one variable; each joins the read's variables.
 */
function inferredOf(layer: SceneNode & Record<string, unknown>, references: References): Record<string, string> {
  const matches = layer.inferredVariables as Record<string, unknown> | undefined;
  const bound = (layer.boundVariables ?? {}) as Record<string, unknown>;
  const inferred: Record<string, string> = {};
  // A field is bound when it, or a field bound together with it (a radius and its corners), has a variable.
  const isBound = (field: string) =>
    (INFERRED_GROUPS.find((group) => group.includes(field)) ?? [field]).some((member) => bound[member] !== undefined);

  for (const field of Object.keys(INFERRED_WORDS)) {
    const found = matches?.[field];

    if (Array.isArray(found) && found.length === 1 && !isBound(field)) {
      const [alias] = found as { id?: unknown }[];

      if (typeof alias?.id === "string") {
        inferred[field] = alias.id;
        references.useVariable(alias.id, layer);
      }
    }
  }

  return inferred;
}
