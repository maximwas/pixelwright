import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PLACEMENT_SPAN } from "@/core/kernel/geometry/placement-span.ts";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_PLACE, APPLY_TEXT, NEW_LAYER_VALUE } from "@/plugin/operations/apply/apply.constants.ts";
import type { Place } from "@/plugin/operations/apply/apply.types.ts";
import type { Origins } from "@/plugin/operations/apply/origins.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import { INTENT_LAYOUT_MODE, INTENT_SELF_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Axis = typeof INTENT_LAYOUT_MODE.HORIZONTAL | typeof INTENT_LAYOUT_MODE.VERTICAL;

/**
 * New layers (T-123): made, put in their parent at once (taken away again when Figma refuses them there) and started
 * bare, with what the XML says and nothing more: no fill without a background, no clipping without overflow; once
 * written, a new auto layout frame hugs what the XML did not size and a layer on the page goes beside the others.
 */
@injectable()
export class NewLayers {
  readonly #factory;
  readonly #assign;
  readonly #capabilities;
  readonly #span;

  constructor(
    factory = inject(LAYER_FACTORY),
    assign = inject(ASSIGN),
    capabilities = inject(CAPABILITIES),
    span = inject(PLACEMENT_SPAN),
  ) {
    this.#factory = factory;
    this.#assign = assign;
    this.#capabilities = capabilities;
    this.#span = span;
  }

  create(
    type: NodeType,
    change: ApplyChangeData,
    place: Place,
  ): SceneNode {
    const node = this.#placed(this.#made(type, change, place.parent), place);

    try {
      this.#bare(node, change.props);
    } catch (error) {
      this.discard(node);

      throw error;
    }

    return node;
  }

  /** A clone of the source with all it has, XML or not (T-126), at its place; taken away when Figma refuses it there. */
  copy(source: SceneNode, place: Place): SceneNode {
    return this.#placed(source.clone(), place);
  }

  /** An instance of its component and variant (T-127), at its place, as its component made it: nothing started bare. */
  async instance(change: ApplyChangeData, place: Place): Promise<SceneNode> {
    const { component = "", variant = {} } = change.props;

    return this.#placed(await this.#factory.instance(component, variant), place);
  }

  /**
   * After its write: a new auto layout frame hugs the axes the XML did not size; on the page it goes beside the rest.
   * A refusal is thrown as it is and the caller takes the layer away: a new set holds the Components the call moved
   * into it by now, which go back first (PendingSets).
   */
  finish(node: SceneNode, props: FigmaProps): void {
    this.#hug(node, props);
    this.#placeOnPage(node, props);
  }

  /**
   * A new set: the Components its frame holds combined in its place, the frame gone once no layer that was there
   * before the call is in it (those go back where they stood first; when one cannot, the frame stays and says so).
   */
  combine(holder: SceneNode, origins: Origins): ComponentSetNode {
    const frame = holder as FrameNode;
    const components = frame.children.filter(
      (child): child is ComponentNode => child.type === FIGMA_NODE_TYPE.component,
    );
    const parent = frame.parent;

    if (components.length === 0 || parent === null) {
      this.#clear(frame, origins);

      throw new WriteError(APPLY_TEXT.emptySet);
    }

    const set = this.#factory.combine(components, parent, parent.children.indexOf(frame));

    this.#clear(frame, origins);
    this.#assign.set(set as ComponentSetNode, { fills: [], strokes: [] });

    return set;
  }

  /** A layer that failed after it existed goes, so a failed element leaves nothing in the user's file. */
  discard(node: SceneNode): void {
    if (!node.removed) {
      node.remove();
    }
  }

  /** The frame goes with what is left in it, after the layers of the user's that the call moved into it went back. */
  #clear(frame: FrameNode, origins: Origins): void {
    try {
      origins.restore(frame);
    } catch (error) {
      throw new WriteError(APPLY_TEXT.keptHeld(error), APPLY_TEXT.keptHeldHint);
    }

