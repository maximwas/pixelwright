import type { EffectSpec, FigmaProps, StrokeSpec } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import {
  type FillsNode,
  hasEffects,
  hasFills,
  hasStrokeSides,
  hasStrokes,
  refusal,
  type StrokesNode,
  type TypedLayer,
} from "../../../figma/capabilities.ts";
import { effectsOf, mergedEffects } from "../../../figma/effects.ts";
import { opacitiesAgain, paintsOf, samePaints } from "../../../figma/paints.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { guarded, type Step } from "./step.ts";
import type { WriteScope } from "./write-scope.ts";

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

/** The layer's paints, then its effects: Figma's order. */
export const PAINT_STEPS: readonly Step[] = [
  {
    keys: ["fills"],
    ...guarded(hasFills, "fills", fills),
  },
  {
    keys: ["strokes"],
    ...guarded(hasStrokes, "strokes", strokes),
    // Strokes per side are only some layers': the write refuses the rest once it has the stroke.
    check: (node, { strokes: spec }) => {
      if (!hasStrokes(node)) {
        throw refusal(node, "strokes");
      }

      if (spec !== undefined && sided(spec, node) && !hasStrokeSides(node)) {
        throw refusal(node, "stroke weight per side");
      }
    },
  },
  {
    keys: ["effects"],
    write: effects,
    check: (node) => {
      if (!hasEffects(node)) {
        throw refusal(node, "effects");
      }
    },
  },
];

/** Whether a stroke is given per side: a weight for each side, which only some layers take. */
function sided(spec: StrokeSpec, node: TypedLayer): boolean {
  return spec.paints.length > 0 && spec.weight === undefined && node.type !== "LINE" && spec.sides !== undefined;
}

async function fills(node: FillsNode, { fills: specs }: FigmaProps, scope: WriteScope): Promise<void> {
  const paints = await paintsOf(specs ?? [], scope, node);

  if ("style" in paints) {
    if (node.fillStyleId !== paints.style) {
      await node.setFillStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.fillStyleId === "string" && node.fillStyleId !== "") ||
    !samePaints(node.fills, paints.paints)
  ) {
    node.fills = paints.paints;

    const again = opacitiesAgain(node.fills as readonly Paint[], paints.paints);

    if (again !== null) {
      node.fills = again;
    }
  }
}

async function strokes(node: StrokesNode, { strokes: spec }: FigmaProps, scope: WriteScope): Promise<void> {
  if (spec === undefined) {
    return;
  }

  // Refused before the paint is written: a stroke this layer cannot weigh per side is not half written.
  if (sided(spec, node)) {
    sidedNode(node);
  }

  const paints = await paintsOf(spec.paints, scope, node);

  if ("style" in paints) {
    if (node.strokeStyleId !== paints.style) {
      await node.setStrokeStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.strokeStyleId === "string" && node.strokeStyleId !== "") ||
    !samePaints(node.strokes, paints.paints)
  ) {
    node.strokes = paints.paints;

    const again = opacitiesAgain(node.strokes, paints.paints);

    if (again !== null) {
      node.strokes = again;
    }
  }

  if (spec.paints.length > 0) {
    strokeShape(node, spec);
  }
}

/** The stroke's weight (one, or per side), its alignment and its dashes. */
function strokeShape(node: StrokesNode, spec: StrokeSpec): void {
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
function strokeWeights(node: StrokesNode, { weight, sides }: StrokeSpec): void {
  if (weight !== undefined || node.type === "LINE") {
    assign(node, "strokeWeight", weight ?? Math.max(sides?.top ?? 0, sides?.left ?? 0, 0));

    return;
  }

  if (sides === undefined) {
    return;
  }

  const sided = sidedNode(node);

  // Every side, an equal one too: the first side set gives the layer weights per side and Figma starts the others at
  // 0, so a top side skipped for already reading 1 (a new frame's strokeWeight) ended at 0.
  for (const side of SIDES) {
    sided[`stroke${side}Weight`] = sides[side.toLowerCase() as "top" | "right" | "bottom" | "left"];
  }
}

/** A layer with a stroke weight per side, or the refusal of one without. */
function sidedNode(node: StrokesNode): Extract<StrokesNode, { strokeTopWeight: number }> {
  if (!hasStrokeSides(node)) {
    throw refusal(node, "stroke weight per side");
  }

  return node;
}

async function effects(node: SceneNode, { effects: spec }: FigmaProps, scope: WriteScope): Promise<void> {
  if (spec === undefined) {
    return;
  }

  if (!hasEffects(node)) {
    throw refusal(node, "effects");
  }

  if (Array.isArray(spec)) {
    const current: readonly Effect[] = Array.isArray(node.effects) ? node.effects : [];

    assign(node, "effects", mergedEffects(current, await effectsOf(spec as readonly EffectSpec[], scope, node)));

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
