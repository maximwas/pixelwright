import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CANVAS_VIEW } from "@/plugin/adapters/figma/canvas-view.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LOOKUP_TEXT } from "@/plugin/adapters/figma/lookup/lookup.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { PageNotRead } from "@/shared/ops/file-map/file-map.schema.ts";

/**
 * The file's pages and their loading (P-073, FX-007): under documentAccess "dynamic-page" a page other than the
 * current one has no layers until it is loaded, and a page Figma cannot load (offline, say) is left out and noted.
 */
@injectable()
export class PageLoader {
  readonly #lookup;
  readonly #view;

  constructor(lookup = inject(NODE_LOOKUP), view = inject(CANVAS_VIEW)) {
    this.#lookup = lookup;
    this.#view = view;
  }

  /** Every page in order, by id and name: listing them needs no loading. */
  pages(): readonly PageNode[] {
    return figma.root.children;
  }

  current(page: PageNode): boolean {
    return page === this.#view.page();
  }

  async load(page: PageNode): Promise<void> {
    if (!this.current(page)) {
      await page.loadAsync();
    }
  }

  /** Whether the page's layers can be read; when Figma cannot load it, false, its name and Figma's words noted. */
  async loaded(page: PageNode, notRead: PageNotRead[]): Promise<boolean> {
    try {
      await this.load(page);

      return true;
    } catch (error) {
      notRead.push({ name: page.name, error: error instanceof Error ? error.message : String(error) });

      return false;
    }
  }

  /** Where an op starts: the layer or page by id, or the current page when none is given. */
  async root(id: string | undefined): Promise<BaseNode> {
    return id === undefined ? this.#view.page() : await this.#lookup.existing(id);
  }

  /** The layers right inside the layer or page by id, its page loaded first; the current page's when none is given. */
  async children(id: string | undefined): Promise<readonly SceneNode[]> {
    const node = await this.root(id);

    if (node.type === FIGMA_NODE_TYPE.document) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, LOOKUP_TEXT.document(node.id));
    }

    if (!("children" in node)) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, LOOKUP_TEXT.noLayers(node.id));
    }

    const page = this.#lookup.pageOf(node);

    if (page !== null) {
      await this.load(page);
    }

    return node.children;
  }
}

export const PAGE_LOADER = new InjectionToken<PageLoader>("PageLoader");