    frame.remove();
  }

  /** A new layer put in its parent at once; taken away again when Figma refuses it there. */
  #placed(node: SceneNode, { parent, index }: Place): SceneNode {
    try {
      parent.insertChild(index, node);
    } catch (error) {
      this.discard(node);

      throw error;
    }

    return node;
  }

  /** The layer of the type: a slot in its component, an Icon drawn from its SVG (T-131), a TextPath along its path, else a bare one. */
  #made(
    type: NodeType,
    change: ApplyChangeData,
    parent: Place["parent"],
  ): SceneNode {
    const svg = change.props.asset?.svg;

    if (type === FIGMA_NODE_TYPE.slot) {
      return (parent as ComponentNode).createSlot();
    }

    if (type === FIGMA_NODE_TYPE.textPath) {
      // The planner sends a new TextPath only with its path (C-179).
      return this.#factory.textPath(change.props.path ?? "", change.props.pathStart);
    }

    return svg === undefined ? this.#factory.make(type, APPLY_TEXT.cannotMake(change.tag)) : this.#factory.icon(svg);
  }

  #bare(node: SceneNode, props: FigmaProps): void {
    const shape = node as FrameNode;

    if (
      props.fills === undefined &&
      !this.#capabilities.has(node, CAPABILITY.text) &&
      this.#capabilities.has(node, CAPABILITY.fills)
    ) {
      this.#assign.set(shape, { fills: [] });
    }

    if (props.strokes === undefined && node.type === FIGMA_NODE_TYPE.line) {
      this.#assign.set(shape, { strokes: [] });
    }

    if (props.clipsContent === undefined && node.type === FIGMA_NODE_TYPE.frame) {
      this.#assign.set(shape, { clipsContent: false });
    }

    if (node.type === FIGMA_NODE_TYPE.text) {
      this.#assign.set(node, { textAutoResize: NEW_LAYER_VALUE.fit });
    }
  }

  #hug(node: SceneNode, props: FigmaProps): void {
    const frame = node as FrameNode;

    // An instance keeps its component's sizing.
    if (
      node.type === FIGMA_NODE_TYPE.instance ||
      !this.#capabilities.has(node, CAPABILITY.autoLayout) ||
      frame.layoutMode === NEW_LAYER_VALUE.none
    ) {
      return;
    }

    // A page or a section has no layoutMode: undefined, so nothing lays the layer out.
    const direction: unknown = (node.parent as FrameNode | null)?.layoutMode;

    this.#assign.set(frame, {
      layoutSizingHorizontal:
        props.width === undefined && !this.#fills(props, direction, INTENT_LAYOUT_MODE.HORIZONTAL)
          ? NEW_LAYER_VALUE.hug
          : undefined,
      layoutSizingVertical:
        props.height === undefined && !this.#fills(props, direction, INTENT_LAYOUT_MODE.VERTICAL)
          ? NEW_LAYER_VALUE.hug
          : undefined,
    });
  }

  /** Whether the layer fills the axis: flex along its parent, stretched across it or in a grid cell, or pinned to both edges. */
  #fills(
    props: FigmaProps,
    direction: unknown,
    axis: Axis,
  ): boolean {
    const horizontal = axis === INTENT_LAYOUT_MODE.HORIZONTAL;
    const across = horizontal ? INTENT_LAYOUT_MODE.VERTICAL : INTENT_LAYOUT_MODE.HORIZONTAL;
    const stretched =
      direction === INTENT_LAYOUT_MODE.GRID
        ? (horizontal ? props.justifySelf : props.alignSelf) === INTENT_SELF_ALIGN.STRETCH
        : props.alignSelf === INTENT_SELF_ALIGN.STRETCH && direction === across;
    const placed = horizontal ? props.horizontal : props.vertical;

    return ((props.grow ?? false) && direction === axis) || stretched || this.#span.sizes(placed);
  }

  #placeOnPage(node: SceneNode, props: FigmaProps): void {
    const parent = node.parent;

    if (parent?.type !== FIGMA_NODE_TYPE.page || props.horizontal !== undefined) {
      return;
    }

    const others = parent.children.filter((child) => child.id !== node.id);
    const right = Math.max(...others.map((child) => child.x + child.width), -APPLY_PLACE.pageGap);

    this.#assign.set(node, {
      x: Math.round(right + APPLY_PLACE.pageGap),
      y: Math.round(Math.min(...others.map((child) => child.y), 0)),
    });
  }
}

export const NEW_LAYERS = new InjectionToken<NewLayers>("NewLayers");
