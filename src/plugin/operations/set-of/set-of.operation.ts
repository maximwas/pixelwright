import { inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { SET_OF_TEXT } from "@/plugin/operations/set-of/set-of.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { SetOfInput, SetOfOutput } from "@/shared/ops/set-of/set-of.schema.ts";

/** The component set a layer is, holds a variant of, or is an instance of a variant of (P-116); anything else fails. */
@injectable()
export class SetOfOperation extends Operation<SetOfInput, SetOfOutput> {
  readonly #lookup;

  constructor(report = inject(OP_REPORT), lookup = inject(NODE_LOOKUP)) {
    super(report);
    this.#lookup = lookup;
  }

  protected async execute({ node: id }: SetOfInput): Promise<SetOfOutput> {
    const node = await this.#lookup.existing(id);
    const main = node.type === FIGMA_NODE_TYPE.instance ? await node.getMainComponentAsync() : node;
    const set = this.#setOf(main);

    if (set === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, SET_OF_TEXT.noSet(id, node.name));
    }

    return { id: set.id, name: set.name };
  }

  #setOf(node: BaseNode | null): BaseNode | null {
    if (node?.type === FIGMA_NODE_TYPE.componentSet) {
      return node;
    }

    const parent = node?.parent ?? null;

    return parent?.type === FIGMA_NODE_TYPE.componentSet ? parent : null;
  }
}
