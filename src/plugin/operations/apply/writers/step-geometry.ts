import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";
import { LayerMatrix, type Matrix, type MatrixAxis } from "@/core/kernel/geometry/layer-matrix.ts";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { INTENT_LAYOUT_MODE } from "@/shared/write-intents/write-intent.constants.ts";

type LayoutMode = Exclude<FrameNode["layoutMode"], typeof INTENT_LAYOUT_MODE.NONE>;

/** What the layout and geometry steps share: a layer's or parent's layout, its resize, its turn and its centre. */
@injectable()
export class StepGeometry {
  readonly #assign;
  readonly #capabilities;

  constructor(assign = inject(ASSIGN), capabilities = inject(CAPABILITIES)) {
    this.#assign = assign;
    this.#capabilities = capabilities;
  }

  /** The layer's auto layout (a row, a column or a grid); null without one. */
  layout(node: BaseNode | null): LayoutMode | null {
    const mode = node !== null && "layoutMode" in node ? node.layoutMode : INTENT_LAYOUT_MODE.NONE;

    return mode === INTENT_LAYOUT_MODE.NONE ? null : mode;
  }

  /**
   * A new size (P-150), keeping how the layer sizes itself: Figma's resize fixes both axes and stops a text sizing
   * itself, while the XML changed one size only. A section has only resizeWithoutConstraints; so does a frame, since
   * resize() scales its SCALE-constrained children with it (FX-036).
   */
  resize(
    node: SceneNode,
    width: number,
    height: number,
  ): void {
    const box = node as FrameNode;
    const [wide, high] = [Math.max(width, GEOMETRY.minSize), Math.max(height, GEOMETRY.minSize)];

    if (box.width === wide && box.height === high) {
      return;
    }

    if (node.type === FIGMA_NODE_TYPE.section) {
      node.resizeWithoutConstraints(wide, high);

      return;
    }

    const kept = { layoutSizingHorizontal: box.layoutSizingHorizontal, layoutSizingVertical: box.layoutSizingVertical };
    const autoResize = node.type === FIGMA_NODE_TYPE.text ? node.textAutoResize : undefined;

    if (this.#capabilities.has(node, CAPABILITY.autoLayout)) {
      box.resizeWithoutConstraints(wide, high);
    } else {
      box.resize(wide, high);
    }

    this.#assign.set(box, kept);
    this.#assign.set(node as TextNode, { textAutoResize: autoResize });
  }

  /** The turn and the mirror about the layer's centre, as CSS turns (P-151). */
  turn(
    node: SceneNode,
    rotation: number,
    mirror: boolean,
  ): void {
    this.#move(node, this.#matrix(node).turned(rotation, mirror));
  }

  /** The layer moved so its centre is at `centre` along one axis of its parent. */
  centre(
    node: SceneNode,
    axis: MatrixAxis,
    centre: number,
  ): void {
    this.#move(node, this.#matrix(node).centredAlong(axis, centre));
  }

  /** How long the turned layer is along one axis of its parent. */
  covered(node: SceneNode, axis: MatrixAxis): number {
    return this.#matrix(node).covered(axis);
  }

  /** A line turned upright (within half a degree), as design_read writes it: a height and its left border. */
  standing(node: SceneNode): boolean {
    const [[m00]] = (node as LineNode).relativeTransform;

    return Math.abs(m00) < Math.sin((GEOMETRY.lineSnapDegrees * Math.PI) / GEOMETRY.halfTurnDegrees);
  }

  #matrix(node: SceneNode): LayerMatrix {
    const box = node as FrameNode;

    return new LayerMatrix(box.relativeTransform as Matrix, box);
  }

  #move(node: SceneNode, next: Matrix): void {
    if (this.#matrix(node).differs(next)) {
      (node as FrameNode).relativeTransform = next;
    }
  }
}

export const STEP_GEOMETRY = new InjectionToken<StepGeometry>("StepGeometry");
