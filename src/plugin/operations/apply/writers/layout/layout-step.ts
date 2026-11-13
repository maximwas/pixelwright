import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * A frame's auto layout: its mode first (Figma reads the gaps and alignments by it), then wrap, gaps, padding,
 * alignment and a grid's tracks (their count before their sizes) and gaps; a gap or padding may bind a number variable
 * (T-135). Every token is found before the first value is set, so the step fails whole.
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

  async check(props: FigmaProps): Promise<void> {
    await this.#values.check({
      itemSpacing: props.itemSpacing,
      counterAxisSpacing: props.counterAxisSpacing,
      padding: props.padding,
      gridColumnGap: props.gridColumnGap,
      gridRowGap: props.gridRowGap,
    });
  }

  async write(node: SceneNode, props: FigmaProps): Promise<void> {
    const [top, right, bottom, left] = props.padding ?? [];
    const values = this.#values;
    const { gridColumnGap, gridRowGap, ...gaps } = await values.resolve({
      itemSpacing: props.itemSpacing,
      counterAxisSpacing: props.counterAxisSpacing,
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
      gridColumnGap: props.gridColumnGap,
      gridRowGap: props.gridRowGap,
    });
    const frame = node as FrameNode;

    this.#assign.set(frame, { layoutMode: props.layoutMode, layoutWrap: props.layoutWrap });
    values.set(node, gaps);
    this.#assign.set(frame, {
      primaryAxisAlignItems: props.primaryAxisAlignItems,
      counterAxisAlignItems: props.counterAxisAlignItems,
      counterAxisAlignContent: props.counterAxisAlignContent,
      gridColumnCount: props.gridColumns?.length,
      gridColumnSizes: props.gridColumns?.map((track) => ({ ...track })),
      gridRowCount: props.gridRows?.length,
      gridRowSizes: props.gridRows?.map((track) => ({ ...track })),
    });
    values.set(node, { gridColumnGap, gridRowGap });
  }
}
