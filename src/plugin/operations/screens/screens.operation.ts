import { inject, injectable } from "@needle-di/core";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { SCREENS_TEXT } from "@/plugin/operations/screens/screens.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { PageScreen, ScreensInput, ScreensRaw } from "@/shared/ops/screens/screens.schema.ts";

/**
 * The screen a layer is on and the page's other screens, each with its children's names, for breakpoints_find (P-123);
 * the page is loaded first. A layer on no screen (a section itself) fails.
 */
@injectable()
export class ScreensOperation extends Operation<ScreensInput, ScreensRaw> {
  readonly #lookup;
  readonly #pages;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    pages = inject(PAGE_LOADER),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#pages = pages;
  }

  protected async execute({ node: id }: ScreensInput): Promise<ScreensRaw> {
    const node = await this.#lookup.existing(id);
    const page = this.#lookup.pageOf(node);

    if (page === null) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, SCREENS_TEXT.offPage(id));
    }

    await this.#pages.load(page);

    const screens = this.#pages.screens(page);
    const target = screens.find((screen) => this.#holds(screen, node));

    if (target === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, SCREENS_TEXT.noScreen(id, node.name));
    }

    return {
      target: this.#described(target),
      screens: screens.filter((screen) => screen !== target).map((screen) => this.#described(screen)),
    };
  }

  /** Whether the screen is the node or holds it. */
  #holds(screen: SceneNode, node: BaseNode): boolean {
    for (let current: BaseNode | null = node; current !== null; current = current.parent) {
      if (current === screen) {
        return true;
      }
    }

    return false;
  }

  #described(screen: SceneNode): PageScreen {
    return {
      id: screen.id,
      name: screen.name,
      width: Math.round(screen.width),
      height: Math.round(screen.height),
      children: "children" in screen ? screen.children.map((child) => child.name) : [],
    };
  }
}
