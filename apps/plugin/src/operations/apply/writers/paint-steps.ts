import type { EffectSpec, FigmaProps, StrokeSpec } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { type FilledNode, hasStrokeSides, isBlended, isFilled, refusal } from "../../../figma/capabilities.ts";
import { effectsOf, mergedEffects } from "../../../figma/effects.ts";
import { paintsOf, samePaints } from "../../../figma/paints.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { guarded, type Step } from "./step.ts";
import type { WriteScope } from "./write-scope.ts";

type Filled = FilledNode;

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

/** The layer's paints, then its effects: Figma's order. */
export const PAINT_STEPS: readonly Step[] = [
  {
    keys: ["fills"],
    write: guarded(isFilled, "fills", fills),
  },
  {
    keys: ["strokes"],
    write: guarded(isFilled, "strokes", strokes),
  },
  {
    keys: ["effects"],
    write: effects,
  },
];

async function fills(node: Filled, { fills: specs }: FigmaProps, scope: WriteScope): Promise<void> {
  const paints = await paintsOf(specs ?? [], scope);

  if ("style" in paints) {
    if (node.fillStyleId !== paints.style) {
      await node.setFillStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.fillStyleId === "string" && node.fillStyleId !== "") ||
    !samePaints(node.fills, paints.paints)
  ) {
    node.fills = paints.paints;
  }
}

async function strokes(node: Filled, { strokes: spec }: FigmaProps, scope: WriteScope): Promise<void> {
  if (spec === undefined) {
    return;
  }

  const paints = await paintsOf(spec.paints, scope);

  if ("style" in paints) {
    if (node.strokeStyleId !== paints.style) {
      await node.setStrokeStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.strokeStyleId === "string" && node.strokeStyleId !== "") ||
    !samePaints(node.strokes, paints.paints)
  ) {
    node.strokes = paints.paints;
  }

  if (spec.paints.length > 0) {
    strokeShape(node, spec);
  }
}

/** The stroke's weight (one, or per side), its alignment and its dashes. */
function strokeShape(node: Filled, spec: StrokeSpec): void {
  strokeWeights(node, spec);

  // A CSS border cannot tell inside from centred: a centred stroke stays centred. A line's stroke is always centred.
  if (node.type !== "LINE" && !(spec.align === "INSIDE" && node.strokeAlign === "CENTER")) {
    assign(node, "strokeAlign", spec.align);
  }

  const dashed = Array.isArray(node.dashPattern) && node.dashPattern.length > 0;

  if (spec.dash !== dashed) {
    node.dashPattern = spec.dash ? [4, 4] : [];
  }
}

/** One weight (a line's is its border's), or a weight per side. */
function strokeWeights(node: Filled, { weight, sides }: StrokeSpec): void {
  if (weight !== undefined || node.type === "LINE") {
    assign(node, "strokeWeight", weight ?? Math.max(sides?.top ?? 0, sides?.left ?? 0, 0));

    return;
  }

  if (sides === undefined) {
    return;
  }

  if (!hasStrokeSides(node)) {
    throw refusal(node, "stroke weight per side");
  }

  for (const side of SIDES) {
    assign(node, `stroke${side}Weight`, sides[side.toLowerCase() as "top" | "right" | "bottom" | "left"]);
  }
}

async function effects(node: SceneNode, { effects: spec }: FigmaProps, scope: WriteScope): Promise<void> {
  if (spec === undefined) {
    return;
  }

  if (!isBlended(node)) {
    throw refusal(node, "effects");
  }

  if (Array.isArray(spec)) {
    const current: readonly Effect[] = Array.isArray(node.effects) ? node.effects : [];

    assign(node, "effects", mergedEffects(current, effectsOf(spec as readonly EffectSpec[])));

    return;
  }

  const token = (spec as { token: string }).token;
  const style = await (await scope.tokens()).style(token, "EFFECT");

  if (style === null) {
    throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
  }

  if (node.effectStyleId !== style) {
    await node.setEffectStyleIdAsync(style);
  }
}
