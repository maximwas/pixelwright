import { inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { REACTION_FIELD_READER } from "@/plugin/adapters/figma/layer-meta/reaction-field-reader.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { FLOWS_TEXT } from "@/plugin/operations/flows/flows.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { FLOWS } from "@/shared/ops/flows/flows.constants.ts";
import type { FlowsInput, FlowsRaw, ReactiveLayer } from "@/shared/ops/flows/flows.schema.ts";

/**
 * A page's prototype as Figma keeps it (P-121): its flow starting points, its screens (PageLoader.screens) and, screen
 * by screen, every layer with interactions, read by the read op's ReactionFieldReader (destinations named), up to
 * FLOWS.maxLinks layers within the op's budget. flow_read turns them into links on the server.
 */
@injectable()
export class FlowsOperation extends Operation<FlowsInput, FlowsRaw> {
  readonly #pages;
  readonly #walk;
  readonly #reactions;

  constructor(
    report = inject(OP_REPORT),
    pages = inject(PAGE_LOADER),
    walk = inject(LAYER_WALK),
    reactions = inject(REACTION_FIELD_READER),
  ) {
    super(report);
    this.#pages = pages;
    this.#walk = walk;
    this.#reactions = reactions;
  }

  protected async execute({ page: id }: FlowsInput): Promise<FlowsRaw> {
    const page = await this.#pages.root(id);

    if (page.type !== FIGMA_NODE_TYPE.page) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, FLOWS_TEXT.notPage(page.id, page.type));
    }

    await this.#pages.load(page);

    const screens = this.#pages.screens(page);
    const { layers, cut } = await this.#reactive(screens);

    return {
      page: page.name,
      starts: page.flowStartingPoints.map(({ nodeId, name }) => ({ id: nodeId, name })),
      screens: screens.map(({ id, name, width, height }) => ({
        id,
        name,
        width: Math.round(width),
        height: Math.round(height),
      })),
      layers,
      more: cut,
    };
  }

  /** Each screen's layers with interactions, until FLOWS.maxLinks of them or the deadline; `cut` when either stopped it. */
  async #reactive(screens: readonly SceneNode[]): Promise<{ layers: ReactiveLayer[]; cut: boolean }> {
    const deadline = this.#walk.deadline();
    const layers: ReactiveLayer[] = [];

    for (const screen of screens) {
      const room = FLOWS.maxLinks - layers.length;

      if (room <= 0) {
        return { layers, cut: true };
      }

      const walked = this.#walk.until(this.#walk.layers([screen]), deadline, {
        accepts: (node) => "reactions" in node && node.reactions.length > 0,
        enough: room,
      });

      for (const node of walked.kept) {
        const { reactions = [] } = await this.#reactions.read(node);

        layers.push({ screen: screen.id, id: node.id, name: node.name, reactions });
      }

      if (walked.cut) {
        return { layers, cut: true };
      }
    }

    return { layers, cut: false };
  }
}
