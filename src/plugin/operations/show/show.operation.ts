import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CANVAS_VIEW } from "@/plugin/adapters/figma/canvas-view.ts";
import { CURRENT_SELECTION } from "@/plugin/adapters/figma/current-selection.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { SHOW_TEXT } from "@/plugin/operations/show/show.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { SHOW } from "@/shared/ops/show/show.constants.ts";
import type { showOp } from "@/shared/ops/show/show.manifest.ts";

type ShowInput = zod.output<typeof showOp.input>;

type ShowOutput = zod.output<typeof showOp.output>;

/** A layer to show and the page it is on. */
interface LayerOnPage {
  readonly layer: SceneNode;
  readonly page: PageNode;
}

/**
 * Brings layers into view (T-032, P-112): all on one page, which becomes the current one; selects them unless told not
 * to; fits them in view, then sets the zoom when one is given. Only the view and the selection change, never the file.
 */
@injectable()
export class ShowOperation extends Operation<ShowInput, ShowOutput> {
  readonly #lookup;
  readonly #view;
  readonly #selection;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    view = inject(CANVAS_VIEW),
    selection = inject(CURRENT_SELECTION),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#view = view;
    this.#selection = selection;
  }

  protected async execute({ node, nodes, zoom, select }: ShowInput): Promise<ShowOutput> {
    const ids = nodes ?? (node === undefined ? [] : [node]);
    const { page, layers } = this.#onePage(await Promise.all(ids.map((id) => this.#layerOnPage(id))));

    await this.#view.open(page);

    if (select) {
      this.#selection.select(layers);
    }

    const shownZoom = this.#view.bringIntoView(layers, zoom === SHOW.fit ? null : zoom);

    return { nodes: layers.map(({ id, name }) => ({ id, name })), page: page.name, zoom: shownZoom };
  }

  /** The page all the layers are on, and the layers; none given, or a layer on another page, refuses the call. */
  #onePage(found: readonly LayerOnPage[]): { readonly page: PageNode; readonly layers: SceneNode[] } {
    const [first] = found;

    if (first === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, SHOW_TEXT.giveNodes);
    }

    const other = found.find(({ page }) => page !== first.page);

    if (other !== undefined) {
      throw new PixelwrightError(
        ERROR_CODE.opFailed,
        SHOW_TEXT.twoPages(other.layer.id, other.page.name, first.page.name),
      );
    }

    return { page: first.page, layers: found.map(({ layer }) => layer) };
  }

  /** A layer and its page; a page, the document or a node off every page is no layer to show. */
  async #layerOnPage(id: string): Promise<LayerOnPage> {
    const found = await this.#lookup.existing(id);
    const page = this.#lookup.pageOf(found);

    // A page, the document or a node off every page is no layer to show (P-112).
    if (page === null || found.type === FIGMA_NODE_TYPE.page || found.type === FIGMA_NODE_TYPE.document) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, SHOW_TEXT.notALayer(id));
    }

    return { layer: found, page };
  }
}
