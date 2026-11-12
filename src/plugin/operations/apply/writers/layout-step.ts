import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * A frame's auto layout: its mode first (Figma reads the gaps and alignments by it), then wrap, gaps, padding and
 * alignment; every value is resolved before the first is set, so the step fails whole.
 */
@injectable()
export class LayoutStep implements WriteStep {
  readonly keys = STEP_KEYS.layout;
  readonly capability = CAPABILITY.autoLayout;
  readonly #assign;
  readonly #values;

  constructor(assign = inject(ASSIGN), values = inject(STEP_VALUES)) {
    this.#assign = assign;
    this.#values = values;
  }

  write(node: SceneNode, props: FigmaProps): void {
    const [top, right, bottom, left] = props.padding ?? [];
    const values = this.#values;

    this.#assign.set(node as FrameNode, {
      layoutMode: props.layoutMode,
      layoutWrap: props.layoutWrap,
      itemSpacing: values.number(props.itemSpacing),
      counterAxisSpacing: values.number(props.counterAxisSpacing),
      paddingTop: values.number(top),
      paddingRight: values.number(right),
      paddingBottom: values.number(bottom),
      paddingLeft: values.number(left),
      primaryAxisAlignItems: props.primaryAxisAlignItems,
      counterAxisAlignItems: props.counterAxisAlignItems,
      counterAxisAlignContent: props.counterAxisAlignContent,
    });
  }
}
