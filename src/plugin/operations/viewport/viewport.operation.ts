import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CANVAS_VIEW } from "@/plugin/adapters/figma/canvas-view.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { VIEWPORT } from "@/plugin/operations/viewport/viewport.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import type { viewportOp } from "@/shared/ops/viewport/viewport.manifest.ts";

type ViewportInput = zod.output<typeof viewportOp.input>;

type ViewportOutput = zod.output<typeof viewportOp.output>;

/**
 * What the user sees (T-033, P-113): the page, the zoom, the view's centre and bounds, and the visible layers that meet
 * the view, the page's own and their children, outermost first, up to the most the answer lists (`more` past it).
 */
@injectable()
export class ViewportOperation extends Operation<ViewportInput, ViewportOutput> {
  readonly #view;
  readonly #refs;

  constructor(
    report = inject(OP_REPORT),
    view = inject(CANVAS_VIEW),
    refs = inject(LAYER_REFS),
  ) {
    super(report);
    this.#view = view;
    this.#refs = refs;
  }

  protected async execute(): Promise<ViewportOutput> {
    const { bounds, center, zoom } = this.#view.state();
    const page = this.#view.page();
    const seen = this.#inView(page.children, bounds, 0);

    return {
      page: page.name,
      zoom,
      center: { x: Math.round(center.x), y: Math.round(center.y) },
      bounds: this.#refs.box(bounds),
      layers: seen.slice(0, LIMITS.viewportLayers).map((layer) => this.#refs.ref(layer)),
      more: seen.length > LIMITS.viewportLayers,
    };
  }

  /** The layers that meet the view, each followed by its own children that do, down to VIEWPORT.childLevels. */
  #inView(
    nodes: readonly SceneNode[],
    bounds: Rect,
    level: number,
  ): SceneNode[] {
    return nodes
      .filter((node) => this.#meets(node, bounds))
      .flatMap((node) =>
        level < VIEWPORT.childLevels && "children" in node
          ? [node, ...this.#inView(node.children, bounds, level + 1)]
          : [node],
      );
  }

  /** A visible layer whose box overlaps the view. */
  #meets(node: SceneNode, bounds: Rect): boolean {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return (
      node.visible &&
      box !== null &&
      box.x < bounds.x + bounds.width &&
      box.x + box.width > bounds.x &&
      box.y < bounds.y + bounds.height &&
      box.y + box.height > bounds.y
    );
  }
}
