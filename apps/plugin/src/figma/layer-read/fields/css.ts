import { MIXED } from "@pixelwright/core";
import { MAPPED_EFFECTS, MAPPED_PAINTS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** Figma's own CSS for the layer: for every layer, or only where core cannot write the CSS itself yet. */
export async function readCss(entry: LayerEntry): Promise<void> {
  const { node, context } = entry;

  if ((context.css === "all" || (context.css === "unmapped" && needsOracle(entry.fields()))) && "getCSSAsync" in node) {
    entry.set("css", await node.getCSSAsync());
  }
}

/** Whether a layer has what core cannot write as CSS yet, so Figma's own CSS is worth its time. */
function needsOracle(entry: Readonly<Record<string, unknown>>): boolean {
  const paints = (value: unknown) =>
    value === MIXED ||
    (Array.isArray(value) && value.some((paint: { type: string }) => !MAPPED_PAINTS.has(paint.type)));
  const effects = Array.isArray(entry.effects) ? (entry.effects as { type: string; blurType?: string }[]) : [];
  const segments = (entry.text as { segments?: { fills: unknown }[] } | undefined)?.segments ?? [];

  return (
    paints(entry.fills) ||
    paints(entry.strokes) ||
    entry.blendMode !== undefined ||
    effects.some((effect) => !MAPPED_EFFECTS.has(effect.type) || effect.blurType === "PROGRESSIVE") ||
    segments.some((segment) => paints(segment.fills))
  );
}
