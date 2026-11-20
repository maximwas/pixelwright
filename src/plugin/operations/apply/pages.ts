import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_PATTERN, APPLY_TEXT } from "@/plugin/operations/apply/apply.constants.ts";

/** design_apply's pages (T-125): `<Page name>` makes one, last; `<Page id>` names one the file has. Never deleted or reordered. */
@injectable()
export class Pages {
  readonly #factory;
  readonly #lookup;
  readonly #pages;

  constructor(
    factory = inject(LAYER_FACTORY),
    lookup = inject(NODE_LOOKUP),
    pages = inject(PAGE_LOADER),
  ) {
    this.#factory = factory;
    this.#lookup = lookup;
    this.#pages = pages;
  }

  /** A new page, last; past the plan's page limit Figma's refusal said in plain words, `name` the page's (FX-054). */
  made(name: string | undefined): PageNode {
    try {
      return this.#factory.page();
    } catch (error) {
      const limit = APPLY_PATTERN.pageLimit.exec(error instanceof Error ? error.message : String(error))?.[1];

      if (limit === undefined) {
        throw error;
      }

      throw new WriteError(APPLY_TEXT.pageLimit(limit, name ?? APPLY_TEXT.thePage), APPLY_TEXT.pageLimitHint);
    }
  }

  /** The page a <Page id> names, its layers loaded unless a dry run only checks it. */
  async existing(id: string | null, load: boolean): Promise<PageNode> {
    const node = id === null ? null : await this.#lookup.node(id);

    if (node?.type !== FIGMA_NODE_TYPE.page) {
      throw new WriteError(
        node === null ? APPLY_TEXT.noPage(id) : APPLY_TEXT.notPage(id, node.type.toLowerCase()),
        APPLY_TEXT.pageHint,
      );
    }

    if (load) {
      await this.#pages.load(node);
    }

    return node;
  }
}

export const PAGES = new InjectionToken<Pages>("Pages");
