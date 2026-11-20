import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { DELETE_TEXT } from "@/plugin/operations/delete/delete.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { deleteOp } from "@/shared/ops/delete/delete.manifest.ts";

type DeleteInput = zod.output<typeof deleteOp.input>;

type DeleteOutput = zod.output<typeof deleteOp.output>;

/**
 * Deletes layers, each on its own (T-045, P-160): one Figma will not delete (a page, a layer inside an instance) stays
 * with its reason, while what an instance's slot holds is the instance's own and goes. A dry run runs the same checks
 * and deletes nothing (T-012); the real run is one undo step.
 */
@injectable()
export class DeleteOperation extends Operation<DeleteInput, DeleteOutput> {
  readonly #lookup;
  readonly #pages;
  readonly #history;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    pages = inject(PAGE_LOADER),
    history = inject(FILE_HISTORY),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#pages = pages;
    this.#history = history;
  }

  protected async execute({ nodes, dryRun }: DeleteInput): Promise<DeleteOutput> {
    const deleted: string[] = [];
    const errors: DeleteOutput["errors"] = [];

    for (const id of nodes) {
      try {
        const layer = await this.#deletable(id);

        if (!dryRun) {
          layer.remove();
        }

        deleted.push(id);
      } catch (error) {
        errors.push({ id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!dryRun && deleted.length > 0) {
      this.#history.commitUndo();
    }

    return { deleted, errors };
  }

  /** The layer by id, its page loaded; a page, the document or a layer inside an instance is refused. */
  async #deletable(id: string): Promise<SceneNode> {
    const node = await this.#lookup.node(id);

    if (node === null || node.type === FIGMA_NODE_TYPE.page || node.type === FIGMA_NODE_TYPE.document) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, DELETE_TEXT.noLayer(id));
    }

    if (this.#insideInstance(node)) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DELETE_TEXT.insideInstance);
    }

    const page = this.#lookup.pageOf(node);

    if (page !== null) {
      await this.#pages.load(page);
    }

    return node;
  }

  /** Inside an instance, unless a slot of it holds the layer: a slot's content is the instance's own. */
  #insideInstance(node: SceneNode): boolean {
    for (let current = node.parent; current !== null; current = current.parent) {
      const type: string = current.type;

      if (type === FIGMA_NODE_TYPE.instance) {
        return true;
      }

      if (type === FIGMA_NODE_TYPE.slot) {
        return false;
      }
    }

    return false;
  }
}
