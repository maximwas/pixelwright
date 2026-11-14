import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { STEP_GEOMETRY } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { type ResolvedLength, STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import {
  AXIS_FIELDS,
  LAYOUT_POSITIONING,
  LAYOUT_SIZING,
  SIZE_AXIS,
  SIZE_NUMBER,
  STEP_KEYS,
  TEXT_AUTO_RESIZE,
  WRITERS_TEXT,
} from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_HUG } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Axis = (typeof SIZE_AXIS)[keyof typeof SIZE_AXIS];

/**
 * Where the layer flows in its parent's auto layout, then its width and height (P-150): pixels, or hugging (auto). A
 * size of its own fixes that axis alone, the other keeps hugging or filling, and a token binds its number variable
 * (T-135); a section is sized in pixels only, refused otherwise on either run, a line by its length, upright when
 * written by its height.
 */
@injectable()
export class SizeStep implements WriteStep {
  readonly keys = STEP_KEYS.size;
  readonly capability = CAPABILITY.size;
  readonly #assign;
  readonly #values;
  readonly #geometry;

  constructor(
    assign = inject(ASSIGN),
    values = inject(STEP_VALUES),
    geometry = inject(STEP_GEOMETRY),
  ) {
    this.#assign = assign;
    this.#values = values;
    this.#geometry = geometry;
  }

  /** What a section refuses and the tokens a size names, found without writing. */
  async check({ width, height, modes }: FigmaProps, layer: TypedLayer): Promise<void> {
    const sizes = [width, height];

    if (layer.type === FIGMA_NODE_TYPE.section) {
      if (sizes.includes(INTENT_HUG)) {
        throw new WriteError(WRITERS_TEXT.sectionHug);
      }

      if (sizes.some((size) => typeof size === "object")) {
        throw new WriteError(WRITERS_TEXT.sectionToken);
      }
    }

    await this.#values.check(
      { width: width === INTENT_HUG ? undefined : width, height: height === INTENT_HUG ? undefined : height },
      { layer, modes },
    );
  }

  async write(node: SceneNode, props: FigmaProps): Promise<void> {
    const { absolute } = props;
    const lengths = await this.#values.resolve(
      {
        width: props.width === INTENT_HUG ? undefined : props.width,
        height: props.height === INTENT_HUG ? undefined : props.height,
      },
      { layer: node, modes: props.modes },
    );

    // A frame without auto layout places every child itself: nothing to change there.
    if (absolute !== undefined && this.#geometry.layout(node.parent) !== null) {
      this.#assign.set(node as FrameNode, {
        layoutPositioning: absolute ? LAYOUT_POSITIONING.absolute : LAYOUT_POSITIONING.auto,
      });
    }

    for (const axis of Object.keys(AXIS_FIELDS) as Axis[]) {
      const length = lengths[axis];

      if (props[axis] === INTENT_HUG) {
        this.#hug(node, axis);
      } else if (length !== undefined) {
        this.#fix(node, axis, length);
      }
    }
  }

  /** Hugging its content (a variable bound to the size taken off): a text sizes itself to it, another layer hugs in auto layout. */
  #hug(node: SceneNode, axis: Axis): void {
    this.#values.unbind(node, axis);

    if (node.type === FIGMA_NODE_TYPE.text) {
      const both = axis === SIZE_AXIS.width || node.textAutoResize === TEXT_AUTO_RESIZE.both;

      this.#assign.set(node, { textAutoResize: both ? TEXT_AUTO_RESIZE.both : TEXT_AUTO_RESIZE.height });
    } else {
      this.#assign.set(node as FrameNode, { [AXIS_FIELDS[axis].sizing]: LAYOUT_SIZING.hug });
    }
  }

  /** A size of its own: a fixed width lets a text's height follow it, a fixed height fixes both; a variable binds it. */
  #fix(
    node: SceneNode,
    axis: Axis,
    length: ResolvedLength,
  ): void {
    if (node.type === FIGMA_NODE_TYPE.text) {
      const resize = node.textAutoResize;
      const width = resize === TEXT_AUTO_RESIZE.both ? TEXT_AUTO_RESIZE.height : resize;

      this.#assign.set(node, { textAutoResize: axis === SIZE_AXIS.height ? TEXT_AUTO_RESIZE.none : width });
    } else if (this.#geometry.layout(node) !== null || this.#geometry.layout(node.parent) !== null) {
      this.#assign.set(node as FrameNode, { [AXIS_FIELDS[axis].sizing]: LAYOUT_SIZING.fixed });
    }

    if (this.#values.bind(node, axis, length)) {
      return;
    }

    const value = typeof length === "number" ? length : 0;

    if (node.type === FIGMA_NODE_TYPE.line) {
      this.#line(node, axis, value);

      return;
    }

    const box = node as FrameNode;

    this.#geometry.resize(
      node,
      axis === SIZE_AXIS.width ? value : box.width,
      axis === SIZE_AXIS.height ? value : box.height,
    );
  }

  /** A line is as long as it is wide; a standing one is written with its height and stands upright, as read. */
  #line(
    node: LineNode,
    axis: Axis,
    value: number,
  ): void {
    if (node.width !== value) {
      node.resize(value, 0);
    }

    if (axis === SIZE_AXIS.height && !this.#geometry.standing(node)) {
      this.#geometry.turn(node, SIZE_NUMBER.standingTurn, false);
    }
  }
}
