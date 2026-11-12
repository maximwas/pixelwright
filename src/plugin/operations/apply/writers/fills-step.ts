import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { FIGMA_PAINT, STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type PaintSpec = NonNullable<FigmaProps["fills"]>[number];

/** A layer's background as solid colours (an empty list removes it); the whole list is one step. */
@injectable()
export class FillsStep implements WriteStep {
  readonly keys = STEP_KEYS.fills;
  readonly capability = CAPABILITY.fills;
  readonly #assign;

  constructor(assign = inject(ASSIGN)) {
    this.#assign = assign;
  }

  write(node: SceneNode, { fills }: FigmaProps): void {
    this.#assign.set(node as FrameNode, { fills: fills?.map((paint) => this.#solid(paint)) });
  }

  // shortcut: colours only, in sRGB; the paint and token item writes tokens, gradients, images and P3 colours.
  #solid({ kind, color, opacity }: PaintSpec): SolidPaint {
    if (kind !== INTENT_PAINT.color || color === undefined) {
      throw new WriteError(WRITERS_TEXT.paint(kind));
    }

    if (color.space !== undefined) {
      throw new WriteError(WRITERS_TEXT.colourSpace);
    }

    return {
      type: FIGMA_PAINT.solid,
      color: { r: color.r, g: color.g, b: color.b },
      opacity: color.a * (opacity ?? 1),
    };
  }
}
